import {contentTodoLabel} from './content-ai-review.js';
import {esc,uid} from './store.js';

export const metricLabels={views:'浏览 / 播放',likes:'点赞',saves:'收藏',comments:'评论'};
export const periodLabel=p=>p==='24h'?'24 小时':'7 天';
const checkPeriod=p=>{if(!['24h','7d'].includes(p))throw Error('未知采样节点');};
export const metricValue=v=>v===null||v===undefined?'未提供':Number(v).toLocaleString('zh-CN');
export const sampleTime=t=>t?new Date(t).toLocaleString('zh-CN'):'未记录';
export function metricSnapshot(s,p){checkPeriod(p);return {metrics:Object.fromEntries(Object.keys(metricLabels).map(k=>[k,s.reviews[p][k]??null])),sampleAt:s.reviewSampleTimes?.[p]||null};}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const metricFacts=snap=>Object.entries(metricLabels).map(([k,label])=>`${label}：${metricValue(snap.metrics[k])}`).join('；')+'。';
export function metricReport(s,p){
 checkPeriod(p);if(s.reviewReports?.[p])return s.reviewReports[p];
 const basis=metricSnapshot(s,p);
 return {id:'sample-review-'+p,revision:1,example:true,title:s.reviewTitle,basis,observations:metricFacts(basis)+'\n目前只有单条示例内容，无法据此判断账号长期表现。',hypothesis:'具体的创作困扰可能让观众产生共鸣。是否是开场、标题或题材起作用，还需要后续对照。',suggestions:[{id:'opening',text:'把开场换成一个具体场景，下一条同类内容先描述真实困扰，复盘时记录观众反馈。'},{id:'title',text:'让标题明确说出适用人群，记录修改前后的标题，避免把结果归因于单一因素。'}],confirmedAt:null,needsReview:false,history:[],checks:[]};
}
export function metricReportStatus(s,p){const r=metricReport(s,p);if(r.needsReview||!same(r.reviewedAgainst||r.basis,metricSnapshot(s,p)))return '待复核';return r.confirmedAt?'已复核':'待确认';}
export function metricGuard(s,p){return JSON.stringify([metricSnapshot(s,p),metricReport(s,p)]);}
function assertGuard(s,p,guard){if(guard!==metricGuard(s,p))throw Error('指标或报告已变化，请重新打开后核对');}
export function saveMetrics(s,p,values,sampleAt,now=Date.now()){
 checkPeriod(p);const metrics={};
 for(const k of Object.keys(metricLabels)){const v=values[k];if(v===null||v===undefined||String(v).trim()===''){metrics[k]=null;continue;}const n=Number(v);if(!Number.isSafeInteger(n)||n<0)throw Error('指标应为大于等于 0 的安全整数，缺失请留空');metrics[k]=n;}
 const stamp=new Date(sampleAt).getTime();if(!sampleAt||!Number.isFinite(stamp)||stamp>now+60000)throw Error('请填写真实采样时间，不能晚于当前时间');
 const next={metrics,sampleAt:new Date(stamp).toISOString()};if(same(next,metricSnapshot(s,p)))return false;
 const report=structuredClone(metricReport(s,p));report.needsReview=true;
 s.reviewReports??={};s.reviewReports[p]=report;s.reviews[p]=metrics;s.reviewSampleTimes??={};s.reviewSampleTimes[p]=next.sampleAt;return true;
}
export function confirmMetricReport(s,p,guard,ack,now=Date.now()){
 if(!ack)throw Error('请先核对并勾选确认');assertGuard(s,p,guard);
 const r=structuredClone(metricReport(s,p));r.reviewedAgainst=metricSnapshot(s,p);r.confirmedAt=now;r.needsReview=false;r.checks.push({at:now,revision:r.revision,against:structuredClone(r.reviewedAgainst),action:'still_applicable'});
 s.reviewReports??={};s.reviewReports[p]=r;return r;
}
export function editMetricReport(s,p,guard,data,ack,now=Date.now()){
 if(!ack)throw Error('请核对当前数据与报告后确认');assertGuard(s,p,guard);
 const observations=String(data.observations||'').trim(),hypothesis=String(data.hypothesis||'').trim(),suggestions=[data.suggestion1,data.suggestion2,data.suggestion3].map(x=>String(x||'').trim()).filter(Boolean);
 if(!observations||observations.length>8000||!hypothesis||hypothesis.length>8000||!suggestions.length||suggestions.some(x=>x.length>2000))throw Error('请填写事实、可能原因和至少一条建议，并遵守字数限制');
 const r=structuredClone(metricReport(s,p));const {history,...old}=r;r.history=[...history,old];r.revision++;r.basis=metricSnapshot(s,p);r.reviewedAgainst=structuredClone(r.basis);r.observations=observations;r.hypothesis=hypothesis;r.suggestions=suggestions.map((text,i)=>({id:'suggestion-'+(i+1),text}));r.confirmedAt=now;r.needsReview=false;r.checks=[];r.editedAt=now;
 s.reviewReports??={};s.reviewReports[p]=r;return r;
}
export function addMetricTodos(s,p,ids){
 if(metricReportStatus(s,p)!=='已复核')throw Error('请先复核并确认报告，再转为待办');
 const r=metricReport(s,p);if(!ids.length||ids.some(id=>!r.suggestions.some(x=>x.id===id)))throw Error('请先选择有效的改进建议');
 let n=0;for(const id of new Set(ids)){if(s.todos.some(t=>t.reviewSource?.reportId===r.id&&t.reviewSource?.revision===r.revision&&t.reviewSource?.suggestionId===id))continue;
 s.todos.push({id:uid(),title:r.suggestions.find(x=>x.id===id).text,done:false,reviewSource:{reportId:r.id,period:p,revision:r.revision,suggestionId:id,title:r.title,example:true,checkedAgainst:structuredClone(r.reviewedAgainst),createdAt:Date.now()}});n++;}return n;
}
export function metricTodoLabel(s,t){if(t.contentReviewSource)return contentTodoLabel(s,t);const ref=t.reviewSource;if(!ref)return '来自数据复盘';const r=metricReport(s,ref.period);return `示例复盘 · ${periodLabel(ref.period)} · ${r.revision!==ref.revision?'来源报告已修订，请核对':metricReportStatus(s,ref.period)==='待复核'?'来源报告待复核':'来源报告已复核'}`;}
export function metricComparison(s,p){const r=metricReport(s,p),current=metricSnapshot(s,p);return `<div class="metric-comparison"><table><caption>报告原依据与当前数据 · ${periodLabel(p)}</caption><thead><tr><th scope="col">项目</th><th scope="col">报告原依据</th><th scope="col">当前数据</th></tr></thead><tbody>${Object.entries(metricLabels).map(([k,label])=>`<tr class="${r.basis.metrics[k]!==current.metrics[k]?'metric-changed':''}"><th scope="row">${label}</th><td>${metricValue(r.basis.metrics[k])}</td><td>${metricValue(current.metrics[k])}${r.basis.metrics[k]!==current.metrics[k]?' · 已变化':''}</td></tr>`).join('')}<tr class="${r.basis.sampleAt!==current.sampleAt?'metric-changed':''}"><th scope="row">真实采样时间</th><td>${esc(sampleTime(r.basis.sampleAt))}</td><td>${esc(sampleTime(current.sampleAt))}${r.basis.sampleAt!==current.sampleAt?' · 已变化':''}</td></tr></tbody></table></div>`;}
export function metricReportPanel(s,p){const r=metricReport(s,p),status=metricReportStatus(s,p);return `<section class="panel review-report"><div class="section-heading"><h2>这条内容，留下了什么？</h2><span class="badge">示例报告 · ${status}</span></div>${status==='待复核'?'<div class="content-review" role="status"><strong>指标或采样时间已修改，报告需要复核</strong><p>原报告和原依据已保留。请对照当前数据确认仍适用，或编辑报告后重新确认。</p></div>':''}${metricComparison(s,p)}${r.confirmedAt?`<p class="micro">最近复核：${esc(sampleTime(r.confirmedAt))} · 确认仍适用不会改写下方原报告。</p>`:'<p class="micro">示例报告尚未在此流程确认，请先核对后再转为待办。</p>'}<div class="button-row"><button class="btn secondary" data-action="metric-report-confirm">对照并确认仍适用</button><button class="btn secondary" data-action="metric-report-edit">编辑报告并确认</button></div><section class="review-section"><div><h3>观察事实 · 报告保留内容</h3><p class="reference-copy">${esc(r.observations)}</p></div></section><section class="review-section"><div><h3>可能原因 · 待验证</h3><p class="reference-copy">${esc(r.hypothesis)}</p></div></section><section class="review-section"><div><h3>下一次，试一个小改变</h3>${r.suggestions.map(c=>`<label class="improvement"><input type="checkbox" name="improvement" value="${esc(c.id)}" ${status!=='已复核'?'disabled':''}><span>${esc(c.text)}</span></label>`).join('')}</div></section><div class="report-footer"><span class="micro muted">${status==='已复核'?'选中的建议将保留报告来源':'请先复核报告，再转为待办'}</span><button class="btn primary" data-action="review-todos" ${status!=='已复核'?'disabled':''}>将选中建议转为待办</button></div>${r.history.length?`<details class="report-history"><summary>查看原报告 · ${r.history.length} 个版本</summary>${r.history.map(v=>`<article><h3>版本 ${v.revision} · 保留记录</h3><p>原依据：${esc(metricFacts(v.basis))} 采样时间：${esc(sampleTime(v.basis.sampleAt))}</p><p class="reference-copy">${esc(v.observations)}</p><p class="reference-copy">${esc(v.hypothesis)}</p>${v.suggestions.map(x=>`<p>${esc(x.text)}</p>`).join('')}</article>`).join('')}</details>`:''}</section>`;}
