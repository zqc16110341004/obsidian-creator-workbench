import {icon} from './icons.js';
import {esc} from './store.js';
import {nextAction} from './task-workflow.js';

export const isPresentation=s=>s.settings?.presentationMode===true;
export function presentationBanner(s){
 if(!isPresentation(s))return '';
 return `<aside class="presentation-banner" aria-label="推广演示说明"><span><i></i><strong>演示案例</strong><small>预置稿件、对话与指标，用于展示流程</small></span><nav aria-label="展示场景">${[['home','总览'],['writing','共创'],['assets','资产'],['covers','封面'],['repository','作品'],['review','复盘']].map(([id,label])=>`<button data-action="showcase-scene" data-value="${id}">${label}</button>`).join('')}</nav></aside>`;
}
export function showcaseDestination(s,ui,scene){
 if(!isPresentation(s))return null;
 if(scene==='writing'){s.activeTaskId='showcase-writing';ui.studioTab='ai';s.tasks.find(t=>t.id===s.activeTaskId).stage=2;return 'studio';}
 if(scene==='covers'){s.activeTaskId='showcase-tools';ui.studioTab='ai';s.tasks.find(t=>t.id===s.activeTaskId).stage=3;return 'studio';}
 if(scene==='assets'){ui.analysisTab='assets';return 'analysis';}
 if(scene==='review'){ui.reviewMode='content';ui.samplingTaskId='showcase-tools';return 'review';}
 return ['home','repository'].includes(scene)?scene:null;
}
export function presentationOverview(s){
 const tasks=s.tasks.filter(t=>t.presentationExample&&t.publishedAt),ids=new Set(tasks.map(t=>t.id));
 const latest=tasks.flatMap(t=>(s.samples||[]).filter(x=>x.taskId===t.id).sort((a,b)=>Date.parse(b.sampledAt)-Date.parse(a.sampledAt)).slice(0,1));
 const total=key=>latest.reduce((n,x)=>n+(x.metrics.find(m=>m.key===key)?.value||0),0);
 return `<div class="section-heading"><h2>内容表现案例</h2><span class="badge gold">预置指标 · 非真实业绩</span></div><div class="showcase-metrics">${[[tasks.length,'篇发布案例'],[total('views').toLocaleString('zh-CN'),'次播放示意'],[total('saves').toLocaleString('zh-CN'),'次收藏示意'],[(s.contentReports||[]).filter(r=>ids.has(r.taskId)).length,'份复盘案例']].map(([value,label])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('')}</div><p class="micro muted">每篇案例仅取最近一次采样，24 小时与 7 天累计指标不相加。</p>`;
}
export function presentationHome(s){
 const t=s.tasks.find(t=>t.id==='showcase-writing'),n=nextAction(t),assets=s.assets.slice(0,3);
 const action=(label,scene,kind='secondary')=>`<button class="btn ${kind}" data-action="showcase-scene" data-value="${scene}">${label}${icon('arrow')}</button>`;
 return `<section class="hero hero-home showcase-hero"><div class="hero-copy"><div class="eyebrow">内容创作工作台 · Obsidian 本地版</div><h1>每一条灵感，<br>都有下一步。</h1><p>把选题、资料、AI 共创与复盘放在一起。<br>从自己的判断出发，写成自己的作品。</p></div><div class="showcase-hero-note"><span>一条内容的创作路径</span><strong>收集 → 判断 → 共创 → 发布 → 复盘</strong><small>素材留得下，创作接得上，经验用得起来。</small></div><div class="button-row">${action('接着写今天这一条','writing','primary')}${action('看看已经整理好的作品','repository','quiet')}</div></section>
 <div class="showcase-count-strip">${[[s.topics.length,'个选题，随时开写'],[s.assets.length,'条方法，可以复用'],[s.tasks.filter(t=>t.inRepository).length,'篇稿件，集中归档']].map(([value,label])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('')}<p>演示内容集<br><small>所有案例均为展示预置</small></p></div>
 <div class="showcase-home-grid"><section class="panel showcase-current"><div class="section-heading"><h2>正在打磨的口播</h2><span class="badge olive">文案共创中</span></div><p class="overline">从零散收藏，到一个具体问题</p><h3>${esc(t.title)}</h3><p class="showcase-excerpt">${esc(t.viewpoint)}</p><div class="showcase-stage-track">${['观点已确认','提纲已确认','正在改稿','准备封面'].map((label,i)=>`<span class="${i<2?'done':i===2?'current':''}"><i>${i<2?icon('check'):i+1}</i>${label}</span>`).join('')}</div><div class="showcase-current-bottom"><span>${t.assetIds.length} 条表达方法已选用<br><small>下一步：${esc(n.label)}</small></span>${action('打开共创','writing','primary')}</div></section>
 <section class="panel showcase-today"><div class="section-heading"><h2>今天，继续三件小事</h2><span class="badge">创作安排案例</span></div>${[['01','把今天的口播开场再缩短','writing','让观众先听懂自己的问题'],['02','确认工具选题的最终封面','covers','标题、图片与稿件放在一起'],['03','把复盘结论变成下次行动','review','先看依据，再做一个小调整']].map(([num,title,scene,sub])=>`<button class="showcase-today-row" data-action="showcase-scene" data-value="${scene}"><span>${num}</span><div><strong>${title}</strong><small>${sub}</small></div>${icon('arrow')}</button>`).join('')}</section>
 <section class="panel showcase-library"><div class="section-heading"><h2>积累下来的表达方法</h2>${action('查看资产库','assets','text')}</div>${assets.map(a=>`<div class="showcase-method"><span class="badge olive">${esc(a.type)}</span><div><strong>${esc(a.name)}</strong><p>${esc(a.method)}</p></div></div>`).join('')}</section>
 <section class="panel showcase-results">${presentationOverview(s)}${action('对照原稿，看一次复盘','review','text')}</section></div>`;
}
