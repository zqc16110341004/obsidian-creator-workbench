import {reliable,pendingReviews,reviewNames} from './content-review.js';
import {contentReportStatus} from './content-ai-review.js';
export const statuses=['创作中','待拍摄','待剪辑','待发布','已发布、待复盘','已复盘'];
export function nextAction(t){
 if(t.publishedAt)return {route:'review',label:t.status==='已复盘'?'查看复盘与改进待办':'记录数据并完成复盘'};
 const pending=pendingReviews(t);
 if(!reliable(t,'viewpoint'))return {route:'studio',stage:0,label:pending.length?'确认修改后的核心观点':'补充并确认核心观点'};
 if(pending.includes('assets'))return {route:'studio',stage:1,tab:'assets',label:'复核选用资产'};
 if(!reliable(t,'outline'))return {route:'studio',stage:1,label:pending.includes('outline')?'复核提纲':'确认角度与提纲'};
 if(!reliable(t,'script'))return {route:'studio',stage:2,label:pending.includes('script')?'复核口播稿':'修改并确认口播稿'};
 if(pending.length){const key=pending[0];return {route:'studio',stage:{assets:1,outline:1,script:2,finalTitle:3,cover:3,publish:4}[key],tab:key==='assets'?'assets':null,label:`复核${reviewNames[key]}`};}
 if(t.status==='待拍摄')return {route:'studio',stage:2,label:'完成拍摄后更新进度'};
 if(t.status==='待剪辑')return {route:'studio',stage:2,label:'完成剪辑后更新进度'};
 if(t.status==='待发布')return {route:'studio',stage:4,label:'完成发布检查'};
 if(!reliable(t,'finalTitle')||!reliable(t,'cover'))return {route:'studio',stage:3,label:'准备标题与封面'};
 return {route:'studio',stage:4,label:'核对发布准备'};
}
// Publication facts and review confirmation cannot be manufactured by a status selector.
export function changeProgress(s,t,status){
 if(!statuses.includes(status))throw Error('请选择有效进度');
 if(status==='已发布、待复盘')return 'publication';
 if(status==='已复盘'){
  if(!t.publishedAt||!(s.contentReports||[]).some(r=>r.taskId===t.id&&r.basis&&contentReportStatus(s,r)==='已确认'))throw Error('请先到数据复盘核对并确认本条内容的复盘报告');
 }else{
  if(t.publishedAt)throw Error('已保存实际发布记录，不能退回未发布进度；仍可返回各步骤修改稿件');
  if(status!=='创作中'&&!reliable(t,'script'))throw Error('请先确认观点、提纲并将稿件定稿，再更新拍摄或剪辑进度');
 }
 t.status=status;
 if(status==='待发布')t.stage=4;
 return 'saved';
}
export function saveTaskChange(t,change,persist){const before=structuredClone(t);try{const value=change();if(!persist(true))throw Error('本地保存未完成，已恢复原进度，请重试或导出备份');return value;}catch(e){for(const k of Object.keys(t))delete t[k];Object.assign(t,before);throw e;}}
