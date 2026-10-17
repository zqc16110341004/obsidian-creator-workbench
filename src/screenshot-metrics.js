const names={views:['播放','播放量','播放次数','浏览','浏览量','浏览次数'],likes:['点赞','点赞量','点赞数','点赞次数'],saves:['收藏','收藏量','收藏数','收藏次数'],comments:['评论','评论量','评论数','评论次数']};
export const metricKeys=Object.keys(names);
const compact=s=>s.normalize('NFKC').replace(/\s+/g,'').replace(/，/g,',');
export function screenshotNumber(raw){
 const s=compact(raw).replace(/次$/,'');
 if(!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:万|亿|[kKwW])?$/.test(s))return null;
 const unit=s.match(/[万亿kKwW]$/)?.[0]||'',number=Number(s.replace(/[万亿kKwW]$/,'').replaceAll(',','')),factor=unit==='亿'?1e8:unit==='万'||/[wW]/.test(unit)?1e4:unit?1e3:1;
 const value=number*factor;if(!Number.isSafeInteger(value)||value<0)return null;
 return {value,approximate:Boolean(unit),raw:s};
}
export function extractScreenshotMetrics(result){
 if(result?.engine!=='macos-vision'||! /^[a-f0-9]{64}$/.test(result.imageSha256||'')||!Array.isArray(result.lines)||result.lines.length>500)throw Error('识别结果无效，请重新识别或手工填写');
 const lines=result.lines.map(l=>{if(typeof l.text!=='string'||l.text.length>300||!['confidence','x','y','w','h'].every(k=>Number.isFinite(l[k])&&l[k]>=0&&l[k]<=1))throw Error('识别文字格式无效');return {...l,text:l.text.trim()};});
 const hits=Object.fromEntries(metricKeys.map(k=>[k,[]]));
 const labelLines=[];
 for(const [i,l] of lines.entries()){
  const s=compact(l.text);
  for(const key of metricKeys)for(const name of [...names[key]].sort((a,b)=>b.length-a.length)){
   if(s===name){labelLines.push({i,key,name});break;}
   const match=s.match(new RegExp('^'+name+'[:：]?(.+)$'));
   if(match&&/^[\d.,+\-万亿kKwW次%—]+$/.test(match[1])){const number=screenshotNumber(match[1]);hits[key].push({name,raw:match[1],number,evidence:l.text,confidence:l.confidence,lineIds:[i]});break;}
  }
 }
 const numeric=lines.map((l,i)=>({l,i,number:screenshotNumber(l.text)})).filter(x=>x.number);
 const links=labelLines.map(label=>{const l=lines[label.i];return {...label,values:numeric.filter(({l:n})=>{
   const vertical=Math.abs((l.x+l.w/2)-(n.x+n.w/2))<=Math.max(.025,Math.min(l.w,n.w)/2)&&Math.max(l.y-n.y-n.h,n.y-l.y-l.h,0)<=Math.max(.04,l.h*1.8);
   const horizontal=Math.abs((l.y+l.h/2)-(n.y+n.h/2))<=Math.min(l.h,n.h)*.6&&Math.max(n.x-l.x-l.w,l.x-n.x-n.w,0)<.08;
   return vertical||horizontal;
  })};});
 for(const label of links){
  if(!label.values.length){hits[label.key].push({name:label.name,raw:'',number:null,evidence:lines[label.i].text,confidence:lines[label.i].confidence,lineIds:[label.i]});continue;}
  for(const v of label.values){const shared=links.filter(other=>other.values.some(n=>n.i===v.i)).length>1;hits[label.key].push({name:label.name,raw:v.l.text,number:shared?null:v.number,evidence:lines[label.i].text+' / '+v.l.text,confidence:Math.min(lines[label.i].confidence,v.l.confidence),lineIds:[label.i,v.i]});}
 }
 const candidates=Object.fromEntries(metricKeys.map(key=>{const h=hits[key],one=h.length===1?h[0]:null;return [key,{name:one?.name||names[key][0],status:!h.length?'missing':h.length>1?'conflict':!one.number||one.confidence<.8?'uncertain':'ready',value:one?.number?.value??null,approximate:one?.number?.approximate||false,raw:one?.raw||'',evidence:h.map(x=>x.evidence).join('；').slice(0,2000)}];}));
 return {engine:'macos-vision',imageSha256:result.imageSha256,recognizedAt:result.recognizedAt,candidates,rawText:lines.map(l=>l.text).join('\n').slice(0,16000)};
}
export function fillEmptyMetrics(current,recognition){
 const next={...current},filled=[];
 for(const key of metricKeys){const c=recognition.candidates[key];if(c.status!=='ready'||String(current[key]??'').trim()!=='')continue;next[key]=String(c.value);if(key==='views')next.viewsName=c.name.startsWith('浏览')?'浏览':'播放';filled.push(key);}
 return {values:next,filled};
}
export function validateRecognition(r,attachment,now=Date.now()){
 if(r==null)return null;
 if(r.engine!=='macos-vision'||!attachment||r.imageSha256!==attachment.sha256||!Number.isFinite(r.recognizedAt)||r.recognizedAt>now+60000||r.recognizedAt<=0||typeof r.rawText!=='string'||r.rawText.length>16000)throw Error('识别依据与截图不一致，请重新识别或放弃识别候选后手填');
 const candidates={};
 for(const key of metricKeys){const c=r.candidates?.[key];if(!c||!['ready','missing','uncertain','conflict'].includes(c.status)||typeof c.name!=='string'||c.name.length>30||typeof c.raw!=='string'||c.raw.length>300||typeof c.evidence!=='string'||c.evidence.length>2000||typeof c.approximate!=='boolean'||c.value!==null&&(!Number.isSafeInteger(c.value)||c.value<0)||c.status==='ready'&&c.value===null)throw Error('识别候选格式有误');candidates[key]={name:c.name,status:c.status,value:c.value,raw:c.raw,approximate:c.approximate,evidence:c.evidence};}
 return {engine:r.engine,imageSha256:r.imageSha256,recognizedAt:r.recognizedAt,candidates,rawText:r.rawText};
}
