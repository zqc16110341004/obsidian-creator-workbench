import {esc} from './store.js';
import {changeContent} from './content-review.js';

export const directionRequest='请帮我梳理当前选题的观点，给出不同方向、依据与缺口，并问我一个有助于形成自己判断的问题。';
export const directionFormat=`本次为观点探索。只返回一个 JSON 对象，不附 Markdown 或其他文字。格式：{"status":"directions","summary":"对资料的简短判断","directions":[{"title":"方向名称","claim":"核心主张","audience":"适用受众","evidence":["当前资料中实际存在的依据；没有事实依据时明确说明仅为待验证假设"],"gaps":["需要用户补充的证据或经历"]}],"question":"一个关键追问"}。directions 必须是 2–3 个实质不同的方向，每项的 evidence 和 gaps 各 1–4 条。不得编造用户经历、数据、来源或认可的立场。资料不足以提出负责的方向时，status 改为 needs_material，directions 为 []，summary 说明不足，question 请求关键补充。没有正文的链接不是已读取资料。所有字段使用简体中文字符串；单个字符串不超过 1600 字，方向名称不超过 100 字。`;

export function directionContext(t){
  return JSON.stringify([t.title,t.viewpoint,t.outline,t.script,t.references??t.sourceSnapshot?.reference??'',t.sourceSnapshot?.links||[],t.assetIds||[]]);
}
export function parseDirections(raw){
  if(typeof raw!=='string'||raw.length>30000)return null;
  let text=raw.trim();if(/^```(?:json)?\s/i.test(text)&&text.endsWith('```'))text=text.replace(/^```(?:json)?\s*/i,'').slice(0,-3).trim();
  let data;try{data=JSON.parse(text);}catch{return null;}
  const string=(value,max=1600)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
  const list=value=>Array.isArray(value)&&value.length>=1&&value.length<=4&&value.every(x=>string(x));
  if(!data||!string(data.summary)||!string(data.question)||!Array.isArray(data.directions))return null;
  if(data.status==='needs_material')return data.directions.length===0?{status:data.status,summary:data.summary.trim(),directions:[],question:data.question.trim()}:null;
  if(data.status!=='directions'||data.directions.length<2||data.directions.length>3)return null;
  if(!data.directions.every(d=>d&&string(d.title,100)&&string(d.claim)&&string(d.audience)&&list(d.evidence)&&list(d.gaps)))return null;
  if(new Set(data.directions.map(d=>d.claim.trim())).size!==data.directions.length)return null;
  return {status:data.status,summary:data.summary.trim(),question:data.question.trim(),directions:data.directions.map(d=>({title:d.title.trim(),claim:d.claim.trim(),audience:d.audience.trim(),evidence:d.evidence.map(x=>x.trim()),gaps:d.gaps.map(x=>x.trim())}))};
}
export function directionsText(data){
  return [data.summary,...data.directions.map((d,i)=>`方向 ${i+1}：${d.title}\n核心主张：${d.claim}\n面向谁：${d.audience}\n现有依据：${d.evidence.join('；')}\n证据缺口：${d.gaps.join('；')}`),`想请你补充：${data.question}`].join('\n\n');
}
export function directionDetails(d){
  return `<dl class="direction-details"><dt>核心主张</dt><dd>${esc(d.claim)}</dd><dt>面向谁</dt><dd>${esc(d.audience)}</dd><dt>现有依据</dt><dd><ul>${d.evidence.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></dd><dt>证据缺口</dt><dd><ul>${d.gaps.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></dd></dl>`;
}
export function directionCards(message,task){
  const data=parseDirections(JSON.stringify(message.directions));if(!data)return '';
  const stale=message.sourceContext!==directionContext(task);
  return `<div class="direction-result"><strong>${data.status==='needs_material'?'先补充关键资料':'观点方向 · 等你判断'}</strong><p>${esc(data.summary)}</p>${stale?'<p class="direction-notice">任务内容已有变化，采用前请重新核对依据。</p>':''}${data.directions.map((d,i)=>`<article class="direction-card"><h3>方向 ${i+1} · ${esc(d.title)}</h3>${directionDetails(d)}${message.selectedDirection===i?'<p class="micro">曾采用此方向，最终表达以编辑区为准</p>':''}<div class="button-row"><button type="button" class="btn secondary small" data-action="direction-adopt" data-id="${esc(message.jobId)}" data-value="${i}">选择并修改这个方向</button><button type="button" class="btn quiet small" data-action="direction-discuss" data-id="${esc(message.jobId)}" data-value="${i}">继续聊这个方向</button></div></article>`).join('')}<div class="direction-question"><strong>想请你补充</strong><p>${esc(data.question)}</p><small>在下方回复，也可以反驳这些方向或补充资料后重新梳理。</small></div></div>`;
}
export function findDirection(t,jobId,index){
  const message=t.messages.find(m=>m.role==='assistant'&&m.provider==='codex'&&m.jobId===jobId);
  const data=message&&parseDirections(JSON.stringify(message.directions));
  if(!data||!Number.isInteger(index)||!data.directions[index])return null;
  return {message,direction:data.directions[index],stale:message.sourceContext!==directionContext(t)};
}
export function adoptDirection(t,jobId,index,text,acknowledged=false){
  const found=findDirection(t,jobId,index);if(!found)throw Error('这个候选已不可用，请重新打开共创记录');
  if(found.stale&&!acknowledged)throw Error('资料已有变化，请先核对并勾选确认');
  text=text.trim();if(!text||text.length>8000)throw Error('请填写不超过 8000 字的核心观点');
  if(t.viewpoint!==text)t.messages.push({role:'assistant',provider:'local',text:`采用前的核心观点：\n${t.viewpoint||'（空）'}`});
  changeContent(t,'viewpoint',text);t.viewConfirmed=false;t.stage=0;
  found.message.selectedDirection=index;
}
