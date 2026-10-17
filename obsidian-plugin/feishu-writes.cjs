const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {sourceKey,normalizeRecord,safeUrl}=require('./feishu-client.cjs');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fingerprint=c=>createHash('sha256').update(JSON.stringify([c.appId,c.appToken,c.tableId,c.fields])).digest('hex');
function payload(input){const title=String(input.title||'').trim(),reference=String(input.reference||'').trim(),url=String(input.url||'').trim();if(!title||title.length>120||reference.length>20000)throw Error('标题须为 1–120 字，参考文案不能超过 20000 字');if(url&&!safeUrl(url))throw Error('请填写有效的 HTTP / HTTPS 资料链接');return {title,reference,url};}
function mappedFields(p,c,definitions){
 const out={},used=new Set();
 for(const key of ['title','reference','url']){const name=c.fields[key==='url'?'links':key];if(!p[key])continue;if(!name)throw Error(`请先为${{title:'标题',reference:'参考文案',url:'资料链接'}[key]}配置飞书字段，或在提交前移除该项`);if(used.has(name))throw Error('写入字段不能相互重叠，请重新配置映射');used.add(name);const f=definitions.find(f=>f.field_name===name);if(!f||![1,15].includes(f.type)||key!=='url'&&f.type!==1)throw Error(`字段「${name}」须为可写文本${key==='url'?'或超链接':''}类型`);out[name]=f.type===15?{text:p[key],link:p[key]}:p[key];}
 return out;
}
class FeishuWrites{
 constructor(integration){this.integration=integration;this.disk=integration.plugin.disk;this.file=path.join(this.disk.dir,'feishu-writes.json');this.busy=new Set();}
 load(){if(!fs.existsSync(this.file))return [];const j=JSON.parse(fs.readFileSync(this.file,'utf8'));if(!Array.isArray(j))throw Error('飞书提交日志不可读，请保留文件并检查');return j;}
 save(j){this.disk.atomic(this.file,JSON.stringify(j,null,2));}
 public(x){return {id:x.id,payload:x.payload,tableName:x.tableName,status:x.status==='sending'?'unknown':x.status,createdAt:x.createdAt,completedAt:x.completedAt||null,fields:{...x.config?.fields},error:x.error||'',topic:x.topic||null};}
 list(){return this.load().map(x=>this.public(x));}
 async prepare(id,input){if(!uuid.test(id||''))throw Error('提交编号无效');const p=payload(input),all=this.load(),old=all.find(x=>x.id===id);if(old){if(JSON.stringify(old.payload)!==JSON.stringify(p))throw Error('原提交内容不能改变，请保留原记录并新建草稿');return this.public(old);}const i=this.integration,c=structuredClone(i.config);if(!i.status().configured)throw Error('请先配置飞书连接');const fields=mappedFields(p,c,await i.client.fields(c.appToken,c.tableId));if(fingerprint(i.config)!==fingerprint(c))throw Error('连接已改变，请重新预览');const x={id,payload:p,fields,config:c,fingerprint:fingerprint(c),tableName:c.tableName||c.tableId,status:'prepared',createdAt:Date.now()};const latest=this.load();if(latest.some(x=>x.id===id))return this.prepare(id,input);latest.push(x);this.save(latest);return this.public(x);}
 async revise(id,input){if(this.busy.has(id))throw Error('正在提交，请等待结果');const p=payload(input),old=this.load().find(x=>x.id===id);if(!old)return this.prepare(id,p);if(old.status!=='prepared')throw Error('此提交已经发出，不能更改内容；请先核实原提交结果');const c=structuredClone(this.integration.config);const fields=mappedFields(p,c,await this.integration.client.fields(c.appToken,c.tableId));const all=this.load(),x=all.find(x=>x.id===id);if(this.busy.has(id)||x?.status!=='prepared'||fingerprint(c)!==fingerprint(this.integration.config))throw Error('提交状态或连接已变化，请重新打开');Object.assign(x,{payload:p,fields,config:c,fingerprint:fingerprint(c),tableName:c.tableName||c.tableId,editedAt:Date.now()});this.save(all);return this.public(x);}
 async confirm(id){if(this.busy.has(id))throw Error('这条选题正在提交，请稍候');this.busy.add(id);try{return await this.execute(id);}finally{this.busy.delete(id);}}
 async execute(id){const i=this.integration,all=this.load(),x=all.find(x=>x.id===id);if(!x)throw Error('请先预览并保存待提交内容');if(x.status==='completed')return this.public(x);if(fingerprint(i.config)!==x.fingerprint)throw Error('连接或字段映射已变化，请恢复原连接后核对这次提交');const save=()=>{const rows=this.load(),index=rows.findIndex(v=>v.id===id);rows[index]=x;this.save(rows);};
  // Read before any retry. Replay uses the original server idempotency token and exact payload.
  const snapshot=await i.client.topics(x.config);x.lastCheckedAt=Date.now();x.matches=snapshot.topics.filter(t=>t.title===x.payload.title&&t.reference===x.payload.reference&&(t.url||'')===x.payload.url).map(t=>t.feishu.recordId);save();
  const token=await i.client.accessToken();x.status='sending';x.error='';save();
  try{const r=await i.client.send(`/bitable/v1/apps/${x.config.appToken}/tables/${x.config.tableId}/records?client_token=${id}`,{method:'POST',token,body:{fields:x.fields}});if(r.status!==200||r.json?.code!==0)throw Error(`飞书未确认新增（${r.json?.code??r.status}）。请检查应用的「新增记录」权限及表格协作者权限；原提交编号保留。`);const record=r.json?.data?.record;if(!record?.record_id)throw Error('飞书未返回记录编号，结果待核实');x.topic=normalizeRecord({...record,fields:{...x.fields,...record.fields}},x.config);x.status='completed';x.completedAt=Date.now();x.error='';save();return this.public(x);}catch(err){x.status='unknown';x.error=err.message;save();return this.public(x);}
 }
}
module.exports={FeishuWrites,payload,mappedFields,fingerprint};
