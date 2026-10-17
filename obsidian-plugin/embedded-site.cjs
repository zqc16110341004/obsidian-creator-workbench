const {createHash}=require('node:crypto');
function http(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function embeddedSite(view,kind){
 if(!['feishu','aihot'].includes(kind))throw Error('未知原站');
 if(view.siteOverlay)throw Error('原站已打开，请先返回工作台');
 const initial=kind==='feishu'?view.plugin.feishu.status().sourceUrl:'https://aihot.news/';if(!http(initial))throw Error('原站链接无效');
 return new Promise(resolve=>{
  const panel=view.contentEl.createDiv({cls:'creator-site-overlay'});view.siteOverlay=panel;
  const bar=panel.createDiv({cls:'creator-site-toolbar'}),back=bar.createEl('button',{text:'返回工作台'}),reload=bar.createEl('button',{text:'重新加载'}),external=bar.createEl('button',{text:'在浏览器打开'}),collect=bar.createEl('button',{text:'收集当前网页'});
  const address=panel.createEl('p',{cls:'creator-site-address',text:initial}),message=panel.createEl('p',{cls:'creator-site-status',text:'正在加载原站…',attr:{role:'status'}});
  const web=panel.createEl('webview');web.setAttribute('partition',`${kind==='feishu'?'persist:':''}creator-workbench-${kind}-${createHash('sha256').update(view.plugin.disk.root).digest('hex').slice(0,12)}`);web.setAttribute('webpreferences','contextIsolation=yes,sandbox=yes,nodeIntegration=no,nodeIntegrationInWorker=no,nodeIntegrationInSubFrames=no,webSecurity=yes');
  // No preload, Node, bridge, cookie reads, injected scripts or popup permissions on remote pages.
  let current=initial,closed=false,loaded=false;collect.disabled=true;
  const close=result=>{if(closed)return;closed=true;clearTimeout(timer);panel.remove();view.siteOverlay=null;resolve(result||null);};view.closeSite=close;
  back.addEventListener('click',()=>close());reload.addEventListener('click',()=>{try{message.textContent='正在重新加载…';web.reload();}catch{message.textContent='当前 Obsidian 未启用网页内嵌，请使用浏览器入口。';}});
  external.addEventListener('click',()=>require('electron').shell.openExternal(current));
  collect.addEventListener('click',()=>{if(!loaded)return;close({url:current,title:kind==='feishu'?'飞书原表':'AIHOT 收集链接'});});
  web.addEventListener('will-navigate',e=>{if(!http(e.url)){e.preventDefault();message.textContent='该链接不是受支持的 HTTPS 网页。';}});
  const navigate=e=>{const u=http(e.url);if(u){current=u;address.textContent=u;}};
  web.addEventListener('did-navigate',navigate);web.addEventListener('did-navigate-in-page',navigate);
  web.addEventListener('did-finish-load',()=>{loaded=true;collect.disabled=false;message.textContent='原站已加载。需要登录时请在原站授权；收集仅保存当前网页链接。';clearTimeout(timer);});
  web.addEventListener('did-fail-load',e=>{if(e.isMainFrame!==false&&e.errorCode!==-3){loaded=false;collect.disabled=true;message.textContent=`原站加载失败（${e.errorCode}），可以重试或在浏览器打开。`;}});
  const timer=setTimeout(()=>{if(!loaded)message.textContent='原站尚未加载完成，可能受网络、授权或内嵌限制。可重试或在浏览器打开；当前不计为内嵌成功。';},20000);
  web.setAttribute('src',initial);
 });
}
module.exports={embeddedSite,http};
