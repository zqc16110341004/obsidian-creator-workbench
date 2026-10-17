import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,createStore} from '../src/store.js';
import {changeContent,needsReview,confirmStage} from '../src/content-review.js';
import {titleBases,titleInput,titleContext,parseTitles,titlesText,titleCards,findTitle,adoptTitle,titlePanel} from '../src/title-candidates.js';
import {acceptJob,writingPrompt,writingPanel} from '../src/ai-writing.js';
const data=()=>({status:'titles',summary:'基于现有材料的三个方向，仍需作者核对。',candidates:[{title:'先找一个例子，再选今天的口播题',angle:'行动建议',reason:'观点强调有例子可讲。',caution:'不代表已经验证效果。'},{title:'收藏很多灵感，今天到底讲哪条？',angle:'具体困扰',reason:'资料是新手难以选题的假设场景。',caution:'不能说所有新手都有这个问题。'},{title:'让一个小问题，带出一条口播',angle:'收窄问题',reason:'先筛选能回答的小问题。',caution:'需要补上实际候选题。'}]});
function setup(){const t=initialState().tasks[0];t.final=true;const meta=titleInput(t,'script','不使用效果承诺');t.messages=[{role:'user',provider:'codex',kind:'titles',jobId:'t1',text:'拟题',titleBasis:meta}];t.aiJob={id:'t1',status:'running'};return {t,meta};}
function complete(t,raw=JSON.stringify(data())){acceptJob(t,{taskId:t.id,id:'t1',status:'completed',text:raw});return t.messages.find(m=>m.role==='assistant');}

test('early title exploration accepts unconfirmed viewpoint and draft script with explicit status',()=>{
 const t=initialState().tasks[0];t.outline='';t.script='';t.viewConfirmed=false;assert.equal(titleInput(t).basis,'viewpoint');assert.equal(titleInput(t).basisStatus,'尚未确认');
 t.viewpoint='';assert.throws(()=>titleInput(t),/补充/);
 const draft=initialState().tasks[0];assert.equal(titleInput(draft).basisStatus,'尚未定稿');assert.throws(()=>titleInput(draft,'script','x'.repeat(1001)),/1000/);
});
test('outdated downstream cannot be used as title basis while current viewpoint remains available',()=>{
 const {t}=setup();changeContent(t,'viewpoint','新的当前判断');assert.deepEqual(titleBases(t).map(x=>x.key),['viewpoint']);assert.throws(()=>titleInput(t,'script'),/复核/);confirmStage(t,'viewpoint');assert.deepEqual(titleBases(t).map(x=>x.key),['viewpoint']);
});
test('title prompt contains only selected basis and reference, not stale downstream or chat',()=>{
 const {t}=setup();t.script='不应发送的旧稿';t.messages.push({role:'assistant',provider:'codex',text:'不应发送的旧对话'});const meta=titleInput(t,'viewpoint');const prompt=writingPrompt(t,[],'生成标题','titles',meta);
 assert.ok(prompt.includes(meta.basisText));assert.ok(!prompt.includes('不应发送的旧稿'));assert.ok(!prompt.includes('不应发送的旧对话'));assert.ok(prompt.includes('titleBasis'));assert.ok(prompt.includes('未填不推断偏好'));
});
test('parser enforces shape, range, uniqueness and a truthful needs-material state',()=>{
 const d=data();assert.equal(parseTitles(JSON.stringify(d)).candidates.length,3);assert.equal(parseTitles('```json\n'+JSON.stringify(d)+'\n```').status,'titles');
 for(const raw of ['{}','null','prefix '+JSON.stringify(d),'x'.repeat(20001),JSON.stringify({...d,candidates:d.candidates.slice(0,2)}),JSON.stringify({...d,candidates:[d.candidates[0],{...d.candidates[0],title:d.candidates[0].title+'！'},d.candidates[2]]}),JSON.stringify({...d,status:'needs_material'}),JSON.stringify({...d,candidates:d.candidates.map(c=>({...c,caution:''}))})])assert.equal(parseTitles(raw),null);
 const missing={status:'needs_material',summary:'请补充想表达的一个具体判断。',candidates:[]};assert.deepEqual(parseTitles(JSON.stringify(missing)),missing);
});
test('generation is task scoped and idempotent and never selects or changes content',()=>{
 const {t}=setup();const before={title:t.finalTitle,script:t.script,stage:t.stage};acceptJob(t,{taskId:'other',id:'t1',status:'completed',text:JSON.stringify(data())});assert.equal(t.messages.length,1);const m=complete(t);complete(t);assert.equal(t.messages.length,2);assert.equal(m.titleCandidates.candidates.length,3);assert.equal(m.text,titlesText(data()));assert.deepEqual({title:t.finalTitle,script:t.script,stage:t.stage},before);
});
test('cancel and failure do not create candidates, malformed result preserves raw text without adoption button',()=>{
 const {t}=setup();for(const status of ['failed','cancelled','unknown'])acceptJob(t,{taskId:t.id,id:'t1',status,text:JSON.stringify(data())});assert.equal(t.messages.length,1);
 const m=complete(t,'格式不符合');assert.ok(m.titleError);assert.equal(m.text,'格式不符合');assert.ok(!writingPanel(t,{}).includes('data-action="ai-adopt"'));
});
test('stale basis or reference blocks adoption atomically; blank and invalid index are rejected',()=>{
 const {t}=setup();complete(t);assert.equal(findTitle(t,'t1',0).stale,false);assert.equal(findTitle(t,'t1',0.5),null);assert.throws(()=>adoptTitle(t,'t1',0,' '));t.references='新资料';const before=structuredClone(t);assert.throws(()=>adoptTitle(t,'t1',0,'新标题'),/已有变化/);assert.deepEqual(t,before);
});
test('edited selection preserves old title and cover and marks cover/publication for review',()=>{
 const {t}=setup();t.finalTitle='旧标题';t.cover=true;t.coverRequest='原封面';const script=t.script;complete(t);adoptTitle(t,'t1',1,'我修改后的标题');
 assert.equal(t.finalTitle,'我修改后的标题');assert.equal(t.script,script);assert.equal(t.final,true);assert.equal(t.stage,3);assert.deepEqual(t.coverSnapshot,{title:'旧标题',request:'原封面'});assert.ok(needsReview(t,'cover'));assert.ok(needsReview(t,'publish'));assert.ok(t.messages.some(m=>m.provider==='local'&&m.text.includes('旧标题')));assert.equal(t.messages[1].selectedTitle.text,'我修改后的标题');
 const n=t.messages.length;adoptTitle(t,'t1',1,'我修改后的标题');assert.equal(t.messages.length,n);
});
test('cards escape model output and persist source labels and edited adoption on reload',()=>{
 const {t}=setup(),d=data();d.candidates[0].title='<img src=x onerror=1>';const m=complete(t,JSON.stringify(d));const html=titleCards(m,t);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(html.includes('口播稿'));adoptTitle(t,'t1',0,'测试标题');
 const s=initialState();s.tasks=[t];let raw=JSON.stringify(s);const storage={getItem:()=>raw,setItem:(_,v)=>raw=v};createStore(storage).save();const restored=createStore(storage).state.tasks[0];assert.equal(restored.messages[1].selectedTitle.text,'测试标题');assert.equal(findTitle(restored,'t1',0).stale,false);
});
test('title page removes hardcoded unrelated titles and keeps manual entry without a host',()=>{
 const {t}=setup();assert.ok(titlePanel(t,{}).includes('真实生成请在 Obsidian'));complete(t);assert.ok(titlePanel(t,{codexSupported:true}).includes('重新生成标题候选'));assert.ok(titlePanel(t,{codexSupported:true}).includes('选择并修改标题'));
});
