import {esc} from './store.js';
import {extractScreenshotMetrics,fillEmptyMetrics,metricKeys} from './screenshot-metrics.js';
const labels={views:'浏览 / 播放',likes:'点赞',saves:'收藏',comments:'评论'};
export class RecognitionSession {
 constructor(api,onChange=()=>{},initial=null){this.api=api;this.onChange=onChange;this.result=initial;this.running=false;this.error='';this.token=0;}
 clear(){const id=this.id;this.token++;this.running=false;this.result=null;this.error='';this.id=null;if(id)this.api?.cancel(id);this.onChange(this);}
 async start(getBytes){
  this.clear();const token=this.token;this.id=crypto.randomUUID();const id=this.id;this.running=true;this.onChange(this);
  try{const bytes=await getBytes();if(token!==this.token)return;const raw=await this.api.recognize(id,bytes);if(token!==this.token)return;this.result=extractScreenshotMetrics(raw);}catch(e){if(token===this.token)this.error=e.message||'识别失败，可手工填写';}finally{if(token===this.token){this.running=false;this.id=null;this.onChange(this);}}
 }
}
export function recognitionDetails(r){if(!r)return '';return `<details class="recognition-evidence"><summary>查看截图识别依据与原文</summary><p class="micro">本地识别候选，仅作核对依据；保存的指标以人工核对后的填写值为准。</p>${metricKeys.map(key=>{const c=r.candidates?.[key];return c?`<p>${labels[key]}：${esc(c.raw||'未明确读到')} ${c.approximate?'（缩写近似值）':''} · ${esc(c.evidence||'缺失')}</p>`:'';}).join('')}<pre>${esc(r.rawText||'')}</pre></details>`;}
function candidatesHTML(r){if(!r)return '';return `<h3>识别候选 · 请逐项核对</h3><div class="ocr-candidates">${metricKeys.map(key=>{const c=r.candidates[key];return `<section><strong>${labels[key]}</strong><p>${c.status==='ready'?esc(c.raw)+' → '+c.value.toLocaleString('zh-CN')+' 次':c.status==='missing'?'未识别到，保留空值':c.status==='conflict'?'有多处可能值，请手工核对':'不确定，请手工核对'}</p><p class="micro">${c.approximate?'原图使用缩写，转换后仍是近似值。':''}${esc(c.evidence)}</p></section>`;}).join('')}</div><button type="button" class="btn secondary" data-ocr="fill">将可靠候选填入空白项</button><p class="micro">已有数值不会被覆盖；不确定项请对照原图手填，时间不会自动填写。</p>${recognitionDetails(r)}`;}
export function attachScreenshotRecognition({form,host,old,onError=()=>{}}){
 const fileInput=form.querySelector('#sample-file'),preview=form.querySelector('#sample-file-preview'),region=form.querySelector('[data-ocr-region]'),ack=form.elements.namedItem('ack');
 let disposed=false,previewURL,previewToken=0,available=Boolean(host?.screenshotOCR),message='';
 const hasImage=()=>Boolean(fileInput.files?.[0]?.size||old?.screenshot);
 const session=new RecognitionSession(host?.screenshotOCR,render,old?.recognition||null);
 function render(){if(disposed)return;region.innerHTML=`<div class="section-heading"><h3>截图指标识别</h3><span class="badge">本地处理</span></div><p class="micro">图片不上传；识别后逐项核对，确认保存前不会成为采样记录。</p><button type="button" class="btn secondary" data-ocr="start" ${!available||!hasImage()||session.running?'disabled':''}>${session.running?'正在识别…':'识别指标'}</button>${session.running?'<button type="button" class="btn secondary" data-ocr="cancel">取消识别</button>':''}${session.result?'<button type="button" class="btn quiet" data-ocr="discard">放弃候选，手工填写</button>':''}<p role="status" class="micro ${session.error?'error-banner':''}">${esc(session.error||message||(!available?'当前设备暂不支持本地识别，请手工填写。':!hasImage()?'先选择一张截图。':session.running?'正在读取截图文字，请稍候；可取消后手工填写。':''))}</p>${candidatesHTML(session.result)}`;form.querySelector('[type=submit]').disabled=session.running;}
 async function getBytes(){const file=fileInput.files?.[0];if(file?.size){if(file.size>8*1024*1024)throw Error('每张截图请控制在 8 MB 以内');return file.arrayBuffer();}if(old?.screenshot){const src=await host.samplingFiles.read(old.screenshot.id);return Uint8Array.from(atob(src.split(',')[1]),c=>c.charCodeAt(0)).buffer;}throw Error('请先选择截图');}
 function uncheck(){ack.checked=false;}
 region.addEventListener('click',e=>{const action=e.target.closest('[data-ocr]')?.dataset.ocr;if(!action)return;
  if(action==='start'){message='';uncheck();session.start(getBytes);}
  if(action==='cancel'||action==='discard'){session.clear();message=action==='cancel'?'已取消识别，已有填写保留。':'已放弃候选，已有填写保留；请手工核对。';render();}
  if(action==='fill'&&session.result){const current=Object.fromEntries([...metricKeys,'viewsName'].map(k=>[k,form.elements.namedItem(k).value])),filled=fillEmptyMetrics(current,session.result);for(const key of filled.filled)form.elements.namedItem(key).value=filled.values[key];if(filled.filled.includes('views'))form.elements.namedItem('viewsName').value=filled.values.viewsName;uncheck();message=filled.filled.length?'已填入 '+filled.filled.length+' 项，请对照原图修改并核对实际时间。':'没有可填入的空白项；已有值保留，请手工核对。';render();}
 });
 form.addEventListener('input',e=>{if(e.target.name!=='ack')uncheck();});
 fileInput.addEventListener('change',()=>{
  previewToken++;session.clear();uncheck();message='已更换截图，识别候选已清除；已有填写保留，请重新核对。';
  if(previewURL)URL.revokeObjectURL(previewURL);preview.classList.add('hidden');
  const file=fileInput.files?.[0];
  if(file&&file.size<=8*1024*1024&&['image/png','image/jpeg','image/webp'].includes(file.type)){
   previewURL=URL.createObjectURL(file);preview.src=previewURL;preview.classList.remove('hidden');
  }else if(file)onError('请选择 8 MB 以内的 PNG、JPEG 或 WebP 截图');
  else loadOldPreview();
  render();
 });
 form.querySelector('[data-ocr-zoom]')?.addEventListener('click',e=>{
  const expanded=form.querySelector('.sample-verify-layout').classList.toggle('preview-expanded');
  e.target.textContent=expanded?'返回并排核对':'放大原图';
 });
 async function loadOldPreview(){if(!old?.screenshot)return;const token=++previewToken;try{const src=await host.samplingFiles.read(old.screenshot.id);if(disposed||token!==previewToken)return;preview.src=src;preview.classList.remove('hidden');}catch(e){onError(e.message);}}
 loadOldPreview();render();
 if(host?.screenshotOCR)Promise.resolve(host.screenshotOCR.status()).then(s=>{available=s.available;render();}).catch(()=>{available=false;render();});
 function dispose(){disposed=true;previewToken++;window.removeEventListener('pagehide',dispose);session.clear();if(previewURL)URL.revokeObjectURL(previewURL);}
 const dialog=form.closest('dialog');dialog?.addEventListener('close',dispose,{once:true});window.addEventListener('pagehide',dispose,{once:true});
 return {get result(){return session.result;},get running(){return session.running;},dispose};
}
