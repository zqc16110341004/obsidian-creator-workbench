// An explicitly opted-in, separate promotion vault never starts external jobs.
function presentationHost(host,notify=()=>{}){
 const message='当前为推广演示，展示预置案例。请回日常知识库使用真实连接。';
 const blocked=()=>{throw Error(message);};
 return {
  kind:host.kind,presentation:true,storage:host.storage,download:host.download,
  openExternal:()=>notify(message),openSite:()=>notify(message),
  codex:{status:async()=>({available:false,message:'预置共创对话 · 演示中不发送请求'}),start:blocked,get:()=>null,cancel:async()=>null},
  covers:{status:()=>({authorized:false}),configure:async()=>{notify(message);return {authorized:false};},read:host.covers.read,save:host.covers.save,start:blocked,get:()=>null,cancel:async()=>null},
  video:{read:host.video.read,status:()=>({available:false,message:'演示内容不运行转写'}),save:blocked,start:blocked,get:()=>null,cancel:()=>null},
  samplingFiles:host.samplingFiles,
  screenshotOCR:{status:()=>({available:false,message:'演示指标为预置数据'}),recognize:blocked,cancel:()=>null}
 };
}
module.exports={presentationHost};
