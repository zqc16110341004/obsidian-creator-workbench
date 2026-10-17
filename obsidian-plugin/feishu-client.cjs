const API = 'https://open.feishu.cn/open-apis';
const DEFAULT_SOURCE = '';
const TOKEN_ERRORS = new Set([99991663,99991664,99991668,99991671]);

function parseSource(value) {
  let u;
  try { u = new URL(String(value).trim()); } catch { throw Error('请填写飞书多维表格的完整链接'); }
  if (u.protocol !== 'https:' || !/(^|\.)feishu\.cn$/.test(u.hostname) || u.username || u.password || u.port) throw Error('仅支持 https 的飞书表格或知识库链接');
  const m = u.pathname.match(/^\/(wiki|base)\/([A-Za-z0-9]+)\/?$/);
  if (!m) throw Error('请使用含 /wiki/ 或 /base/ 的多维表格链接');
  const tableId = u.searchParams.get('table') || '';
  if (tableId && !/^tbl[A-Za-z0-9]+$/.test(tableId)) throw Error('链接中的数据表标识不正确');
  return {kind:m[1],token:m[2],tableId,url:`https://${u.hostname}/${m[1]}/${m[2]}`};
}
function safeUrl(value) { try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; } }
function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(cellText).filter(Boolean).join('');
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (typeof value.link === 'string') return safeUrl(value.link);
    if ('value' in value) return cellText(value.value);
  }
  return '';
}
function cellLinks(value) {
  const links = [];
  function visit(v) {
    if (typeof v === 'string') {
      for (const m of v.matchAll(/https?:\/\/[^\s<>"，。；）\]]+/g)) { const url = safeUrl(m[0]); if (url) links.push(url); }
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') { if (v.link) visit(v.link); if (v.text) visit(v.text); if (v.value) visit(v.value); }
  }
  visit(value); return [...new Set(links)];
}
function sourceKey(config) { return `${config.appToken}:${config.tableId}`; }
function normalizeRecord(record, config, now = Date.now()) {
  if (!record || !/^rec[A-Za-z0-9]+$/.test(record.record_id) || !record.fields || typeof record.fields !== 'object') throw Error('飞书返回了不完整的记录，本次刷新未保存');
  const title = cellText(record.fields[config.fields.title]).trim();
  const links = cellLinks(record.fields[config.fields.links]);
  const source = parseSource(config.sourceUrl);
  const recordUrl = new URL(source.url);
  recordUrl.searchParams.set('table',config.tableId); recordUrl.searchParams.set('record',record.record_id);
  return {
    id:`feishu:${sourceKey(config)}:${record.record_id}`,title:title || '未填写标题',
    reference:cellText(record.fields[config.fields.reference]),source:'飞书选题',url:links[0] || '',links,
    missingTitle:!title,
    feishu:{appToken:config.appToken,tableId:config.tableId,recordId:record.record_id,url:recordUrl.href},syncedAt:now
  };
}
function apiError(code, status) {
  if (status === 429 || code === 1254290) return Error('飞书请求过于频繁，请稍后手动刷新');
  if (status === 401 || TOKEN_ERRORS.has(code)) return Error('飞书凭证已失效，请检查应用密钥并重新连接');
  if (status === 403 || [99991672,99991679,131006,1254302,1254304].includes(code)) return Error(`飞书拒绝访问（${code || status}）。请确认已开通只读权限，并把应用加入原表协作者；知识库链接还需节点读取权限。`);
  if ([10003,10014,10015,10016,20002,99991661].includes(code)) return Error(`应用凭证不可用（${code}），请核对 App ID、密钥与应用发布状态`);
  return Error(`飞书读取未完成（${Number.isFinite(code) ? code : status || '未知'}）。请检查表格权限和连接设置，已有缓存会保留。`);
}
class FeishuClient {
  constructor({request,getCredentials,now=Date.now,timeoutMs=15000}) {
    this.request=request; this.getCredentials=getCredentials; this.now=now; this.timeoutMs=timeoutMs; this.token=null; this.tokenPromise=null;
  }
  async send(path,{method='GET',body,token}={}) {
    // Only the native client builds requests to the fixed Feishu origin.
    if (!path.startsWith('/') || path.startsWith('//')) throw Error('飞书接口地址不正确');
    let timer;
    try {
      return await Promise.race([
        this.request({url:API+path,method,headers:{'Content-Type':'application/json; charset=utf-8',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),throw:false}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),this.timeoutMs);})
      ]);
    } catch { throw Error('暂时无法连接飞书，请检查网络后手动重试；已有缓存会保留'); }
    finally { clearTimeout(timer); }
  }
  async accessToken() {
    if (this.token && this.token.until>this.now()) return this.token.value;
    if (this.tokenPromise) return this.tokenPromise;
    this.tokenPromise=(async()=>{
      const {appId,appSecret}=await this.getCredentials();
      if (!/^cli_[A-Za-z0-9]+$/.test(appId || '') || !appSecret) throw Error('请先在飞书连接设置中填写应用 ID，并选择 App Secret');
      const result=await this.send('/auth/v3/tenant_access_token/internal',{method:'POST',body:{app_id:appId,app_secret:appSecret}});
      const j=result.json;
      if (result.status!==200 || j?.code!==0 || typeof j.tenant_access_token!=='string' || !Number.isFinite(j.expire) || j.expire<=0) throw apiError(j?.code,result.status);
      this.token={value:j.tenant_access_token,until:this.now()+Math.max(0,j.expire-60)*1000};
      return this.token.value;
    })();
    try { return await this.tokenPromise; } finally { this.tokenPromise=null; }
  }
  async get(path,refresh=true) {
    const result=await this.send(path,{token:await this.accessToken()}), j=result.json;
    if (refresh && TOKEN_ERRORS.has(j?.code)) { this.token=null; return this.get(path,false); }
    if (result.status!==200 || j?.code!==0) throw apiError(j?.code,result.status);
    if (!j.data || typeof j.data!=='object') throw Error('飞书响应不完整，本次刷新未保存');
    return j.data;
  }
  async pages(path,params={},maxItems=5000) {
    const items=[], seen=new Set(); let cursor='';
    for (let i=0;i<50;i++) {
      const query=new URLSearchParams({...params,page_size:'100',...(cursor?{page_token:cursor}:{})});
      const data=await this.get(path+'?'+query);
      if (!Array.isArray(data.items)) throw Error('飞书列表响应不完整，本次刷新未保存');
      items.push(...data.items);
      if (items.length>maxItems) throw Error(`当前接入最多一次读取 ${maxItems} 条，请缩小数据表后重试；原缓存保留`);
      if (!data.has_more) return items;
      if (!data.page_token || seen.has(data.page_token)) throw Error('飞书分页异常，本次刷新未保存');
      cursor=data.page_token; seen.add(cursor);
    }
    throw Error('飞书分页数量超过本版限制，原缓存保留');
  }
  async resolve(sourceUrl) {
    const source=parseSource(sourceUrl);
    if (source.kind==='base') return {...source,appToken:source.token};
    const data=await this.get('/wiki/v2/spaces/get_node?'+new URLSearchParams({token:source.token}));
    if (data.node?.obj_type!=='bitable' || !/^[A-Za-z0-9]+$/.test(data.node.obj_token || '')) throw Error('该知识库节点不是多维表格，请提供原表链接');
    return {...source,appToken:data.node.obj_token};
  }
  async tables(appToken) { return this.pages(`/bitable/v1/apps/${encodeURIComponent(appToken)}/tables`,{},1000); }
  async fields(appToken,tableId) {
    if (!/^[A-Za-z0-9]+$/.test(appToken || '') || !/^tbl[A-Za-z0-9]+$/.test(tableId || '')) throw Error('请先选择一个有效数据表');
    return this.pages(`/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,{},1000);
  }
  async topics(config) {
    const fields=await this.fields(config.appToken,config.tableId), names=new Set(fields.map(x=>x.field_name));
    for (const field of Object.values(config.fields || {}).filter(Boolean)) if (!names.has(field)) throw Error(`飞书字段「${field}」已不存在，请重新选择字段；原缓存保留`);
    if (!config.fields?.title) throw Error('请先确认选题标题字段');
    const records=await this.pages(`/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records`,{field_names:JSON.stringify([...new Set(Object.values(config.fields).filter(Boolean))])});
    const now=this.now(), byId=new Map();
    for (const record of records) { const topic=normalizeRecord(record,config,now); byId.set(topic.id,topic); }
    return {topics:[...byId.values()],sourceKey:sourceKey(config),syncedAt:now};
  }
}
module.exports={FeishuClient,DEFAULT_SOURCE,parseSource,cellText,cellLinks,safeUrl,normalizeRecord,sourceKey};
