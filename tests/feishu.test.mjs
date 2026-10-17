import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import clientModule from '../obsidian-plugin/feishu-client.cjs';
import localModule from '../obsidian-plugin/local-store.cjs';
import {initialState,createTask} from '../src/store.js';
import {mergeFeishuSnapshot,topicRows,taskReferences} from '../src/feishu-topics.js';
import {views} from '../src/views.js';
const {FeishuClient,parseSource,cellText,cellLinks,normalizeRecord}=clientModule;
const config={appId:'cli_test',secretName:'feishu-test',sourceUrl:'https://my.feishu.cn/wiki/WikiTest',appToken:'baseTest',tableId:'tblTest',tableName:'选题',fields:{title:'标题',reference:'参考',links:'链接'}};
const record=(id='recOne',title='真实任务样本')=>({record_id:id,fields:{标题:[{type:'text',text:title}],参考:[{type:'text',text:'第一段\n'},{type:'text',text:'第二段'}],链接:{text:'参考链接',link:'https://example.com/material'}}});
const ok=data=>({status:200,json:{code:0,data}});
function fixture(handler){
 const calls=[];const request=async args=>{calls.push(args);const u=new URL(args.url);assert.equal(u.origin,'https://open.feishu.cn');if(u.pathname.endsWith('/tenant_access_token/internal'))return {status:200,json:{code:0,tenant_access_token:'TOKEN_FOR_TEST_ONLY',expire:7200}};return handler(u,args);};
 return {calls,client:new FeishuClient({request,getCredentials:()=>({appId:'cli_test',appSecret:'SECRET_FOR_TEST_ONLY'})})};
}
test('only HTTPS Feishu wiki/base sources are accepted, including a selected table',()=>{
 assert.deepEqual(parseSource('https://my.feishu.cn/wiki/ABC?table=tblXYZ&from=x'),{kind:'wiki',token:'ABC',tableId:'tblXYZ',url:'https://my.feishu.cn/wiki/ABC'});
 assert.equal(parseSource('https://tenant.feishu.cn/base/Base1').kind,'base');
 for(const url of ['http://my.feishu.cn/wiki/ABC','https://my.feishu.cn.evil.test/wiki/ABC','https://x:pass@my.feishu.cn/wiki/ABC','https://my.feishu.cn:8443/base/ABC','file:///base/A','https://my.feishu.cn/docx/ABC'])assert.throws(()=>parseSource(url));
});
test('rich text, hyperlink and formula values preserve content while unsafe links are ignored',()=>{
 assert.equal(cellText([{text:'前半句'},{text:'后半句'}]),'前半句后半句');assert.equal(cellText({value:[{text:'公式结果'}]}),'公式结果');
 assert.equal(cellText({name:'not a text field',id:'person'}),'');
 assert.deepEqual(cellLinks([{link:'https://example.com/a',text:'链接'},'https://example.com/a', {link:'javascript:alert(1)'},'https://example.com/b']),['https://example.com/a','https://example.com/b']);
 const topic=normalizeRecord(record(),config,100);assert.equal(topic.reference,'第一段\n第二段');assert.equal(topic.feishu.recordId,'recOne');assert.equal(new URL(topic.feishu.url).searchParams.get('table'),'tblTest');
 assert.equal(normalizeRecord(record('recBlank','  '),config).missingTitle,true);
});
test('wiki resolution, scoped fields and full pagination use the documented read-only endpoints',async()=>{
 const {client,calls}=fixture(u=>{
  if(u.pathname.endsWith('/get_node')){assert.equal(u.searchParams.get('token'),'WikiTest');return ok({node:{obj_type:'bitable',obj_token:'baseTest'}});}
  if(u.pathname.endsWith('/fields'))return ok({items:['标题','参考','链接'].map(field_name=>({field_name})),has_more:false});
  if(u.pathname.endsWith('/records')){assert.deepEqual(JSON.parse(u.searchParams.get('field_names')),['标题','参考','链接']);return u.searchParams.has('page_token')?ok({items:[record(),record('recTwo','第二个')],has_more:false}):ok({items:[record()],has_more:true,page_token:'next-page'});}
  throw Error('Unexpected endpoint');
 });
 assert.equal((await client.resolve(config.sourceUrl)).appToken,'baseTest');
 const result=await client.topics(config);assert.equal(result.topics.length,2);assert.equal(result.sourceKey,'baseTest:tblTest');
 assert.equal(calls.filter(x=>x.method==='POST').length,1);assert.ok(calls.filter(x=>x.method==='POST').every(x=>x.url.endsWith('/auth/v3/tenant_access_token/internal')));
 assert.ok(calls.filter(x=>x.method==='GET').every(x=>!x.body));assert.equal(calls.filter(x=>x.url.endsWith('/tenant_access_token/internal')).length,1);
 assert.ok(!JSON.stringify(result).includes('SECRET_FOR_TEST_ONLY'));assert.ok(!JSON.stringify(result).includes('TOKEN_FOR_TEST_ONLY'));
});
test('expired token refresh is bounded, and remote messages never expose credentials in visible errors',async()=>{
 let count=0;const {client,calls}=fixture(()=>{count++;return count===1?{status:200,json:{code:99991663,msg:'TOKEN_FOR_TEST_ONLY'}}:ok({node:{obj_type:'bitable',obj_token:'baseTest'}});});
 await client.resolve(config.sourceUrl);assert.equal(calls.filter(x=>x.method==='POST').length,2);
 const denied=fixture(()=>({status:403,json:{code:1254302,msg:'SECRET_FOR_TEST_ONLY'}}));await assert.rejects(denied.client.resolve(config.sourceUrl),err=>err.message.includes('权限')&&!err.message.includes('SECRET_FOR_TEST_ONLY'));
 const alwaysExpired=fixture(()=>({status:200,json:{code:99991663}}));await assert.rejects(alwaysExpired.client.resolve(config.sourceUrl));assert.equal(alwaysExpired.calls.filter(x=>x.method==='POST').length,2);
});
test('missing fields and broken pagination fail before any partial result can replace the cache',async()=>{
 const badFields=fixture(()=>ok({items:[{field_name:'标题'}],has_more:false}));await assert.rejects(badFields.client.topics(config),/字段/);assert.ok(!badFields.calls.some(x=>new URL(x.url).pathname.endsWith('/records')));
 const repeated=fixture(()=>ok({items:[],has_more:true,page_token:'same'}));await assert.rejects(repeated.client.tables('baseTest'),/分页异常/);
 const missing=fixture(()=>ok({has_more:false}));await assert.rejects(missing.client.tables('baseTest'),/不完整/);
 const slow=new FeishuClient({request:()=>new Promise(()=>{}),getCredentials:()=>({appId:'cli_test',appSecret:'test'}),timeoutMs:5});await assert.rejects(slow.resolve(config.sourceUrl),/网络/);
});
test('refresh updates candidates without overwriting local drafts or source snapshots; repeated start is idempotent',()=>{
 const s=initialState(),first=normalizeRecord(record(),config,100);
 mergeFeishuSnapshot(s,{topics:[first],sourceKey:'baseTest:tblTest',syncedAt:100});
 const {task}=createTask(s,first.id);assert.equal(task.references,'第一段\n第二段\n\nhttps://example.com/material');assert.equal(task.sourceSnapshot.feishu.recordId,'recOne');task.script='用户已经修改的稿件';task.references='用户增补资料';
 const next=normalizeRecord(record('recOne','在飞书改了标题'),config,200);next.reference='改过的参考';mergeFeishuSnapshot(s,{topics:[next],sourceKey:'baseTest:tblTest',syncedAt:200});
 const again=createTask(s,first.id);assert.equal(again.created,false);assert.equal(again.task.script,'用户已经修改的稿件');assert.equal(again.task.references,'用户增补资料');assert.equal(again.task.sourceSnapshot.reference,'第一段\n第二段');
 mergeFeishuSnapshot(s,{topics:[],sourceKey:'baseTest:tblTest',syncedAt:300});assert.equal(topicRows(s,{feishuSupported:true,feishu:{sourceKey:'baseTest:tblTest'}}).length,0);assert.equal(createTask(s,first.id).task.id,task.id);
 const other=normalizeRecord(record(),{...config,tableId:'tblOther'});mergeFeishuSnapshot(s,{topics:[other],sourceKey:'baseTest:tblOther',syncedAt:400});assert.equal(createTask(s,other.id).created,true);
 assert.equal(taskReferences(task,s,{btn:()=>''}).includes('第一段'),true);
});
test('unconfigured native Feishu view never masquerades sample rows as remote topics',()=>{
 const s=initialState();let html=views.topics(s,{feishuSupported:true,feishu:{}});assert.ok(html.includes('配置飞书连接'));assert.ok(!html.includes(s.topics[0].title));assert.ok(html.includes('未连接'));
 html=views.topics(s,{feishuSupported:true,feishu:{},topicLibrary:'local'});assert.ok(html.includes(s.topics[0].title));assert.ok(html.includes('示例选题'));
 const x=normalizeRecord(record('recOne','<img src=x onerror=alert(1)>'),config);mergeFeishuSnapshot(s,{topics:[x],sourceKey:'baseTest:tblTest',syncedAt:100});html=views.topics(s,{feishuSupported:true,feishu:{configured:true,secretReady:true,sourceKey:'baseTest:tblTest'}});assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));
});
test('native connection config persists only names and source mapping, never secret values',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'creator-feishu-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const filename=path.resolve('obsidian-plugin/feishu-integration.cjs'),require=createRequire(filename),module={exports:{}};
 const obsidian={Modal:class{},Setting:class{},SecretComponent:class{},requestUrl:async()=>{throw Error('unused');}};
 new Function('require','module','exports',fs.readFileSync(filename,'utf8'))(name=>name==='obsidian'?obsidian:require(name),module,module.exports);
 const plugin={pluginDir:root,disk:new localModule.LocalStore(root),app:{secretStorage:{getSecret:()=> 'SECRET_FOR_TEST_ONLY'}}};
 const integration=new module.exports.FeishuIntegration(plugin);integration.save({...config,appSecret:'SECRET_FOR_TEST_ONLY',tenant_access_token:'TOKEN_FOR_TEST_ONLY'});
 const stored=fs.readFileSync(path.join(root,'feishu.json'),'utf8');assert.ok(!stored.includes('SECRET_FOR_TEST_ONLY'));assert.ok(!stored.includes('TOKEN_FOR_TEST_ONLY'));
 assert.equal(integration.status().secretReady,true);assert.ok(!JSON.stringify(integration.status()).includes('SECRET_FOR_TEST_ONLY'));
 const state=initialState();const topic=normalizeRecord(record(),config);mergeFeishuSnapshot(state,{topics:[topic],sourceKey:'baseTest:tblTest',syncedAt:100});createTask(state,topic.id);plugin.disk.setItem(localModule.KEY,JSON.stringify(state));plugin.disk.exportNotes();assert.ok(!fs.readFileSync(plugin.disk.file,'utf8').includes('SECRET_FOR_TEST_ONLY'));
});
