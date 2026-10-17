import {esc} from './store.js';
import {publishedContents,samplesFor,targetTime} from './content-sampling.js';
import {contentReportStatus} from './content-ai-review.js';
const nodeName=p=>p==='24h'?'24 小时采样':'7 天采样与复盘';
const localTime=ms=>new Date(ms).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
export function overdueLabel(target,now){const minutes=Math.floor(Math.max(0,now-target)/60000);if(!minutes)return '已到期';const days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),mins=minutes%60;return '已逾期 '+[days?days+' 天':'',hours?hours+' 小时':'',!days&&mins?mins+' 分钟':''].filter(Boolean).join(' ');}
export function publicationReminders(s,{now=Date.now(),includeTests=false,taskId=null}={}){
 const rows=[];
 for(const t of publishedContents(s,includeTests).filter(t=>!taskId||t.id===taskId))for(const period of ['24h','7d']){
  const target=targetTime(t,period),samples=samplesFor(s,t.id).filter(x=>x.period===period);
  const valid=samples.filter(x=>x.confirmedAt&&x.publishedAtSnapshot===t.publishedAt&&Date.parse(x.sampledAt)>=target&&Date.parse(x.sampledAt)<=now&&x.metrics?.some(m=>Number.isSafeInteger(m.value)&&m.value>=0));
  const reports=(s.contentReports||[]).filter(r=>r.taskId===t.id&&r.basis);
  const doneReport=reports.some(r=>contentReportStatus(s,r)==='已确认'&&(r.reviewedAgainst||r.basis).samples.some(x=>x.period==='7d'&&valid.some(v=>v.id===x.id)));
  let status,action='',label='',reason='';
  if(period==='24h'&&valid.length||period==='7d'&&valid.length&&doneReport){status='done';reason=period==='24h'?'已保存核对后的实际采样':'已保存 7 天采样并确认复盘';}
  else if(now<target){status='upcoming';reason='未到期';}
  else {status='due';if(!valid.length){action='sample';label='记录'+(period==='24h'?'24 小时':'7 天')+'数据';reason=samples.length?'已有采样早于目标，或发布资料已变更，请核对后记录实际数据':'尚未记录；请填写实际采样时间，不回填目标时间';}else{action='report';const pending=reports.some(r=>contentReportStatus(s,r)==='待复核');const draft=reports.some(r=>contentReportStatus(s,r)==='待确认');label=pending?'复核报告':draft?'核对报告':'准备复盘';reason=pending?'采样已保存，已有报告需要复核':draft?'采样已保存，复盘候选尚未确认':'采样已保存，请结合原稿复盘';}}
  rows.push({id:t.id+':'+period,taskId:t.id,title:t.finalTitle||t.title,testOnly:Boolean(t.testOnly),period,target,status,action,label,reason,timeLabel:status==='due'?overdueLabel(target,now):status==='done'?'已完成':'未到期'});
 }
 return rows.sort((a,b)=>a.target-b.target||a.id.localeCompare(b.id));
}
export function reminderPanel(s,ui={},taskId=null,now=Date.now()){
 const rows=publicationReminders(s,{now,includeTests:taskId?Boolean(ui.includeSamplingTests):Boolean(ui.reminderTests),taskId}),due=rows.filter(r=>r.status==='due'),visible=taskId?rows:due;
 const upcoming=rows.find(r=>r.status==='upcoming');
 return `<section class="panel publication-reminders" aria-label="采样与复盘提醒"><div class="section-heading"><h2>${taskId?'本条内容的到期进度':'采样与复盘提醒'}</h2><span class="badge">${due.length} 项待处理${!taskId&&ui.reminderTests?' · 含测试':''}</span></div>${!taskId?`<label class="review-ack"><input id="reminder-tests" type="checkbox" ${ui.reminderTests?'checked':''}>显示测试提醒（不计入正式统计）</label>`:''}${visible.map(r=>`<article class="reminder-row ${r.status}"><div><strong>${taskId?'':esc(r.title)+' · '}${nodeName(r.period)}${r.testOnly?' · 测试':''}</strong><p><span class="${r.status==='due'?'overdue':''}">${esc(r.timeLabel)}</span> · 目标：${esc(localTime(r.target))}</p><p class="micro">${esc(r.reason)}</p></div>${r.action?`<button type="button" class="btn secondary" data-action="reminder-open" data-id="${esc(r.taskId)}" data-value="${r.period}">${r.label}</button>`:''}</article>`).join('')||`<p class="micro">${upcoming?'暂无到期事项。下一节点：'+esc(upcoming.title)+' · '+nodeName(upcoming.period)+' · '+esc(localTime(upcoming.target)):rows.length?'当前已发布内容的采样与复盘已完成。':'暂无真实发布记录；保存实际发布时间后会显示提醒。'}</p>`}<p class="micro muted">按实际发布时间计算；关闭或休眠后再次打开会补算逾期。漏采不会补造数据，点击后由你记录或发起复盘。</p></section>`;
}
export function reminderDestination(s,taskId,period,now=Date.now()){
 const row=publicationReminders(s,{now,taskId,includeTests:true}).find(x=>x.period===period);if(!row||row.status!=='due')throw Error('这个节点当前无需处理，请查看最新进度');return row;
}
// Refresh only reminder islands; never replace a focused control or the editor.
export function refreshReminderRegions({document,state,ui,now=Date.now(),force=false}){
 for(const el of document.querySelectorAll('[data-reminder-region]')){if(!force&&el.contains(document.activeElement))continue;const html=reminderPanel(state,ui,el.dataset.reminderTask||null,now);if(el.innerHTML!==html)el.innerHTML=html;}
}
