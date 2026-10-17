import {esc} from './store.js';

export const reviewNames={assets:'选用资产',outline:'提纲',script:'口播稿',finalTitle:'最终标题',cover:'封面',publish:'发布检查'};
const sourceNames={assetIds:'选用资产',viewpoint:'核心观点',outline:'提纲',script:'口播稿',finalTitle:'最终标题'};
const dependencies={assetIds:['outline','script','finalTitle','cover','publish'],viewpoint:['assets','outline','script','finalTitle','cover','publish'],outline:['script','finalTitle','cover','publish'],script:['finalTitle','cover','publish'],finalTitle:['cover','publish']};
const present=(t,key)=>key==='assets'?t.assetIds?.length:key==='publish'?Boolean(t.script||t.finalTitle||t.cover):Boolean(t[key]);
export const pendingReviews=t=>Object.keys(reviewNames).filter(key=>t.needsReview?.[key]?.length);
export const needsReview=(t,key)=>Boolean(t.needsReview?.[key]?.length);
export function reliable(t,key){
  if(needsReview(t,key))return false;
  if(key==='finalTitle'&&t.finalTitleConfirmedValue!==undefined)return Boolean(t.finalTitle?.trim()&&t.finalTitle===t.finalTitleConfirmedValue);
  if(key==='cover'&&t.finalCoverId)return Boolean(t.coverVersions?.some(v=>v.id===t.finalCoverId)&&t.coverSnapshot?.title===t.finalTitle);
  if(key==='viewpoint')return Boolean(t.viewConfirmed&&t.viewpoint?.trim());
  if(key==='outline')return Boolean(t.outlineConfirmed&&t.outline?.trim()&&reliable(t,'viewpoint'));
  if(key==='script')return Boolean(t.final&&t.script?.trim()&&reliable(t,'outline'));
  return Boolean(present(t,key));
}

// Do not delete dependent work, alter production status, or invent a new confirmation.
export function changeContent(t,key,value){
  if(t[key]===value)return false;
  if(key==='finalTitle'&&t.cover&&!t.coverSnapshot)t.coverSnapshot={title:t.finalTitle||t.title,request:t.coverRequest||''};
  t[key]=value;
  if(key==='viewpoint')t.viewConfirmed=false;
  if(key==='outline')t.outlineConfirmed=false;
  if(key==='script'){
    if(t.final||t.inRepository||t.archivedAt)t.inRepository=true;
    t.final=false;
  }
  for(const target of dependencies[key]||[]){
    if(!present(t,target))continue;
    t.needsReview??={};
    t.needsReview[target]=[...new Set([...(t.needsReview[target]||[]),key])];
  }
  return true;
}

export function reviewBlocker(t,key){
  if(!reliable(t,'viewpoint'))return '请先确认当前核心观点';
  if(['script','finalTitle','cover','publish'].includes(key)&&t.outline&&!reliable(t,'outline'))return '请先复核并确认当前提纲';
  if(['finalTitle','cover','publish'].includes(key)&&t.script&&!reliable(t,'script'))return '请先复核口播稿并确认定稿';
  if(['cover','publish'].includes(key)&&needsReview(t,'finalTitle'))return '请先复核最终标题';
  if(key==='publish'&&needsReview(t,'cover'))return '请先复核封面';
  return '';
}
export function confirmReview(t,key){
  if(!Object.hasOwn(reviewNames,key)||!needsReview(t,key))return;
  const blocker=reviewBlocker(t,key);if(blocker)throw Error(blocker);
  delete t.needsReview[key];
}
export function confirmStage(t,key){
  if(key==='viewpoint'){
    if(!t.viewpoint?.trim())throw Error('请先写下你的核心观点');
    t.viewConfirmed=true;
  }else if(key==='outline'){
    if(!reliable(t,'viewpoint'))throw Error('请先确认当前核心观点');
    if(!t.outline?.trim())throw Error('请先填写或生成提纲');
    if(t.needsReview)delete t.needsReview.outline;
    t.outlineConfirmed=true;
  }
}
export function confirmNoImpact(t){
  // Validate on a copy so a later blocker cannot partially clear earlier warnings.
  const copy=structuredClone(t);
  for(const key of pendingReviews(copy))confirmReview(copy,key);
  t.needsReview=copy.needsReview;
}
export function reviewBanner(t){
  const keys=pendingReviews(t);if(!keys.length)return '';
  return `<section class="content-review" aria-label="修改后复核"><div><strong>内容有改动，以下成果需要复核</strong><p>已保留现有内容。请对照新的表达检查，再确认是否仍适用。</p></div><div class="review-items">${keys.map(key=>`<button type="button" class="btn secondary small" data-action="review-content" data-value="${key}">${reviewNames[key]}待复核</button>`).join('')}</div><button type="button" class="text-btn" data-action="review-no-impact">仅措辞调整，确认不影响下游</button></section>`;
}
export function reviewDescription(t,key){
  const reasons=(t.needsReview?.[key]||[]).map(x=>sourceNames[x]||x).join('、');
  return `<p>${esc(reasons)}有改动，请核对${reviewNames[key]}是否仍适用于当前内容。</p>`;
}
