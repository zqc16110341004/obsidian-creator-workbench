const fs = require('node:fs');
const {spawn:spawnDefault} = require('node:child_process');
const {createHash} = require('node:crypto');
const {imageType,MAX} = require('./sampling-files.cjs');
class ScreenshotOCR {
 constructor(binary,{platform=process.platform,spawn=spawnDefault,timeout=45000}={}){this.binary=binary;this.platform=platform;this.spawn=spawn;this.timeout=timeout;this.job=null;}
 status(){return {available:this.platform==='darwin'&&fs.existsSync(this.binary),engine:'macos-vision',message:'本地文字识别；截图不上传。无法识别时可手工填写。'};}
 recognize(id,data){
  if(typeof id!=='string'||! /^[a-zA-Z0-9-]{1,80}$/.test(id))return Promise.reject(Error('识别请求无效'));
  if(this.job)return Promise.reject(Error('已有截图正在识别，请等待或取消'));
  if(!this.status().available)return Promise.reject(Error('当前设备没有可用的本地识别程序，请手工填写'));
  let bytes;try{bytes=Buffer.from(data);if(!bytes.length||bytes.length>MAX)throw Error('每张截图请控制在 8 MB 以内');imageType(bytes);}catch(e){return Promise.reject(e);}
  return new Promise((resolve,reject)=>{
   let child;try{child=this.spawn(this.binary,[],{stdio:['pipe','pipe','pipe'],shell:false});}catch{reject(Error('本地识别程序无法启动，请手工填写'));return;}
   let output=[],size=0,finished=false;const job={id,child,stop:null};this.job=job;
   const finish=(err,result)=>{if(finished)return;finished=true;clearTimeout(timer);if(this.job===job)this.job=null;if(err){child.kill('SIGKILL');reject(err);}else resolve(result);};
   const timer=setTimeout(()=>finish(Error('识别超时，表单已保留；可手工填写或重新识别')),this.timeout);
   job.stop=()=>finish(Error('已取消识别，表单已保留'));
   child.on('error',()=>finish(Error('本地识别程序无法启动，请手工填写')));
   child.stdin.on('error',()=>{});
   child.stdout.on('data',chunk=>{size+=chunk.length;if(size>256*1024)return finish(Error('识别结果过大，请选择更小的截图'));output.push(chunk);});
   child.stderr.on('data',()=>{}); // Do not log image text or native diagnostics.
   child.on('close',code=>{if(finished)return;if(code!==0)return finish(Error('截图无法识别或尺寸超限；请用清晰截图（最多 4000 万像素）或手工填写'));
    try{const r=JSON.parse(Buffer.concat(output).toString('utf8'));if(!Array.isArray(r.lines)||r.lines.length>500||!r.lines.every(l=>typeof l.text==='string'&&l.text.length<=300&&['confidence','x','y','w','h'].every(k=>typeof l[k]==='number'&&Number.isFinite(l[k])&&l[k]>=0&&l[k]<=1)))throw Error();finish(null,{engine:'macos-vision',imageSha256:createHash('sha256').update(bytes).digest('hex'),recognizedAt:Date.now(),lines:r.lines,width:r.width,height:r.height});}catch{finish(Error('识别结果无法使用，请手工核对'));}
   });
   child.stdin.end(bytes);
  });
 }
 cancel(id){if(this.job?.id===id)this.job.stop();}
 close(){this.job?.stop();}
}
module.exports={ScreenshotOCR};
