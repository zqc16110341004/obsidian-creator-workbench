import {esc} from './store.js';
import {reliable,needsReview,changeContent,reviewBlocker} from './content-review.js';

const names={viewpoint:'核心观点',outline:'提纲',script:'口播稿'};
const nonempty=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
export function titleBases(t){
  return Object.entries(names).filter(([key])=>t[key]?.trim()&&!needsReview(t,key)&&(key==='viewpoint'||(key==='outline'?reliable(t,'viewpoint'):reliable(t,'outline')))).map(([key,label])=>({key,label,status:reliable(t,key)?key==='script'?'已定稿':'已确认':key==='script'?'尚未定稿':'尚未确认'}));
}
export function titleContext(t,basis){
  return JSON.stringify([t.title,basis,t[basis],basis!=='viewpoint'?t.viewpoint:'',basis==='script'?t.outline:'',t.references??t.sourceSnapshot?.reference??'',t.sourceSnapshot?.links||[],t.assetIds||[],t.assetUses?.filter(u=>!u.endedAt)||[]]);
}
export function titleInput(t,basis,requirements=''){
  const choices=titleBases(t),choice=basis?choices.find(x=>x.key===basis):choices.at(-1);
  if(!choice)throw Error('请先补充当前观点，或复核用于生成标题的内容');
  requirements=String(requirements).trim();if(requirements.length>1000)throw Error('标题要求请控制在 1000 字以内');
  return {basis:choice.key,basisLabel:choice.label,basisStatus:choice.status,basisText:t[choice.key],requirements,sourceContext:titleContext(t,choice.key)};
}
export const titleRequest='请根据我选择的内容依据生成不同表达方向的标题候选，说明内容依据和使用边界，供我选择修改。';
export const titleFormat=`本次为标题生成。只返回 JSON 对象，不附其他文字：{"status":"titles","summary":"对本次标题方向的简要说明","candidates":[{"title":"标题文字","angle":"表达侧重点","reason":"所选内容中支撑标题的具体依据","caution":"需要核对的事实、范围或使用边界"}]}。提供 3–5 个有实质区别的标题，每个标题不超过 80 字，其他字符串不超过 1200 字。仅根据 titleBasis.text 和可用参考；遵守明确填写的 titleBasis.requirements，未填不推断偏好。不把假设、候选或未定稿内容说成事实；不编造数据、效果、经历，不承诺流量。若内容不足以负责任地拟题，返回 {"status":"needs_material","summary":"说明缺什么资料并提出一个具体补充问题","candidates":[]}。不生成正文或封面，不宣称已经选定标题。`;
export function parseTitles(raw){
  if(typeof raw!=='string'||raw.length>20000)return null;
  let str=raw.trim();if(/^```(?:json)?\s/i.test(str)&&str.endsWith('```'))str=str.replace(/^```(?:json)?\s*/i,'').slice(0,-3).trim();
  let data;try{data=JSON.parse(str);}catch{return null;}
  if(!data||!nonempty(data.summary,1200)||!Array.isArray(data.candidates))return null;
  if(data.status==='needs_material')return data.candidates.length===0?{status:data.status,summary:data.summary.trim(),candidates:[]}:null;
  if(data.status!=='titles'||data.candidates.length<3||data.candidates.length>5)return null;
  if(!data.candidates.every(c=>c&&nonempty(c.title,80)&&['angle','reason','caution'].every(k=>nonempty(c[k],1200))))return null;
  const normalized=data.candidates.map(c=>c.title.replace(/[\s\p{P}]/gu,'').toLowerCase());if(new Set(normalized).size!==normalized.length)return null;
  return {status:data.status,summary:data.summary.trim(),candidates:data.candidates.map(c=>Object.fromEntries(['title','angle','reason','caution'].map(k=>[k,c[k].trim()])))};
}
export function titlesText(d){return [d.summary,...d.candidates.map((c,i)=>`标题 ${i+1}：${c.title}\n方向：${c.angle}\n内容依据：${c.reason}\n使用边界：${c.caution}`)].join('\n\n');}
export function findTitle(t,jobId,index){
  const message=t.messages.find(m=>m.role==='assistant'&&m.provider==='codex'&&m.jobId===jobId&&m.titleCandidates);
  const data=message&&parseTitles(JSON.stringify(message.titleCandidates));
  if(!data||!Number.isInteger(index)||!data.candidates[index])return null;
  const current=titleBases(t).find(x=>x.key===message.titleBasis?.basis);
  const stale=!current||message.titleBasis.sourceContext!==titleContext(t,current.key);
  return {message,candidate:data.candidates[index],stale};
}
export function adoptTitle(t,jobId,index,title){
  const found=findTitle(t,jobId,index);if(!found)throw Error('没有找到这条标题候选');
  if(found.stale)throw Error('标题依据已有变化，请重新生成候选');
  title=String(title).trim();if(!nonempty(title,120))throw Error('请填写不超过 120 字的标题');
  if(title!==t.finalTitle){t.messages.push({role:'assistant',provider:'local',text:`采用前的标题：\n${t.finalTitle||'（空）'}`});changeContent(t,'finalTitle',title);}
  if(needsReview(t,'finalTitle')&&!reviewBlocker(t,'finalTitle'))delete t.needsReview.finalTitle;
  found.message.selectedTitle={index,text:title,adoptedAt:Date.now()};t.stage=3;
}
export function titleCards(m,t){
  const data=parseTitles(JSON.stringify(m.titleCandidates));if(!data)return `<p>${esc(m.text)}</p>`;
  const basis=m.titleBasis;
  return `<div class="title-results"><strong>${data.status==='needs_material'?'先补充标题依据':'标题候选 · 等你选择'}</strong><p class="micro">本次依据：${esc(basis?.basisLabel||'当前内容')} · ${esc(basis?.basisStatus||'状态未记录')}${basis?.requirements?`<br>要求：${esc(basis.requirements)}`:''}</p><p>${esc(data.summary)}</p>${data.candidates.map((c,i)=>{const stale=findTitle(t,m.jobId,i)?.stale;return `<article class="title-candidate"><small>${esc(c.angle)}</small><h3>${esc(c.title)}</h3><dl class="direction-details"><dt>内容依据</dt><dd>${esc(c.reason)}</dd><dt>使用边界</dt><dd>${esc(c.caution)}</dd></dl>${m.selectedTitle?.index===i?`<p class="micro">曾采用并修改为：${esc(m.selectedTitle.text)}</p>`:''}${stale?'<p class="direction-notice">依据已变化，请重新生成后再选择。</p>':''}<button class="btn secondary small" data-action="title-adopt" data-id="${esc(m.jobId)}" data-value="${i}" ${stale?'disabled':''}>选择并修改标题</button></article>`;}).join('')}</div>`;
}
export function titlePanel(t,ui){
  const m=[...t.messages].reverse().find(m=>m.titleCandidates),pending=['running','cancelling'].includes(t.aiJob?.status);
  return `<section class="title-workflow"><div class="button-row"><button class="btn secondary" data-action="titles-start" ${pending||!ui.codexSupported?'disabled':''}>${pending?'共创进行中…':m?'重新生成标题候选':'生成标题候选'}</button><span class="micro muted">可提前使用观点或提纲，不必等正文定稿。</span></div>${!ui.codexSupported?'<p class="micro">真实生成请在 Obsidian 打开；也可以直接填写标题。</p>':''}${m?titleCards(m,t):'<p class="micro muted">生成后先查看方向和依据，选择时可以改成自己的表达。</p>'}</section>`;
}
