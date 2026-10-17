const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {SamplingFiles}=require('./sampling-files.cjs');
const {CodexClient}=require('./codex-client.cjs');
class CoverService{
 constructor(root,session){this.files=new SamplingFiles(root,{folder:'封面图片',max:32*1024*1024});this.settings=path.join(root,'工作台数据','cover-service-settings.json');this.authorized=fs.existsSync(this.settings)&&JSON.parse(fs.readFileSync(this.settings,'utf8')).imageToolsAuthorized===true;this.client=new CodexClient({cwd:session,imageMode:true,imageToolsAuthorized:this.authorized,onImage:(item,job)=>this.saveResult(item,job)});}
 saveResult(item,job){let bytes;if(typeof item.result==='string'&&/^[A-Za-z0-9+/=\r\n]+$/.test(item.result)&&item.result.length>100)bytes=Buffer.from(item.result,'base64');else if(item.savedPath){const actual=fs.realpathSync(item.savedPath),base=path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'generated_images');if(!actual.startsWith(base+path.sep)||!actual.includes(job.threadId)||fs.lstatSync(item.savedPath).isSymbolicLink()||fs.statSync(actual).size>32*1024*1024)throw Error('图像结果路径无法核验');bytes=fs.readFileSync(actual);}else throw Error('没有可读取的图片结果');return this.files.save(bytes,'Codex 生成封面');}
 status(){return {authorized:this.authorized};}
 authorize(enabled){this.client.close();this.authorized=Boolean(enabled);fs.mkdirSync(path.dirname(this.settings),{recursive:true});const temp=this.settings+'.tmp';fs.writeFileSync(temp,JSON.stringify({imageToolsAuthorized:this.authorized,confirmedAt:Date.now()}));fs.renameSync(temp,this.settings);this.client.imageToolsAuthorized=this.authorized;const base=['code_mode','code_mode_host'];this.client.disabled=this.client.disabled.filter(x=>!base.includes(x));if(!this.authorized)this.client.disabled.push(...base);}
 start(taskId,request,ids=[]){if(!this.authorized)throw Error('请先在封面生成设置中确认启用本机图像工具');if(typeof request!=='string'||request.length>15000||ids.length>5)throw Error('封面要求过长或参考图过多');const images=ids.map(id=>this.files.read(id));return this.client.start(taskId,request,images);}
 close(){this.client.close();}
}
module.exports={CoverService};
