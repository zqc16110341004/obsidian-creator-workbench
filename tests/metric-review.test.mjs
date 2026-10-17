import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,createStore} from '../src/store.js';
import {metricSnapshot,metricReport,metricReportStatus,metricGuard,saveMetrics,confirmMetricReport,editMetricReport,addMetricTodos,metricTodoLabel,metricReportPanel,metricComparison} from '../src/metric-review.js';
import {reviewExample as review,home} from '../src/views.js';
import core from '../obsidian-plugin/local-store.cjs';
const now=Date.now(),stamp=new Date(now-60000).toISOString();
const setup=()=>{const s=initialState();s.reviewSampleTimes={'7d':stamp,'24h':new Date(now-6*86400000).toISOString()};return s;};
const confirm=(s,p='7d')=>confirmMetricReport(s,p,metricGuard(s,p),true,now);
const change=(s,p='7d')=>saveMetrics(s,p,{...s.reviews[p],views:2000},s.reviewSampleTimes[p],now);
const edit=(s)=>editMetricReport(s,'7d',metricGuard(s,'7d'),{observations:'功能测试：当前记录为 2000 次播放，没有对照样本。',hypothesis:'原因待验证，不能归因于标题。',suggestion1:'下一条保留开场记录并收集反馈。'},true,now);

test('legacy sample displays without mutating state or inventing confirmation or sampling time',()=>{
 const s=initialState(),before=structuredClone(s),r=metricReport(s,'7d');assert.equal(r.basis.sampleAt,null);assert.equal(metricReportStatus(s,'7d'),'待确认');assert.ok(review(s,{}).includes('真实采样时间未记录'));assert.deepEqual(s,before);
});
test('changed metrics retain original report and basis; other period and user writing untouched',()=>{
 const s=setup();confirm(s);confirm(s,'24h');const before=structuredClone(s),r=metricReport(s,'7d');change(s);assert.equal(metricReportStatus(s,'7d'),'待复核');assert.equal(s.reviewReports['7d'].observations,r.observations);assert.equal(s.reviewReports['7d'].basis.metrics.views,1250);assert.equal(s.reviews['7d'].views,2000);assert.deepEqual(s.reviewReports['24h'],before.reviewReports['24h']);assert.deepEqual(s.tasks,before.tasks);assert.deepEqual(s.assets,before.assets);
});
test('first change freezes legacy facts before writing metrics; missing is distinct from zero',()=>{
 const s=setup();saveMetrics(s,'7d',{views:'',likes:'0',saves:'42',comments:null},stamp,now);assert.equal(s.reviews['7d'].views,null);assert.equal(s.reviews['7d'].likes,0);assert.equal(s.reviewReports['7d'].basis.metrics.views,1250);assert.ok(metricComparison(s,'7d').includes('未提供'));assert.ok(review(s,{}).includes('未提供'));assert.ok(metricReportPanel(s,'7d').includes('1250')||metricReportPanel(s,'7d').includes('1,250'));
});
test('no-op saves preserve confirmation; time-only changes invalidate only affected report',()=>{
 const s=setup();confirm(s);const before=structuredClone(s);assert.equal(saveMetrics(s,'7d',s.reviews['7d'],stamp,now),false);assert.deepEqual(s,before);saveMetrics(s,'7d',s.reviews['7d'],new Date(now-120000).toISOString(),now);assert.equal(metricReportStatus(s,'7d'),'待复核');assert.equal(s.reviewReports['7d'].basis.sampleAt,stamp);
});
test('invalid values and timestamps are rejected atomically',()=>{
 for(const views of [-1,1.2,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'bad']){const s=setup(),before=structuredClone(s);assert.throws(()=>saveMetrics(s,'7d',{...s.reviews['7d'],views},stamp,now));assert.deepEqual(s,before);}
 for(const time of ['',null,'bad',new Date(now+120000).toISOString()]){const s=setup(),before=structuredClone(s);assert.throws(()=>saveMetrics(s,'7d',s.reviews['7d'],time,now));assert.deepEqual(s,before);}
});
test('confirmation requires explicit acknowledgement and current snapshot; cancel is read-only',()=>{
 const s=setup();change(s);const guard=metricGuard(s,'7d'),before=structuredClone(s);metricComparison(s,'7d');assert.deepEqual(s,before);assert.throws(()=>confirmMetricReport(s,'7d',guard,false));assert.deepEqual(s,before);saveMetrics(s,'7d',{...s.reviews['7d'],likes:70},stamp,now);const changed=structuredClone(s);assert.throws(()=>confirmMetricReport(s,'7d',guard,true),/已变化/);assert.deepEqual(s,changed);
});
test('confirm still applicable retains original content and records latest checked data',()=>{
 const s=setup();change(s);const old=structuredClone(metricReport(s,'7d'));confirm(s);const r=s.reviewReports['7d'];assert.equal(metricReportStatus(s,'7d'),'已复核');assert.deepEqual(r.basis,old.basis);assert.equal(r.observations,old.observations);assert.equal(r.reviewedAgainst.metrics.views,2000);assert.equal(r.checks.length,1);saveMetrics(s,'7d',{...s.reviews['7d'],likes:71},stamp,now);assert.equal(metricReportStatus(s,'7d'),'待复核');
});
test('editing confirms new report with current basis and retains prior report version',()=>{
 const s=setup();confirm(s);change(s);const old=structuredClone(metricReport(s,'7d'));edit(s);const r=s.reviewReports['7d'];assert.equal(r.revision,2);assert.equal(r.basis.metrics.views,2000);assert.equal(r.history[0].observations,old.observations);assert.deepEqual(r.history[0].basis,old.basis);assert.equal(metricReportStatus(s,'7d'),'已复核');assert.equal(r.suggestions.length,1);
});
test('invalid or stale editing does not partially replace report',()=>{
 const s=setup();change(s);const before=structuredClone(s);assert.throws(()=>editMetricReport(s,'7d',metricGuard(s,'7d'),{observations:'事实',hypothesis:'假设'},true));assert.deepEqual(s,before);const guard=metricGuard(s,'7d');confirm(s);const latest=structuredClone(s);assert.throws(()=>editMetricReport(s,'7d',guard,{observations:'事实',hypothesis:'假设',suggestion1:'行动'},true),/已变化/);assert.deepEqual(s,latest);
});
test('unreviewed report cannot create todos; confirmed todos have provenance and deduplicate',()=>{
 const s=setup();assert.throws(()=>addMetricTodos(s,'7d',['opening']));confirm(s);assert.throws(()=>addMetricTodos(s,'7d',['opening','invalid']));assert.equal(s.todos.length,0);assert.equal(addMetricTodos(s,'7d',['opening','opening']),1);assert.equal(addMetricTodos(s,'7d',['opening']),0);assert.equal(s.todos[0].reviewSource.reportId,'sample-review-7d');s.todos[0].done=true;const before=structuredClone(s.todos);change(s);assert.throws(()=>addMetricTodos(s,'7d',['title']));assert.deepEqual(s.todos,before);assert.match(metricTodoLabel(s,s.todos[0]),/待复核/);edit(s);assert.match(metricTodoLabel(s,s.todos[0]),/已修订/);assert.equal(s.todos[0].done,true);
});
test('snapshot restore, native export and homepage preserve pending report and todo source',()=>{
 const s=setup();confirm(s);addMetricTodos(s,'7d',['opening']);change(s);let raw=JSON.stringify(s);const storage={getItem:()=>raw,setItem:(_,x)=>raw=x},saved=createStore(storage);saved.save();const restored=createStore(storage).state;assert.equal(metricReportStatus(restored,'7d'),'待复核');assert.ok(home(restored).includes('来源报告待复核'));const docs=core.documents(restored);assert.ok(docs.get('05-复盘与计划/待办.md').includes('来源报告待复核'));assert.ok(docs.get('05-复盘与计划/复盘记录.md').includes('"needsReview": true'));assert.equal(restored.reviewReports['7d'].basis.metrics.views,1250);
});
test('report and historical user text are escaped and pending action is disabled',()=>{
 const s=setup();change(s);edit(s);s.reviewReports['7d'].observations='<img src=x onerror=alert(1)>';s.reviewReports['7d'].history[0].hypothesis='<script>bad</script>';const html=metricReportPanel(s,'7d');assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;script'));assert.ok(!html.includes('<img'));saveMetrics(s,'7d',{...s.reviews['7d'],likes:72},stamp,now);assert.ok(metricReportPanel(s,'7d').includes('data-action="review-todos" disabled'));
});
