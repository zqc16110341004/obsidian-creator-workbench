import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {initialState,createStore} from '../src/store.js';
import {changeContent,needsReview,confirmStage} from '../src/content-review.js';
import {eligibleAssets,registerAsset,recommendationInput,assetSnapshot,assetContext,parseRecommendations,findRecommendation,selectAsset,removeAsset,selectedAssetContext,adaptationRequest,assetsPanel,assetSource,recommendationCards} from '../src/asset-recommendations.js';
import {acceptJob,writingPrompt,writingPanel} from '../src/ai-writing.js';
const formal=()=>registerAsset({type:'结构',name:'问题到行动',method:'先说问题，再给判断和一步行动。',scene:'观点型内容',source:'作者手工总结，未关联外部作品',report:'人工登记：暂无视频拆解报告，待实际内容验证。'});
const result=a=>({status:'matches',summary:'可考虑这条结构方法。',recommendations:[{assetId:a.id,reason:'当前观点包含筛选问题与可执行动作。',usage:'在提纲中组织问题、判断和下一步。',caution:'不把假设说成已验证效果。'}]});
function setup(){const s=initialState();const t=s.tasks[0];const a=formal();s.assets.push(a);const meta=recommendationInput(t,s.assets);t.aiJob={id:'r1',status:'running'};t.messages=[{role:'user',provider:'codex',kind:'assets',jobId:'r1',text:'推荐',sourceContext:meta.sourceContext,assetCatalog:meta.catalog,examples:meta.examples}];return {s,t,a,meta};}
function finish(t,a,raw=JSON.stringify(result(a))){acceptJob(t,{taskId:t.id,id:'r1',status:'completed',text:raw});return t.messages.at(-1);}

test('formal library excludes demo, tests and unconfirmed legacy; explicit examples remain labelled',()=>{
 const a=formal(),s=initialState();assert.equal(eligibleAssets(s.assets).length,0);assert.equal(eligibleAssets(s.assets,true).length,2);
 const sample={...a,id:'test',testOnly:true},legacy={...a,id:'legacy',confirmedAt:undefined};assert.deepEqual(eligibleAssets([...s.assets,a,sample,legacy]).map(a=>a.id),[a.id]);
 assert.equal(eligibleAssets([sample],true).length,1);assert.match(assetSnapshot(sample).classification,/测试/);
});
test('manual registration requires source and report explanation and rejects unsafe links',()=>{
 const a=formal();assert.ok(a.confirmedAt);assert.equal(a.origin,'manual');assert.throws(()=>registerAsset({...a,source:''}));assert.throws(()=>registerAsset({...a,report:''}));assert.throws(()=>registerAsset({...a,sourceUrl:'javascript:alert(1)'}));
 assert.equal(registerAsset({...a,sourceUrl:'https://example.com/video'}).sourceUrl,'https://example.com/video');
});
test('recommendation is optional but gated on confirmed viewpoint and bounded library',()=>{
 const {t,a}=setup();assert.throws(()=>recommendationInput(t,[]),/没有/);t.viewConfirmed=false;assert.throws(()=>recommendationInput(t,[a]),/确认/);t.viewConfirmed=true;
 assert.throws(()=>recommendationInput(t,Array.from({length:101},(_,i)=>({...a,id:String(i)}))),/容量/);
 const html=assetsPanel(t,initialState().assets,{});assert.match(html,/还没有可推荐/);assert.match(html,/直接继续写稿/);
});
test('parser rejects fabricated IDs, duplicates, malformed responses and false no-match',()=>{
 const a=formal(),catalog=[assetSnapshot(a)],d=result(a);assert.equal(parseRecommendations(JSON.stringify(d),catalog).recommendations.length,1);
 assert.equal(parseRecommendations('```json\n'+JSON.stringify(d)+'\n```',catalog).status,'matches');
 for(const bad of ['bad','null','x'.repeat(20001),JSON.stringify({...d,recommendations:[{...d.recommendations[0],assetId:'made-up'}]}),JSON.stringify({...d,recommendations:[d.recommendations[0],d.recommendations[0]]}),JSON.stringify({...d,status:'no_match'})])assert.equal(parseRecommendations(bad,catalog),null);
 assert.equal(parseRecommendations(JSON.stringify({status:'no_match',summary:'现有方法不适合本题，可跳过。',recommendations:[]}),catalog).status,'no_match');
});
test('successful results persist once without selection or content edits; failures never become cards',()=>{
 const {t,a}=setup(),old=t.script;const m=finish(t,a);finish(t,a);assert.ok(m.assetRecommendations);assert.equal(t.messages.length,2);assert.equal(t.script,old);assert.deepEqual(t.assetIds,[]);
 const next=setup();for(const status of ['failed','cancelled','unknown'])acceptJob(next.t,{taskId:next.t.id,id:'r1',status,text:JSON.stringify(result(next.a))});assert.equal(next.t.messages.length,1);
 acceptJob(next.t,{taskId:'other',id:'r1',status:'completed',text:JSON.stringify(result(next.a))});assert.equal(next.t.messages.length,1);
 const invalid=finish(next.t,next.a,'不是有效推荐');assert.ok(invalid.assetError);assert.equal(invalid.text,'不是有效推荐');assert.ok(!writingPanel(next.t,{},[next.a]).includes('data-action="ai-adopt"'));
});
test('changed viewpoint, reference or asset invalidates old recommendations',()=>{
 const {t,a,s}=setup();finish(t,a);assert.ok(findRecommendation(t,s.assets,'r1',a.id));t.references='新资料';assert.equal(findRecommendation(t,s.assets,'r1',a.id),null);delete t.references;
 t.viewConfirmed=false;assert.equal(findRecommendation(t,s.assets,'r1',a.id),null);t.viewConfirmed=true;a.method+='新方法';assert.equal(findRecommendation(t,s.assets,'r1',a.id),null);
});
test('selection is explicit and deduplicated; removing preserves history and flags existing downstream work',()=>{
 const {t,a}=setup();const before=t.script;assert.throws(()=>adaptationRequest(t,[a],a.id),/先选用/);
 assert.equal(selectAsset(t,a),true);assert.equal(selectAsset(t,a),false);assert.equal(t.assetUses.length,1);assert.equal(t.script,before);assert.ok(needsReview(t,'outline'));assert.ok(needsReview(t,'script'));
 assert.equal(t.assetUses[0].snapshot.source,a.source);assert.match(adaptationRequest(t,[a],a.id),/只适配/);
 removeAsset(t,a.id);assert.deepEqual(t.assetIds,[]);assert.ok(t.assetUses[0].endedAt);assert.throws(()=>adaptationRequest(t,[a],a.id));selectAsset(t,a);assert.equal(t.assetUses.length,2);
});
test('selection checks latest snapshot atomically and unconfirmed viewpoint blocks it',()=>{
 const {t,a}=setup(),expected=assetSnapshot(a);a.source='已变动来源';const before=structuredClone(t);assert.throws(()=>selectAsset(t,a,{expected}),/已变化/);assert.deepEqual(t,before);
 t.viewConfirmed=false;assert.throws(()=>selectAsset(t,a),/确认/);assert.deepEqual(t.assetIds,[]);
});
test('only selected snapshot enters adaptation; unchosen recommendation text stays out of later prompts',()=>{
 const {t,a,s,meta}=setup();finish(t,a);const d=result(a).recommendations[0];selectAsset(t,a,{recommendation:d,jobId:'r1'});a.method='后续更改不影响选用时快照';
 const selected=selectedAssetContext(t,s.assets);assert.equal(selected[0].method,t.assetUses[0].snapshot.method);assert.equal(selected[0].usage,d.usage);
 const prompt=writingPrompt(t,s.assets,'拟定提纲');assert.ok(!prompt.includes('可考虑这条结构方法'));assert.ok(!prompt.includes('后续更改不影响'));assert.ok(!prompt.includes('asset-question'));assert.ok(prompt.includes(d.usage));
 const recommend=writingPrompt(t,s.assets,'推荐','assets',meta);assert.ok(recommend.includes('assetCatalog'));assert.ok(!recommend.includes('asset-question'));
 changeContent(t,'viewpoint','新观点');confirmStage(t,'viewpoint');assert.deepEqual(selectedAssetContext(t,s.assets),[]);assert.throws(()=>adaptationRequest(t,s.assets,a.id),/复核/);
});
test('cards escape output and unsafe provenance URLs without losing source report',()=>{
 const {t,a,s}=setup();a.name='<img src=x onerror=1>';a.report='<script>bad</script>';a.sourceUrl='javascript:alert(1)';t.messages[0].assetCatalog=[assetSnapshot(a)];const m=finish(t,a);
 const html=recommendationCards(m,t,s.assets)+assetSource(a);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('来源与报告'));
});
test('usage snapshots and recommendation provenance survive save/reload and Markdown export',()=>{
 const {s,t,a}=setup();finish(t,a);selectAsset(t,a,{recommendation:result(a).recommendations[0],jobId:'r1'});let raw=JSON.stringify(s);const storage={getItem:()=>raw,setItem:(_,v)=>raw=v};createStore(storage).save();const saved=createStore(storage).state;
 assert.equal(saved.tasks[0].assetUses[0].snapshot.report,a.report);assert.ok(findRecommendation(saved.tasks[0],saved.assets,'r1',a.id));
 const require=createRequire(import.meta.url);const {documents}=require('../obsidian-plugin/local-store.cjs');const docs=documents(saved);assert.ok([...docs.values()].some(x=>x.includes('资产使用')&&x.includes('关联资产')));assert.ok([...docs.values()].some(x=>x.includes(a.report)));
});
