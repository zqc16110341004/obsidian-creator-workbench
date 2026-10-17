import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,createStore} from '../src/store.js';
import {finalizeToRepository,markScriptChanged,repositoryItems,missingOutputs,repositoryText,repositoryView,repositoryDetail,safeOutputName} from '../src/repository.js';

test('drafts stay outside; confirming a script enters once and permits missing title and cover',()=>{
  const state=initialState(),task=state.tasks[0];
  assert.equal(repositoryItems(state).length,0);
  finalizeToRepository(task,'2026-10-15T01:00:00.000Z');
  assert.equal(repositoryItems(state).length,1);
  assert.deepEqual(missingOutputs(task),['标题待补齐','封面待补齐']);
  finalizeToRepository(task,'2026-10-16T01:00:00.000Z');
  assert.equal(repositoryItems(state).length,1);
  assert.equal(task.archivedAt,'2026-10-15T01:00:00.000Z');
});
test('unfinished or unconfirmed drafts cannot be finalized',()=>{
  const task=initialState().tasks[0];task.script='  ';
  assert.throws(()=>finalizeToRepository(task),/请先写下/);
  task.script='正文';task.outlineConfirmed=false;
  assert.throws(()=>finalizeToRepository(task),/确认观点和提纲/);
  assert.equal(task.inRepository,undefined);
});
test('editing keeps the same item, invalidates the final label, and does not rewind production status',()=>{
  const state=initialState(),task=state.tasks[0];finalizeToRepository(task);
  task.status='待剪辑';task.script='修改后的口播稿';markScriptChanged(task);
  assert.equal(repositoryItems(state)[0],task);
  assert.ok(missingOutputs(task).includes('文案待重新定稿'));
  assert.match(repositoryText(task),/待重新定稿/);
  finalizeToRepository(task);assert.equal(task.status,'待剪辑');
});
test('legacy finalized records are included without inventing a date, and survive editing and reload',()=>{
  const state=initialState();state.tasks[0].final=true;const before=JSON.stringify(state);
  let saved=before;const storage={getItem:()=>saved,setItem:(key,value)=>saved=value};
  const store=createStore(storage),task=store.state.tasks[0];
  assert.equal(repositoryItems(store.state).length,1);assert.equal(task.archivedAt,undefined);
  markScriptChanged(task);store.save();
  assert.equal(repositoryItems(createStore(storage).state).length,1);
  assert.match(repositoryView(store.state,{}),/入库日期未记录/);
});
test('search and filters read the live title, script, cover and publication state',()=>{
  const state=initialState(),task=state.tasks[0];finalizeToRepository(task);
  assert.equal(repositoryItems(state,{filter:'incomplete'}).length,1);
  task.finalTitle='我的 AI 创作流程';task.cover=true;task.script='独有的关键词';
  assert.equal(repositoryItems(state,{search:'ai'}).length,1);
  assert.equal(repositoryItems(state,{search:'独有的关键词',filter:'ready'}).length,1);
  assert.equal(repositoryItems(state,{filter:'incomplete'}).length,0);
  assert.equal(repositoryItems(state,{filter:'published'}).length,0);
  task.publishedAt='2026-10-15T01:00:00.000Z';
  assert.equal(repositoryItems(state,{filter:'published'}).length,1);
  assert.equal(repositoryItems(state,{search:'不存在'}).length,0);
});
test('repository does not interpolate markup and output filenames exclude path separators',()=>{
  const state=initialState(),task=state.tasks[0];finalizeToRepository(task);
  task.finalTitle='<script>alert(1)</script>';task.script='<img src=x onerror=alert(1)>';
  const html=repositoryView(state,{})+repositoryDetail(task);
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));
  assert.ok(!safeOutputName(task).includes('/'));
});
