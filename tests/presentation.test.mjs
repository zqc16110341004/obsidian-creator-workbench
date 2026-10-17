import {presentationFixture} from './fixtures/presentation.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {initialState} from '../src/store.js';
import {formal,overview} from '../src/home-data.js';
import {presentationHome,presentationBanner,showcaseDestination} from '../src/presentation.js';
import {contentReportStatus} from '../src/content-ai-review.js';
const require=createRequire(import.meta.url),{presentationHost}=require('../obsidian-plugin/presentation-host.cjs');
const fixture=()=>presentationFixture();
test('promotion host cannot call real AI, Feishu, feeds or external browsing',async()=>{
 let external=0,notice=0;const bad=()=>{external++;};const host=presentationHost({kind:'obsidian',storage:{},download:bad,openExternal:bad,openSite:bad,codex:{start:bad},feishu:{confirm:bad},feeds:{fetch:bad},costs:{},covers:{read:()=> 'local-cover',save:()=> 'local-file',start:bad},video:{read:()=> 'local-video',start:bad},samplingFiles:{}},()=>notice++);
 assert.equal(host.presentation,true);assert.equal(host.feishu,undefined);assert.equal(host.feeds,undefined);assert.equal(host.costs,undefined);
 assert.throws(()=>host.codex.start(),/推广演示/);assert.throws(()=>host.video.start(),/推广演示/);assert.throws(()=>host.covers.start(),/推广演示/);
 host.openExternal('https://example.com');host.openSite('feishu');assert.equal(external,0);assert.equal(notice,2);
 assert.equal((await host.codex.status()).available,false);assert.equal(host.covers.read(),'local-cover');
});
test('presentation data never contributes to formal business metrics',()=>{
 const s=fixture();assert.equal(s.tasks.length,6);assert.equal(s.topics.length,12);assert.equal(s.assets.length,8);
 assert.ok(s.tasks.every(t=>t.presentationExample&&!formal(t)));assert.equal(overview(s).published,0);assert.equal(overview(s).sampled,0);
 const html=presentationHome(s);assert.match(html,/预置指标 · 非真实业绩/);assert.match(html,/5,610/);assert.match(html,/290/);assert.doesNotMatch(html,/涨粉|收益|客户/);
});
test('all demonstration reports use their own current sample and draft snapshots',()=>{
 const s=fixture();assert.equal(s.samples.length,6);assert.equal(s.contentReports.length,3);
 for(const r of s.contentReports){assert.equal(contentReportStatus(s,r),'已确认');assert.equal(r.basis.taskId,r.taskId);assert.ok(r.sampleIds.every(id=>s.samples.find(x=>x.id===id)?.taskId===r.taskId));}
 const raw=JSON.stringify(s);assert.doesNotMatch(raw,/appSecret|tenant_access_token|cli_[A-Za-z0-9]{16,}/);
});
test('tour navigation is local and available only for the opt-in demonstration',()=>{
 const s=fixture(),ui={};assert.equal(showcaseDestination(s,ui,'covers'),'studio');assert.equal(s.activeTaskId,'showcase-tools');assert.equal(s.tasks.find(t=>t.id===s.activeTaskId).stage,3);
 assert.equal(showcaseDestination(s,ui,'review'),'review');assert.equal(ui.samplingTaskId,'showcase-tools');assert.equal(showcaseDestination(initialState(),{},'covers'),null);
 assert.equal(presentationBanner(initialState()),'');assert.match(presentationBanner(s),/演示案例/);
});
test('synthetic fixture is isolated and has content-addressed cover references',()=>{
 const a=fixture(),b=fixture();a.tasks[0].title='修改夹具';assert.notEqual(a.tasks[0].title,b.tasks[0].title);
 for(const t of b.tasks.filter(t=>t.inRepository)){assert.ok(t.finalCoverId);assert.match(t.coverVersions[0].file.id,/^[a-f0-9]{64}\.png$/);}
 assert.ok(!Object.hasOwn(b,'feishu'));
});
