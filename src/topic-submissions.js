// The native journal is written before the request. Recovery never sends a request.
export function recoverSubmissions(s, records) {
 if(!Array.isArray(records)||records.some(r=>!r?.id||!r.payload||typeof r.payload.title!=='string'||!['prepared','unknown','sending','completed'].includes(r.status)||r.status==='completed'&&(!r.topic?.id||!r.topic.feishu?.appToken||!r.topic.feishu?.tableId)))throw Error('飞书提交日志不完整，页面记录保持不变');
 if(!records.length)return false;
 const before=JSON.stringify([s.topicSubmissions,s.topics,s.feishuSnapshots]);
 s.topicSubmissions??=[];
 for(const record of records){
  let local=s.topicSubmissions.find(x=>x.id===record.id);
  if(!local){local={id:record.id,originId:'',createdAt:record.createdAt};s.topicSubmissions.push(local);}
  if(local.completedAt&&record.status!=='completed')continue;
  Object.assign(local,{payload:structuredClone(record.payload),remoteStatus:record.status==='sending'?'unknown':record.status,error:record.error||''});
  if(record.status==='completed'){
   const topic=structuredClone(record.topic),existing=s.topics.find(t=>t.id===topic.id);
   if(local.originId)topic.originId=local.originId;
   if(!existing)s.topics.push(topic);
   else if(local.originId&&!existing.originId)existing.originId=local.originId;
   const key=`${topic.feishu.appToken}:${topic.feishu.tableId}`;
   s.feishuSnapshots??={};s.feishuSnapshots[key]??={ids:[],syncedAt:record.completedAt||record.createdAt};
   if(!s.feishuSnapshots[key].ids.includes(topic.id))s.feishuSnapshots[key].ids.push(topic.id);
   local.topicId=topic.id;local.completedAt=local.completedAt||record.completedAt||record.createdAt;
  }
 }
 return before!==JSON.stringify([s.topicSubmissions,s.topics,s.feishuSnapshots]);
}
