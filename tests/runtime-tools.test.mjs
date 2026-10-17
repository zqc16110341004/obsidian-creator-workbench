import test from 'node:test';
import assert from 'node:assert/strict';
import tools from '../obsidian-plugin/runtime-tools.cjs';
import video from '../obsidian-plugin/video-files.cjs';
test('GUI environments find executable tools without a shell and respect explicit overrides',()=>{
 const files=new Set(['/custom/ffmpeg','/usr/local/bin/ffprobe','/Applications/Codex.app/Contents/Resources/codex']);
 const exists=p=>files.has(p);
 assert.equal(tools.resolveTool('ffmpeg',{env:{PATH:'/custom'},exists}),'/custom/ffmpeg');
 assert.equal(tools.resolveTool('ffprobe',{env:{PATH:''},exists}),'/usr/local/bin/ffprobe');
 assert.equal(tools.resolveTool('codex',{env:{},exists}),'/Applications/Codex.app/Contents/Resources/codex');
 assert.equal(tools.resolveTool('ffmpeg',{env:{CREATOR_WORKBENCH_FFMPEG:'/missing',PATH:'/custom'},exists}),'');
 assert.equal(tools.resolveTool('ffmpeg',{env:{CREATOR_WORKBENCH_FFMPEG:'relative'},exists}),'');
});
test('missing video tools never claim a cached model or affect text workflows',()=>{
 const h=new video.VideoFiles('/tmp/workbench-unit','/missing/worker',{ffmpeg:'',ffprobe:'',python:''});
 const status=h.status();assert.equal(status.available,false);assert.deepEqual(status.missing,['ffmpeg','ffprobe','python3','转写程序']);
 assert.doesNotMatch(status.message,/已缓存/);assert.throws(()=>h.start('invalid'),/缺少/);
});
