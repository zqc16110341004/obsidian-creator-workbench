import {finalCover} from './cover-workflow.js';
import {reliable,needsReview} from './content-review.js';
import {esc} from './store.js';
import {icon} from './icons.js';
import {heroActions} from './hero.js';

// The repository is a view of tasks, not a second collection of editable copies.
export const isInRepository = task => Boolean(task.inRepository || task.final || task.archivedAt);
export const missingOutputs = task => [
  !reliable(task,'script') ? '文案待重新定稿' : '',
  !task.finalTitle?.trim() ? '标题待补齐' : needsReview(task,'finalTitle')?'标题待复核':!reliable(task,'finalTitle')?'标题待确认':'',
  !task.cover ? '封面待补齐' : needsReview(task,'cover')?'封面待复核':!reliable(task,'cover')?'封面待确认':'',
  needsReview(task,'publish')?'发布检查待复核':'',
  needsReview(task,'assets')?'选用资产待复核':''
].filter(Boolean);
export const isPublished = task => Boolean(task.publishedAt || ['已发布、待复盘','已复盘'].includes(task.status));

export function finalizeToRepository(task, now = new Date().toISOString()) {
  if (!task.script?.trim()) throw new Error('请先写下口播稿');
  if (!reliable(task,'viewpoint') || !reliable(task,'outline')) throw new Error('请先确认观点和提纲，再确认定稿');
  if(task.needsReview)delete task.needsReview.script;
  task.final = true;
  task.inRepository = true;
  task.archivedAt ||= now;
  if (task.status === '创作中') task.status = '待拍摄';
  return task;
}

export function markScriptChanged(task) {
  if (isInRepository(task)) task.inRepository = true;
  task.final = false;
}

export function repositoryItems(state, {search = '', filter = 'all'} = {}) {
  const query = search.trim().toLocaleLowerCase();
  return state.tasks.filter(isInRepository).filter(task => {
    const match = !query || [task.title,task.finalTitle,task.script].join('\n').toLocaleLowerCase().includes(query);
    const incomplete = missingOutputs(task).length > 0;
    return match && (filter === 'all' || filter === 'incomplete' && incomplete || filter === 'ready' && !incomplete || filter === 'published' && isPublished(task));
  }).sort((a,b) => (b.archivedAt || '').localeCompare(a.archivedAt || ''));
}

const badge = (label, kind = '') => `<span class="badge ${kind}">${esc(label)}</span>`;
const action = (label, type, task, kind = 'secondary', extra = '') => `<button type="button" class="btn ${kind}" data-action="${type}" data-id="${esc(task.id)}" ${extra}>${label}</button>`;
const displayDate = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'}) : '';
const cover = (task, detail = false) => finalCover(task)?`<img data-cover-image="${esc(finalCover(task).file.id)}" alt="已确认封面"><span class="cover-kind">${finalCover(task).source==='codex'?'AI 生成封面':'导入封面'}</span>`:task.cover
  ? `<canvas width="600" height="800" data-repository-cover="${esc(task.id)}" aria-label="${esc(task.finalTitle || task.title)}的封面样张"></canvas><span class="cover-kind">示例封面</span>`
  : `<div class="repository-cover-empty">${icon('image')}<strong>封面待补齐</strong><small>可返回创作台生成</small></div>`;
const health = task => missingOutputs(task).length ? badge('待补齐 / 确认','gold') : badge('内容已齐备','olive');

export function repositoryView(state, ui) {
  const all = repositoryItems(state), list = repositoryItems(state,{search:ui.repositorySearch,filter:ui.repositoryFilter});
  const incomplete = all.filter(task => missingOutputs(task).length).length;
  return `<section class="hero repository-hero"><div class="hero-copy"><h1>内容仓库</h1><p>每一份完成的表达，都值得被好好保存。</p></div>${heroActions(`<button class="btn primary" data-action="navigate" data-value="studio">${icon('pen')}回到创作台</button>`)}</section>
    <section class="repository-intro"><div><strong>${all.length}</strong><span>条内容已入库</span><i></i><span>${incomplete} 条待补齐或确认</span><i></i><span>${all.filter(isPublished).length} 条已发布</span></div><p>${icon('check')}稿件确认定稿后自动入库，标题与封面可继续补齐。</p></section>
    <div class="repository-toolbar"><div class="tabs" aria-label="仓库筛选">${[['all','全部内容'],['incomplete','待补齐'],['ready','已齐备'],['published','已发布']].map(([id,name])=>`<button class="tab ${(!ui.repositoryFilter && id === 'all') || ui.repositoryFilter === id?'active':''}" data-action="repository-filter" data-value="${id}" aria-pressed="${(ui.repositoryFilter || 'all') === id}">${name}</button>`).join('')}</div><label class="search-input">${icon('search')}<input id="repository-search" aria-label="搜索标题或文案" placeholder="搜索标题或文案" value="${esc(ui.repositorySearch || '')}"></label></div>
    ${!all.length ? `<section class="panel repository-empty"><div class="empty-folder" aria-hidden="true">${icon('folder')}</div><h2>第一份定稿，从这里开始积累</h2><p>在创作台确认口播稿后，标题、文案与封面会归到同一条内容中。</p><button class="btn primary" data-action="navigate" data-value="studio">前往确认稿件 ${icon('arrow')}</button><small>初稿继续留在创作台。</small></section>` : !list.length ? `<section class="panel repository-empty compact"><h2>没有找到匹配的内容</h2><p>试试其他关键词，或清除当前筛选。</p><button class="btn secondary" data-action="repository-clear">清除搜索与筛选</button></section>` : `<div class="repository-grid">${list.map(task=>`<article class="panel repository-card"><button class="repository-cover" data-action="repository-detail" data-id="${esc(task.id)}" aria-label="查看${esc(task.finalTitle || task.title)}">${cover(task)}</button><div class="repository-card-body"><div class="repository-card-tags">${badge(task.status,'olive')}${health(task)}</div><p class="overline">小红书 · ${task.finalTitle?.trim()?'标题':'选题名称'}</p><h2><button data-action="repository-detail" data-id="${esc(task.id)}">${esc(task.finalTitle?.trim() || task.title)}</button></h2><p class="repository-excerpt">${esc(task.script)}</p><div class="output-checks">${[[reliable(task,'script'),'文案'],[reliable(task,'finalTitle'),'标题'],[reliable(task,'cover'),'封面']].map(([ready,name])=>`<span class="${ready?'ready':'missing'}">${icon(ready?'check':'clock')}${name}${ready?'已就绪':'待确认'}</span>`).join('')}</div><div class="repository-card-meta"><span>${(task.script || '').length} 字</span><span>${task.archivedAt ? displayDate(task.archivedAt)+' 入库' : '入库日期未记录'}</span></div><div class="repository-card-actions">${action(`查看内容 ${icon('arrow')}`,'repository-detail',task,'primary')}${action('返回创作台','repository-edit',task,'text')}</div></div></article>`).join('')}</div>`}`;
}

export function repositoryDetail(task) {
  const missing = missingOutputs(task);
  return `<div class="repository-detail-tags">${badge('小红书')}${badge(task.status,'olive')}${health(task)}</div>
    ${missing.length ? `<div class="modal-callout">${esc(missing.join(' · '))}。${reliable(task,'script')?'已确认的文案可先取用。':'下方展示当前编辑中的文案，请重新确认后再用于发布。'}</div>` : ''}
    <div class="repository-detail-layout"><div class="repository-detail-cover"><div class="repository-cover large">${cover(task,true)}</div><div class="button-row">${action(`${icon('download')}下载封面`,'repository-cover-download',task,'secondary full',task.cover?'':'disabled title="请先补齐封面"')}${action(task.cover?'修改封面':'补齐标题与封面','repository-edit',task,'text full','data-stage="3"')}</div></div><div class="repository-detail-copy"><div class="repository-field-heading"><span>标题</span>${action(`${icon('file')}复制标题`,'repository-copy-title',task,'text',task.finalTitle?.trim()?'':'disabled')}</div><h3>${esc(task.finalTitle?.trim() || '标题待补齐')}</h3><p class="repository-source-title">原选题：${esc(task.title)}</p><div class="repository-field-heading"><span>${reliable(task,'script')?'已确认文案':'当前文案 · 待重新定稿'}</span>${action(`${icon('file')}复制文案`,'repository-copy-script',task,'text',task.script?.trim()?'':'disabled')}</div><div class="repository-script">${esc(task.script || '暂无文案')}</div><div class="repository-detail-bottom">${action(`${icon('download')}下载文案`,'repository-text-download',task,'secondary',task.script?.trim()?'':'disabled')}${action(`${icon('pen')}返回修改`,'repository-edit',task,'text','data-stage="2"')}</div></div></div><div class="repository-detail-foot">与原创作任务保持关联，展示当前保存的标题、文案与封面。</div>`;
}

export function repositoryText(task) {
  return `标题：${task.finalTitle?.trim() || '待补齐'}\n选题：${task.title}\n文案状态：${reliable(task,'script')?'已确认定稿':'待重新定稿'}\n\n${task.script || ''}\n`;
}

export function safeOutputName(task) {
  return (task.finalTitle?.trim() || task.title || '口播内容').replace(/[\u0000-\u001f<>:"/\\|?*]/g,'_').slice(0,70);
}
