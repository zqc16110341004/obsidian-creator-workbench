import {validateRecognition} from './screenshot-metrics.js';
import {uid} from './store.js';
export const samplingPeriods={'24h':24,'7d':168};
export const samplingLabels={views:'播放',likes:'点赞',saves:'收藏',comments:'评论'};
export function publishedContents(s,includeTests=false){return s.tasks.filter(t=>t.publishedAt&&Number.isFinite(Date.parse(t.publishedAt))&&(includeTests||!t.testOnly));}
export function contentForSample(s,id){const t=s.tasks.find(t=>t.id===id);if(!t||!t.publishedAt||!Number.isFinite(Date.parse(t.publishedAt)))throw Error('请先选择有实际发布时间的内容');return t;}
export function samplesFor(s,id){return (s.samples||[]).filter(x=>x.taskId===id).sort((a,b)=>Date.parse(b.sampledAt)-Date.parse(a.sampledAt));}
export function samplingGuard(s,id){const t=contentForSample(s,id);return JSON.stringify([t.publishedAt,samplesFor(s,id)]);}
export function targetTime(t,p){if(!Object.hasOwn(samplingPeriods,p))throw Error('未知采样节点');return Date.parse(t.publishedAt)+samplingPeriods[p]*3600000;}
export function samplingTiming(t,x){const actual=Date.parse(x.sampledAt),published=Date.parse(t.publishedAt),target=targetTime(t,x.period),diff=actual-target;return {targetAt:new Date(target).toISOString(),conflict:actual<published,offsetMinutes:Math.round(diff/60000),label:actual<published?'发布时间已变化，采样早于发布，请核对':Math.abs(diff)<60000?'与目标时间一致':`${diff>0?'晚于':'早于'}目标 ${Math.floor(Math.abs(diff)/3600000)} 小时 ${Math.floor(Math.abs(diff)%3600000/60000)} 分钟`};}
export function validateSample(s,taskId,input,attachment,existingId=null,now=Date.now()){
 const t=contentForSample(s,taskId),old=existingId?(s.samples||[]).find(x=>x.id===existingId&&x.taskId===taskId):null;
 if(existingId&&!old)throw Error('没有找到该内容的采样记录');if(!input.ack)throw Error('请核对截图、指标与实际采样时间并勾选确认');
 const period=String(input.period);targetTime(t,period);if(old&&old.period!==period)throw Error('修改记录时不能改换采样节点');
 const sampled=Date.parse(input.sampledAt);if(!input.sampledAt||!Number.isFinite(sampled)||sampled>now+60000)throw Error('请填写实际采样时间，不能晚于当前时间');if(sampled<Date.parse(t.publishedAt))throw Error('采样时间不能早于实际发布时间');
 if(!['播放','浏览'].includes(input.viewsName))throw Error('请选择实际指标名称：播放或浏览');
 const metrics=Object.entries(samplingLabels).map(([key,name])=>{const raw=input[key];const value=raw==null||String(raw).trim()===''?null:Number(raw);if(value!==null&&(!Number.isSafeInteger(value)||value<0))throw Error('指标须为非负安全整数，缺失请留空');return {key,name:key==='views'?input.viewsName:name,value,unit:'次'};});
 if(metrics.every(m=>m.value===null))throw Error('请至少填写一项已核对的指标，缺失项留空');
 const sourceNote=String(input.sourceNote||'').trim();if(sourceNote.length>2000)throw Error('来源说明请控制在 2000 字以内');if(!attachment&&!sourceNote)throw Error('未提供截图时，请说明数据来源和截图缺失原因');
 if(attachment&&(!/^[a-f0-9]{64}\.(png|jpg|webp)$/.test(attachment.id||'')||attachment.sha256!==attachment.id.split('.')[0]||attachment.path!=='06-附件/数据采样/'+attachment.id))throw Error('截图附件校验失败，请重新选择');
 const duplicate=(s.samples||[]).find(x=>x.id!==existingId&&(x.taskId===taskId&&Date.parse(x.sampledAt)===sampled||attachment&&[x,...(x.history||[])].some(v=>v.screenshot?.sha256===attachment.sha256)));
 if(duplicate)throw Error('这次采样时间或截图已保存，不能复制成另一条独立采样；请编辑原记录');
 return {period,sampledAt:new Date(sampled).toISOString(),metrics,sourceNote,screenshot:attachment?structuredClone(attachment):null,...(input.recognition!==undefined?{recognition:validateRecognition(input.recognition,attachment,now)}:{})};
}
export function saveContentSample(s,taskId,input,attachment,existingId,guard,now=Date.now()){
 if(guard!==samplingGuard(s,taskId))throw Error('发布时间或采样记录已变化，请重新打开核对');
 const values=validateSample(s,taskId,input,attachment,existingId,now),t=contentForSample(s,taskId),old=existingId?(s.samples||[]).find(x=>x.id===existingId):null;
 if(old&&JSON.stringify(Object.fromEntries(Object.keys(values).map(k=>[k,old[k]])))===JSON.stringify(values)&&old.publishedAtSnapshot===t.publishedAt)return {record:old,changed:false};
 const history=old?[...(old.history||[]),Object.fromEntries(Object.entries(old).filter(([k])=>k!=='history'))]:[];
 const record={id:old?.id||uid(),taskId,testOnly:Boolean(t.testOnly),...values,publishedAtSnapshot:t.publishedAt,confirmedAt:now,createdAt:old?.createdAt||now,revision:(old?.revision||0)+1,history};
 s.samples??=[];if(old)s.samples[s.samples.indexOf(old)]=record;else s.samples.push(record);
 for(const report of s.contentReports||[])if(old&&report.taskId===taskId&&report.sampleIds?.includes(old.id)){report.needsReview=true;report.reviewReasons=[...new Set([...(report.reviewReasons||[]),'采样记录已修改'])];}
 return {record,changed:true};
}
export function markPublicationChange(s,t,next){if(t.publishedAt===next)return;for(const r of s.contentReports||[])if(r.taskId===t.id){r.needsReview=true;r.reviewReasons=[...new Set([...(r.reviewReasons||[]),'实际发布时间已修改'])];}}
export function ensureSamplingTest(s,now=Date.now()){
 let t=s.tasks.find(t=>t.samplingTest);if(t)return t;
 t={id:uid(),title:'【采样功能验收】测试内容（未真实发布）',status:'已发布、待复盘',stage:4,due:'',viewpoint:'仅验证数据采样，不代表真实账号表现。',viewConfirmed:false,outline:'',outlineConfirmed:false,script:'',final:false,finalTitle:'',cover:false,assetIds:[],messages:[],publishedAt:new Date(now-8*86400000).toISOString(),publishedUrl:'',testOnly:true,samplingTest:true};s.tasks.push(t);return t;
}
