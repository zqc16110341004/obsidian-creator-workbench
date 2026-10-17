import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,createStore} from '../src/store.js';
import {directionContext,parseDirections,directionCards,adoptDirection,findDirection} from '../src/viewpoint-directions.js';
import {acceptJob,writingPrompt,writingPanel} from '../src/ai-writing.js';
import {pendingReviews} from '../src/content-review.js';

const data=()=>({status:'directions',summary:'现有资料提出了问题，还没有独立验证。',directions:[{title:'先明确下一步',claim:'每次结束时记录下一步，可能比增加工具更有用。',audience:'刚开始口播的新手',evidence:['材料提到切换工具时需要重新找进度。'],gaps:['需要作者提供一次真实的恢复创作经历。']},{title:'减少资料入口',claim:'减少同一选题的资料入口，可能降低整理成本。',audience:'收藏很多资料但还没开始写稿的人',evidence:['当前资料描述了信息分散的困扰。'],gaps:['缺少整理前后对比，效果待验证。']}],question:'你最近一次卡住，主要是在找资料，还是不知道下一步？'});
function setup(){const t=initialState().tasks[0];t.viewpoint='';t.viewConfirmed=false;t.messages=[{role:'user',provider:'codex',kind:'viewpoints',text:'梳理观点',jobId:'job',sourceContext:directionContext(t)}];t.aiJob={id:'job',status:'running'};return t;}
function complete(t,text=JSON.stringify(data())){acceptJob(t,{id:'job',taskId:t.id,status:'completed',text});return t.messages.find(m=>m.role==='assistant');}

test('accepts two/three directions and needs-material without inventing candidates',()=>{
 assert.equal(parseDirections(JSON.stringify(data())).directions.length,2);
 assert.equal(parseDirections('```json\n'+JSON.stringify(data())+'\n```').directions.length,2);
 const insufficient={status:'needs_material',summary:'还没有主题或可用资料。',directions:[],question:'你想讨论的具体问题是什么？'};
 assert.deepEqual(parseDirections(JSON.stringify(insufficient)),insufficient);
});
test('rejects malformed, oversized, duplicate, incomplete or mixed-format results',()=>{
 for(const raw of ['hello','{}','null',JSON.stringify({...data(),directions:[data().directions[0]]}),JSON.stringify({...data(),directions:[data().directions[0],data().directions[0]]}),JSON.stringify({...data(),question:''}),'prefix '+JSON.stringify(data()),'a'.repeat(30001)])assert.equal(parseDirections(raw),null);
 const invalid=data();invalid.directions[0].gaps=[];assert.equal(parseDirections(JSON.stringify(invalid)),null);
});
test('valid completion persists cards once but never changes the author viewpoint or confirmations',()=>{
 const t=setup(),before={viewpoint:t.viewpoint,viewConfirmed:t.viewConfirmed,outline:t.outline,script:t.script};const m=complete(t);complete(t);
 assert.deepEqual({viewpoint:t.viewpoint,viewConfirmed:t.viewConfirmed,outline:t.outline,script:t.script},before);
 assert.equal(t.messages.filter(m=>m.role==='assistant').length,1);assert.equal(m.directions.directions.length,2);assert.ok(m.text.includes('核心主张'));assert.equal(m.rawText,JSON.stringify(data()));
});
test('cancelled, failed and foreign-task responses cannot create cards; invalid text is retained',()=>{
 const t=setup();for(const status of ['cancelled','failed','unknown'])acceptJob(t,{id:'job',taskId:t.id,status,text:JSON.stringify(data())});
 assert.equal(t.messages.length,1);acceptJob(t,{id:'job',taskId:'different',status:'completed',text:JSON.stringify(data())});assert.equal(t.messages.length,1);
 const m=complete(t,'没有按要求返回 JSON');assert.equal(m.text,'没有按要求返回 JSON');assert.ok(m.directionError);assert.equal(m.directions,undefined);
});
test('normal chat does not parse JSON as automatic viewpoint suggestions',()=>{
 const t=setup();t.messages[0].kind='chat';const m=complete(t);assert.equal(m.directions,undefined);assert.equal(m.text,JSON.stringify(data()));
});
test('adopting an edited direction remains unconfirmed, preserves old text and invalidates dependents',()=>{
 const t=setup();t.viewpoint='原来观点';t.viewConfirmed=true;t.final=true;t.finalTitle='原来标题';t.cover=true;t.messages[0].sourceContext=directionContext(t);complete(t);
 const script=t.script;adoptDirection(t,'job',0,'这是我修改后的真实判断');
 assert.equal(t.viewpoint,'这是我修改后的真实判断');assert.equal(t.viewConfirmed,false);assert.equal(t.stage,0);assert.equal(t.script,script);
 assert.ok(t.messages.some(m=>m.provider==='local'&&m.text.includes('原来观点')));assert.ok(pendingReviews(t).includes('script'));assert.equal(t.messages[1].selectedDirection,0);
});
test('changed source needs explicit acknowledgement; invalid selections and blank adoption do not mutate',()=>{
 const t=setup();complete(t);t.references='新增资料';const before=structuredClone(t);
 assert.throws(()=>adoptDirection(t,'job',0,'我的判断'),/资料已有变化/);assert.deepEqual(t,before);
 assert.equal(findDirection(t,'job',-1),null);assert.equal(findDirection(t,'job',0.5),null);assert.equal(findDirection(t,'other',0),null);
 assert.throws(()=>adoptDirection(t,'job',0,' ',true),/请填写/);assert.deepEqual(t,before);
 adoptDirection(t,'job',0,'核对后仍采用',true);assert.equal(t.viewpoint,'核对后仍采用');
});
test('cards escape untrusted output and preserve the expanded chat composer',()=>{
 const t=setup(),d=data();d.directions[0].claim='<img src=x onerror=alert(1)>';const m=complete(t,JSON.stringify(d));
 const html=directionCards(m,t)+writingPanel(t,{});assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('选择并修改这个方向'));assert.ok(html.includes('给 AI 的要求'));
});
test('candidate selection and provenance survive storage; structured requirements only apply to explicit exploration',()=>{
 const t=setup();complete(t);adoptDirection(t,'job',1,'我倾向这个方向');const s=initialState();s.tasks=[t];s.activeTaskId=t.id;let raw=JSON.stringify(s);
 const storage={getItem:()=>raw,setItem:(_,v)=>raw=v};createStore(storage).save();const restored=createStore(storage).state.tasks[0];
 assert.equal(restored.messages[1].selectedDirection,1);assert.equal(restored.viewConfirmed,false);assert.equal(restored.messages[1].directions.directions.length,2);
 assert.ok(writingPrompt(t,[],'梳理','viewpoints').includes('只返回一个 JSON 对象'));assert.ok(!writingPrompt(t,[],'普通讨论').includes('只返回一个 JSON 对象'));
});
