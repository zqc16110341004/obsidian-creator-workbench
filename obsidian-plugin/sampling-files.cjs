const fs = require('node:fs');
const path = require('node:path');
const {createHash,randomUUID} = require('node:crypto');
const MAX = 8 * 1024 * 1024;
function imageType(bytes) {
  if(bytes.length>=8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return ['png','image/png'];
  if(bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255)return ['jpg','image/jpeg'];
  if(bytes.length>=12 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP')return ['webp','image/webp'];
  throw Error('请使用 PNG、JPEG 或 WebP 截图');
}
class SamplingFiles {
  constructor(root,{folder='数据采样',max=MAX}={}){if(!['数据采样','封面图片'].includes(folder))throw Error('附件类型无效');this.root=path.resolve(root);this.folder=folder;this.max=max;}
  directory(create=false){let dir=this.root;for(const part of ['06-附件',this.folder]){dir=path.join(dir,part);if(!fs.existsSync(dir)){if(!create)throw Error('截图文件不存在');fs.mkdirSync(dir);}if(fs.lstatSync(dir).isSymbolicLink()||!fs.statSync(dir).isDirectory())throw Error('截图目录不可用');}return dir;}
  save(data,name){const bytes=Buffer.from(data);if(!bytes.length||bytes.length>this.max)throw Error('每张截图请控制在 8 MB 以内');const [ext,mime]=imageType(bytes),hash=createHash('sha256').update(bytes).digest('hex'),id=hash+'.'+ext,file=path.join(this.directory(true),id);const existing=fs.lstatSync(file,{throwIfNoEntry:false});if(existing){if(existing.isSymbolicLink()||!fs.readFileSync(file).equals(bytes))throw Error('已有截图文件校验失败');}else {const temp=file+'.'+randomUUID()+'.pending';const fd=fs.openSync(temp,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temp,file);}return {id,sha256:hash,mime,size:bytes.length,name:String(name||'截图').replace(/[\x00-\x1f]/g,'').slice(0,160),path:'06-附件/'+this.folder+'/'+id};}
  read(id){if(typeof id!=='string'||! /^[a-f0-9]{64}\.(png|jpg|webp)$/.test(id))throw Error('截图标识无效');const file=path.join(this.directory(),id);if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink())throw Error('原截图不存在，请保留采样记录并补充来源');const stat=fs.statSync(file);if(stat.size>this.max)throw Error('截图文件过大');const bytes=fs.readFileSync(file),[ext,mime]=imageType(bytes);if(createHash('sha256').update(bytes).digest('hex')+'.'+ext!==id)throw Error('原截图校验失败，文件可能已被修改');return 'data:'+mime+';base64,'+bytes.toString('base64');}
}
module.exports={SamplingFiles,imageType,MAX};
