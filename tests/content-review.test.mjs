import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,createStore} from '../src/store.js';
import {changeContent,confirmStage,confirmReview,confirmNoImpact,reliable,pendingReviews,reviewBanner} from '../src/content-review.js';
import {finalizeToRepository,repositoryItems,missingOutputs} from '../src/repository.js';
import {writingPrompt} from '../src/ai-writing.js';
import {nextStep} from '../src/views.js';
import {paintCover} from '../src/cover.js';
import localStore from '../obsidian-plugin/local-store.cjs';

function fixture(){const s=initialState(),t=s.tasks[0];finalizeToRepository(t);t.finalTitle='原来标题';t.cover=true;t.assetIds=[s.assets[0].id];return {s,t};}
test('changing viewpoint preserves downstream work and publication facts but invalidates reliability',()=>{
 const {s,t}=fixture();t.status='已发布、待复盘';t.publishedAt='2026-10-15T00:00:00Z';const before=structuredClone(t);
 changeContent(t,'viewpoint','新的判断');
 assert.deepEqual(pendingReviews(t),['assets','outline','script','finalTitle','cover','publish']);
 for(const k of ['outline','script','finalTitle','cover','assetIds','status','publishedAt'])assert.deepEqual(t[k],before[k]);
 assert.equal(reliable(t,'outline'),false);assert.equal(reliable(t,'script'),false);
 assert.equal(repositoryItems(s).length,1);assert.equal(repositoryItems(s,{filter:'ready'}).length,0);
 assert.throws(()=>finalizeToRepository(t),/确认观点和提纲/);
});
test('confirmation proceeds in order without silently clearing dependent warnings',()=>{
 const {t}=fixture();changeContent(t,'viewpoint','新观点');
 assert.throws(()=>confirmReview(t,'script'),/核心观点/);
 confirmStage(t,'viewpoint');assert.equal(reliable(t,'outline'),false);
 assert.throws(()=>confirmReview(t,'script'),/提纲/);
 confirmStage(t,'outline');assert.equal(reliable(t,'outline'),true);assert.equal(reliable(t,'script'),false);
 assert.throws(()=>confirmReview(t,'finalTitle'),/口播稿/);
 finalizeToRepository(t);assert.equal(reliable(t,'script'),true);
 confirmReview(t,'finalTitle');confirmReview(t,'cover');confirmReview(t,'publish');confirmReview(t,'assets');
 assert.deepEqual(pendingReviews(t),[]);
});
test('same-value edits are no-ops; repeated changes deduplicate reasons',()=>{
 const {t}=fixture(),before=structuredClone(t);assert.equal(changeContent(t,'viewpoint',t.viewpoint),false);assert.deepEqual(t,before);
 changeContent(t,'viewpoint','a');changeContent(t,'viewpoint','ab');changeContent(t,'outline','new');
 assert.deepEqual(t.needsReview.script,['viewpoint','outline']);
});
test('minor-edit acknowledgement is atomic and cannot confirm an unconfirmed source',()=>{
 const {t}=fixture();changeContent(t,'viewpoint','改个措辞');let before=structuredClone(t);
 assert.throws(()=>confirmNoImpact(t),/核心观点/);assert.deepEqual(t,before);
 confirmStage(t,'viewpoint');changeContent(t,'outline','未确认的新提纲');before=structuredClone(t);
 assert.throws(()=>confirmNoImpact(t),/提纲/);assert.deepEqual(t,before);
 confirmStage(t,'outline');confirmNoImpact(t);assert.deepEqual(pendingReviews(t),[]);assert.equal(reliable(t,'script'),true);
});
test('script edits require refinalization, retain repository membership, and mark title/cover/checks',()=>{
 const {t}=fixture();changeContent(t,'script','修改关键主张');
 assert.deepEqual(pendingReviews(t),['finalTitle','cover','publish']);assert.equal(t.final,false);assert.equal(t.inRepository,true);
 assert.throws(()=>confirmNoImpact(t),/口播稿/);finalizeToRepository(t);confirmNoImpact(t);
 assert.deepEqual(missingOutputs(t),[]);
});
test('title edits retain the actual previous cover until explicitly regenerated',()=>{
 const {t}=fixture();changeContent(t,'finalTitle','新标题');changeContent(t,'finalTitle','再次改标题');
 assert.deepEqual(pendingReviews(t),['cover','publish']);assert.equal(t.coverSnapshot.title,'原来标题');
 const painted=[],gradient={addColorStop(){}};
 const c=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,measureText:()=>({width:10}),fillText:text=>painted.push(text)},{get:(o,k)=>o[k]||(()=>{})});
 paintCover({width:600,height:800,getContext:()=>c},t);assert.ok(painted.includes('原来标题'));assert.ok(!painted.includes('再次改标题'));
});
test('pending assets are omitted from AI inputs, and obsolete outline is not represented as confirmed',()=>{
 const {s,t}=fixture();changeContent(t,'viewpoint','改变了');confirmStage(t,'viewpoint');
 const payload=JSON.parse(writingPrompt(t,s.assets,'帮我检查').split('\n').slice(1).join('\n'));
 assert.equal(payload.context.viewConfirmed,true);assert.equal(payload.context.outlineConfirmed,false);assert.equal(payload.context.final,false);
 assert.deepEqual(payload.context.selectedAssets,[]);assert.ok(payload.context.needsReview.includes('outline'));
});
test('review status survives save/reload, and homepage points to the earliest necessary action',()=>{
 const {s,t}=fixture();changeContent(t,'viewpoint','重写');let raw=JSON.stringify(s);const storage={getItem:()=>raw,setItem:(_,v)=>raw=v};
 let store=createStore(storage);store.save();const restored=createStore(storage).state.tasks[0];
 assert.deepEqual(pendingReviews(restored),pendingReviews(t));assert.match(nextStep(restored),/确认修改后的核心观点/);
 confirmStage(restored,'viewpoint');assert.match(nextStep(restored),/复核/);
});
test('legacy tasks need no migration, absent outputs are not invented, and banners contain fixed labels',()=>{
 const {t}=fixture();assert.equal(reliable(t,'script'),true);assert.equal(reviewBanner(t),'');
 t.outline='';t.script='';t.finalTitle='';t.cover=false;t.assetIds=[];changeContent(t,'viewpoint','<img src=x>');
 assert.deepEqual(pendingReviews(t),[]);assert.equal(reviewBanner(t),'');
});
test('local Markdown exports also mark old work for review without removing the original script',()=>{
 const {s,t}=fixture(),script=t.script;changeContent(t,'viewpoint','重新判断');
 const docs=localStore.documents(s),entry=[...docs.entries()].find(([path])=>path.startsWith('02-内容仓库/'))[1];
 assert.ok(entry.includes('文案待重新确认'));assert.ok(entry.includes('待复核：'));assert.ok(entry.includes(script));
});
