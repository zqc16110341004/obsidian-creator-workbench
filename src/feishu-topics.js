import {esc} from './store.js';
import {icon} from './icons.js';

export function httpUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
export function mergeFeishuSnapshot(state,result){
 if(!result||typeof result.sourceKey!=='string'||!Array.isArray(result.topics)||!Number.isFinite(result.syncedAt))throw Error('选题读取结果不完整，原缓存保留');
 const incoming=new Map();
 for(const x of result.topics){if(!x?.feishu||`${x.feishu.appToken}:${x.feishu.tableId}`!==result.sourceKey||typeof x.id!=='string'||typeof x.title!=='string'||typeof x.reference!=='string')throw Error('选题来源不一致，原缓存保留');incoming.set(x.id,x);}
 state.topics=state.topics.map(x=>incoming.has(x.id)?{...incoming.get(x.id),...(x.originId?{originId:x.originId}:{})}:x);
 const existing=new Set(state.topics.map(x=>x.id));for(const x of incoming.values())if(!existing.has(x.id))state.topics.push(x);
 state.feishuSnapshots??={};state.feishuSnapshots[result.sourceKey]={ids:[...incoming.keys()],syncedAt:result.syncedAt};state.feishuLastSourceKey=result.sourceKey;
}
export function topicRows(s,ui){
 if((ui.topicLibrary||(ui.feishuSupported?'feishu':'local'))==='local')return s.topics.filter(x=>!x.feishu);
 const key=ui.feishu?.sourceKey||s.feishuLastSourceKey,ids=new Set(s.feishuSnapshots?.[key]?.ids||[]);
 return s.topics.filter(x=>ids.has(x.id));
}
export function sourceLinks(topic){
 const urls=[...new Set([...(topic?.links||[]),topic?.url].map(httpUrl).filter(Boolean))];
 return urls.length?`<ul class="topic-source-links">${urls.map((url,i)=>`<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">资料链接 ${i+1} ${icon('external')}</a></li>`).join('')}</ul>`:'';
}
export function taskReferences(t,s,{btn}={}){
 const source=t.sourceSnapshot||s.topics.find(x=>x.id===t.topicId)||{};
 const original=httpUrl(source.feishu?.url);
 const linked=(t.sourceMaterials||[]).map(m=>`<details class="side-note"><summary>${esc(m.title||'关联资料')}</summary><p class="reference-copy">${esc(m.text||'暂无文字')}</p>${sourceLinks(m)}<small>关联时快照${m.linkedAt?' · '+esc(new Date(m.linkedAt).toLocaleString('zh-CN')):''}</small></details>`).join('');
 return `<div class="side-content"><p class="overline">当前稿件参考资料</p><h3>${esc(t.title)}</h3><p class="reference-copy">${esc(t.references??source.reference??'')||'暂无参考文字，请在核心观点页补充。'}</p><p class="micro muted">链接只保存来源地址；未提供正文即未读取。</p>${linked?`<h3>已关联资料</h3>${linked}`:''}<details class="side-note"><summary>建稿时的原始选题</summary><h3>${esc(source.title||t.title)}</h3><p class="reference-copy">${esc(source.reference||'暂无参考文案')}</p>${sourceLinks(source)}${original?`<a class="btn secondary full" href="${esc(original)}" target="_blank" rel="noopener noreferrer">查看飞书原选题 ${icon('external')}</a>`:btn('查看选题来源','topic-source',`data-id="${esc(t.topicId)}"`,'secondary full','link')}</details><div class="side-note">资料使用关联时的快照；后续整理原资料不会覆盖本稿的参考内容。可在核心观点页编辑当前参考素材。</div></div>`;
}
export function topicsView(s,ui,{hero,btn,badge,art}){
 const native=ui.feishuSupported,library=ui.topicLibrary||(native?'feishu':'local'),feishu=library==='feishu';
 const rows=topicRows(s,ui),selected=rows.find(x=>x.id===s.selectedTopicId)||rows[0];
 const filtered=rows.filter(x=>x.title.includes(ui.search||'')||(x.reference||'').includes(ui.search||''));
 const key=ui.feishu?.sourceKey||s.feishuLastSourceKey,snapshot=s.feishuSnapshots?.[key];
 const sourceUrl=httpUrl(ui.feishu?.sourceUrl)||'';
 const connected=ui.feishu?.configured&&ui.feishu?.secretReady;
 const status=ui.feishuLoading?'正在读取':ui.feishuError?'更新未完成':connected?'已连接':snapshot?'本地缓存':'未连接';
 const time=snapshot?`上次成功读取：${esc(new Date(snapshot.syncedAt).toLocaleString('zh-CN',{hour12:false}))}`:'尚无成功读取记录';
 const banner=feishu?`<div class="feishu-connection ${ui.feishuError?'has-error':''}" aria-live="polite"><div><strong>${ui.feishuError?'这次更新没有完成':ui.feishuStatusLoading?'正在检查连接':connected?(ui.feishu.tableName||'飞书选题已连接'):'连接你的飞书选题库'}</strong><p>${ui.feishuError?esc(ui.feishuError):connected?'读取原表选题，选择一条即可建立本地稿件。':native?'先配置应用和原表字段，即可在这里查看真实选题。':'请在 Obsidian 工作台中配置飞书连接，浏览器预览不接收应用密钥。'}</p><small>${time}${snapshot&&(!connected||ui.feishuError)?' · 当前展示上次成功缓存':''}</small></div><div class="button-row">${native?btn(ui.feishu?.configured?'连接设置':'配置飞书连接','feishu-configure',ui.feishuLoading||ui.feishuConfiguring?'disabled':'','secondary','settings'):''}${btn('接入指引','feishu-guide','','quiet','info')}</div></div>`:'';
 const empty=feishu?(ui.feishuLoading?'正在读取飞书选题…':ui.feishuError?'未取得选题，检查连接后重试。':snapshot?'原表暂无记录，可在飞书添加选题后刷新。':'连接完成后，你的选题会显示在这里。'):'还没有本地选题。';
 return hero('选题库','让零散的灵感，变成值得表达的选题。',btn('新建选题','new-topic','','primary','plus')+(feishu?btn('在飞书管理','feishu-open','','secondary','external'):''))+
 `<section class="panel topics-panel"><div class="section-heading"><h2>${icon('grid')}${feishu?'飞书选题库':'本地选题'} ${badge(feishu?status:'本地保存',feishu&&connected?'olive':'')}</h2><div class="button-row">${feishu?`${native?btn(ui.feishuLoading?'读取中…':'刷新选题','feishu-refresh',!connected||ui.feishuLoading?'disabled':'','secondary small','refresh'):''}${sourceUrl?`<a class="btn quiet small" href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">${icon('external')}原表</a>`:''}`:''}</div></div>
 <div class="topics-library-tabs" role="group" aria-label="选题来源"><button class="tab ${feishu?'active':''}" data-action="topic-library" data-value="feishu" aria-pressed="${feishu}">飞书选题</button><button class="tab ${!feishu?'active':''}" data-action="topic-library" data-value="local" aria-pressed="${!feishu}">本地选题</button></div>${banner}
 <div class="table-toolbar"><span class="table-view">${icon('grid')}全部选题 <span>${rows.length}</span></span><label class="search-input">${icon('search')}<input id="topic-search" aria-label="搜索选题" placeholder="搜索选题" value="${esc(ui.search||'')}"></label></div>
 <div class="table-scroll"><table><thead><tr><th></th><th>选题标题</th><th>参考文案</th><th>来源</th><th>进度</th></tr></thead><tbody>${filtered.map(x=>`<tr class="${selected?.id===x.id?'selected':''}" data-topic="${esc(x.id)}"><td><input type="radio" name="selected-topic" value="${esc(x.id)}" aria-label="选择 ${esc(x.title)}" ${selected?.id===x.id?'checked':''}></td><td><button class="table-title" data-action="select-topic" data-id="${esc(x.id)}">${esc(x.title)}</button></td><td><span class="truncate">${esc(x.reference||'')}</span></td><td>${badge(x.source)}</td><td>${s.tasks.some(t=>t.topicId===x.id)?badge('已开始','olive'):badge(x.missingTitle?'待补标题':'备选')}</td></tr>`).join('')||`<tr><td colspan="5" class="empty-inline">${rows.length?'没有找到相符的选题。':empty}</td></tr>`}</tbody></table></div><div class="table-foot">${icon('info')}${feishu?'列表读取原表；新增选题需预览确认。稿件、排期和进度保存在 Obsidian。':'本地选题独立保存；示例选题已标明来源，不代表飞书中的记录。'}</div></section>
 ${selected?`<section class="panel topic-detail"><div class="topic-detail-copy"><p class="overline">已选中的选题</p><h3>${esc(selected.title)}</h3><p class="muted reference-copy">${esc(selected.reference||'暂无参考文案')}</p>${sourceLinks(selected)}${selected.missingTitle?'<p class="feishu-error-text">请先在飞书补齐标题，再刷新选题。</p>':''}<div class="button-row">${btn(s.tasks.some(t=>t.topicId===selected.id)?'继续已有创作':'开始创作','start-topic',`data-id="${esc(selected.id)}" ${selected.missingTitle?'disabled':''}`,'primary','arrow')}${btn('查看来源','topic-source',`data-id="${esc(selected.id)}"`,'quiet','link')}</div></div>${art('paper')}</section>`:''}`;
}
