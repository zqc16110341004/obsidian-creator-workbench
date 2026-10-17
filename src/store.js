import {freshTimer} from './timer.js';
export const STORAGE_KEY='creator-workbench-prototype-v1';
export const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const uid=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now()+'-'+Math.random().toString(16).slice(2);
export function dateInput(date=new Date()){const d=new Date(date);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
export const sampleScript='你有没有这种感觉：工具越装越多，真正写出来的内容却越来越少？\n\n我的判断是，创作卡住，往往不是工具不够，而是每次打开电脑，都要重新找资料、确认进度，再决定下一步。\n\n热点在浏览器里，选题在表格里，稿件又在另一个文档里。每次切换，我们都要重新想起这条内容做到哪了。\n\n所以，我想把一条内容需要的资料、稿件和下一步动作放在一起。今天继续创作时，能直接接着上次往下走。\n\n你最常卡在哪一步：选题、写稿，还是发布前的整理？';
export const candidates=[
{id:'candidate-angle',type:'角度',name:'从任务出发',method:'先说明要解决的问题，再介绍工具。',scene:'讲解工具或方法时',source:'示例拆解报告'},
{id:'candidate-structure',type:'结构',name:'任务到结果',method:'场景 → 结果 → 步骤 → 适用边界。',scene:'教程与实操内容',source:'示例拆解报告'},
{id:'candidate-opening',type:'开场',name:'结果先行',method:'先让观众看见能获得什么。',scene:'结果容易展示的内容',source:'示例拆解报告'},
{id:'candidate-title',type:'标题',name:'任务与收益',method:'标题说清要解决的具体问题。',scene:'工具测评与方法分享',source:'示例拆解报告'}];
export function initialState(now=Date.now()){
 const due=new Date(now+2*86400000);
 return {version:1,settings:{reduced:false,simulateFailure:false},timer:freshTimer(),activeTaskId:'task-demo',selectedTopicId:'topic-1',
 topics:[
 {id:'topic-1',title:'工具越多，创作为什么越慢？',reference:'从资料分散谈创作中断，把下一步放到眼前。',source:'示例选题'},
 {id:'topic-2',title:'从一个真实任务讲清 AI 工具',reference:'先讲任务，再讲功能；用具体结果帮助观众理解。',source:'示例选题'},
 {id:'topic-3',title:'把零散灵感变成可写的选题',reference:'先记录真实问题，再确认自己想表达的观点。',source:'示例选题'},
 {id:'topic-4',title:'一条口播如何复用历史积累',reference:'调用合适的结构与开场，保留自己的表达。',source:'示例选题'}],
 tasks:[{id:'task-demo',topicId:'topic-1',title:'工具越多，创作为什么越慢？',status:'创作中',stage:2,due:dateInput(due),viewpoint:'创作效率的瓶颈往往是上下文分散，而不是工具不够。',viewConfirmed:true,outline:'1. 从打开电脑却找不到资料的瞬间切入\n2. 解释工具切换如何打断创作\n3. 展示把资料、稿件与下一步放在一起的方法\n4. 邀请观众分享最常卡住的环节',outlineConfirmed:true,script:sampleScript,final:false,finalTitle:'',cover:false,assetIds:[],messages:[],publishedAt:''}],
 assets:[{id:'asset-question',type:'开场',name:'从具体困扰切入',method:'把抽象问题变成观众经历过的一个瞬间。',scene:'经验分享与方法内容',source:'示例资产 · 场景开场'},
 {id:'asset-structure',type:'结构',name:'问题、判断、行动',method:'描述问题，给出自己的判断，再给一个可执行动作。',scene:'观点型口播',source:'示例资产 · 观点结构'}],
 notes:[],inbox:[{id:'inbox-1',title:'一个关于创作流程的灵感',text:'把当前步骤和参考资料放到同一处。',kind:'文字'}],todos:[],
 trends:[{id:'trend-1',author:'示例博主 A',platform:'小红书',title:'从一个真实任务讲清 AI 工具',text:'先展示任务结果，再解释关键步骤，最后说明适用边界。',status:'未处理'},
 {id:'trend-2',author:'示例博主 B',platform:'X',title:'把日常问题变成一个口播选题',text:'从一个具体困扰出发，记录自己的判断，再补充支撑材料。',status:'未处理'},
 {id:'trend-3',author:'示例博主 A',platform:'小红书',title:'一条内容结束后，还能留下什么？',text:'把角度、结构、开场存下来，让下一次创作有起点。',status:'未处理'}],
 bloggers:[{id:'blog-a',name:'示例博主 A',platform:'小红书'},{id:'blog-b',name:'示例博主 B',platform:'X'}],
 reviews:{'24h':{views:800,likes:41,saves:27,comments:6},'7d':{views:1250,likes:68,saves:42,comments:12}},reviewConfirmed:true,reviewAt:now,reviewPublishedAt:now-7*86400000,reviewGenerated:true,reviewTitle:'工具越多，创作为什么越慢？',lastRefresh:null};
}
export function createTask(state,topicId){
 const existing=state.tasks.find(t=>t.topicId===topicId);if(existing){state.activeTaskId=existing.id;return {task:existing,created:false};}
 const topic=state.topics.find(t=>t.id===topicId);if(!topic)throw new Error('请先选择一个选题');if(topic.missingTitle)throw new Error('请先在飞书补齐标题，再刷新选题');
 const task={id:uid(),topicId,title:topic.title,status:'创作中',stage:0,due:'',viewpoint:'',viewConfirmed:false,outline:'',outlineConfirmed:false,script:'',final:false,finalTitle:'',finalTitleConfirmedValue:'',cover:false,assetIds:[],messages:[],publishedAt:''};
 if(state.settings.writingPreferences)task.writingPreferences=structuredClone(state.settings.writingPreferences);
 task.sourceSnapshot=structuredClone({title:topic.title,reference:topic.reference||'',url:topic.url||'',links:topic.links||[],...(topic.feishu?{feishu:topic.feishu}:{})});
 task.references=[topic.reference,...(topic.links||[]),...(topic.url&&!topic.links?.includes(topic.url)?[topic.url]:[])].filter(Boolean).join('\n\n');
 if(topic.testOnly||/【(?:流程测试|功能验收|采样功能验收|测试)】/.test(topic.title))task.testOnly=true;
 if(topic.originId){for(const kind of ['notes','inbox']){const original=state[kind].find(x=>x.id===topic.originId||kind==='notes'&&'note-'+x.id===topic.originId);if(original){original.taskLinks??=[];original.taskLinks.push({taskId:task.id,linkedAt:Date.now()});task.sourceMaterials??=[];task.sourceMaterials.push({kind,id:original.id,title:original.title||original.text.slice(0,40),text:original.text||'',url:original.url||'',linkedAt:Date.now()});}}}
 state.tasks.push(task);state.activeTaskId=task.id;return {task,created:true};
}
export function addUnique(list,item,key='id'){if(list.some(x=>x[key]===item[key]))return false;list.push(item);return true;}
export function validateMetrics(data){return ['views','likes','saves','comments'].every(k=>Number.isInteger(data[k])&&data[k]>=0);}
export function createStore(storage){
 let state=initialState(),loadError='';
 try{const saved=storage?.getItem(STORAGE_KEY);if(saved){const parsed=JSON.parse(saved);if(parsed.version!==1||!Array.isArray(parsed.topics)||!Array.isArray(parsed.tasks))throw new Error('invalid');state={...state,...parsed};}}
 catch{loadError='原型记录暂时无法读取，正在使用示例内容。';}
 return {get state(){return state;},loadError,save(){try{storage?.setItem(STORAGE_KEY,JSON.stringify(state));return Boolean(storage);}catch{return false;}},update(fn){fn(state);return this.save();},reset(){state=initialState();return this.save();}};
}

