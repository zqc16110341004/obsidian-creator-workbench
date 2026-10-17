import {initialState,dateInput} from '../../src/store.js';
import {assetSnapshot} from '../../src/asset-recommendations.js';
import {addCoverVersion,confirmCover} from '../../src/cover-workflow.js';
import {reviewBasis} from '../../src/content-ai-review.js';
export function presentationFixture(now=Date.UTC(2026,9,17,0,0,0)){
const day=86400000,iso=n=>new Date(n).toISOString(),date=n=>dateInput(new Date(n));
const s=initialState(now);Object.assign(s,{activeTaskId:'showcase-writing',selectedTopicId:'showcase-topic-1',tasks:[],topics:[],assets:[],notes:[],inbox:[],todos:[],trends:[],bloggers:[],samples:[],contentReports:[],contentReviewJobs:[],videoRecords:[],topicSubmissions:[]});
s.settings={reduced:false,simulateFailure:false,presentationMode:true};
const methodRows=[
 ['角度','把抽象能力转成具体工作状态','先说能力，再说明它改变了用户的哪一步操作。把“持续运行”讲成“合上电脑后，任务仍能继续”。','工具介绍、功能讲解'],
 ['结构','先讲困境，再给判断和行动','一个具体困境 → 一句自己的判断 → 三个可执行步骤 → 适用边界。每一步都回答同一个问题。','方法分享、观点口播'],
 ['开场','从观众经历过的一个瞬间开始','先写一个能被想象的场景，再指出场景里的困难。比如收藏了几十条资料，打开相机却不知道先讲哪条。','经验分享、创作方法'],
 ['角度','用用户如何交代工作区分产品','围绕用户要定义什么、系统负责什么比较产品。先统一任务，再对照分工、交接和结果核对。','同类工具比较'],
 ['结构','推荐理由之后，先找共性再辨差异','先说明推荐理由，再讲两款产品共同解决的问题，最后围绕同一任务说明使用方式的区别。','工具观察、产品分析'],
 ['标题','把大话题缩成一个今天能做的动作','从“如何做自媒体”收敛到“从十条灵感里选出今天能拍的一条”。标题与正文解决同一个小问题。','教程、选题练习'],
 ['开场','先给判断，再解释两个理由','开场明确自己的判断，随后预告有限数量的理由。后文逐项兑现，避免一上来铺很多背景。','观点表达、工具选择'],
 ['标题','用顺序讲清方法','把方法压缩成“先做什么，再做什么”，并在正文解释为什么这个顺序适用。','方法论、流程说明']
];
s.assets=methodRows.map(([type,name,method,scene],i)=>({id:'showcase-asset-'+(i+1),type,name,method,scene,source:'推广演示内容集 · 预置方法案例',sourceUrl:'',report:'为展示方法复用流程人工编写，不代表真实账号传播验证。',excerpt:'演示方法，非外部作者原文摘录。',example:true,presentationExample:true,confirmedAt:now-day,origin:'manual'}));
const topicTitles=['收藏了很多灵感，为什么还是写不出来？','先定任务，再选工具','让 AI 帮你写，而不是替你表达','从一条口播里，留下四种可复用的方法','数据不好，先别急着换选题','把“我想分享 AI”缩小成一个问题','一条口播开场，怎么删掉无用铺垫','素材很多，先挑出今天能讲清的一件事','同类 AI 工具，究竟该比较什么','下次写稿前，先看上次的复盘','别让每一次创作，都从零开始','把一条好建议变成今天的行动'];
s.topics=topicTitles.map((title,i)=>({id:'showcase-topic-'+(i+1),title,reference:['先用一个具体困境说明问题，再给观众能跟着做的小动作。','比较能力时，先说清楚要完成哪一个任务。','保留创作者的观点、事实和最终选择，让 AI 帮忙组织表达。'][i%3],source:'演示选题 · 内容创作日常',links:[],url:'',presentationExample:true}));
const scripts={
 writing:'收藏夹里存了几十条灵感，轮到自己拍视频，还是不知道先讲什么？\n\n先别继续找资料，拿出其中一条，回答三个问题。\n\n第一，讲给谁听？别只写“想做自媒体的人”，可以具体到刚开始拍口播、每天纠结选题的新手。\n\n第二，帮他解决什么问题？“怎么做自媒体”太大了，换成“怎么从十条灵感里，选出今天要拍的一条”。\n\n第三，你能讲出什么真实例子？先选自己做过、能说清经过的一条；缺少例子，就先把缺口记下来。\n\n把这三个答案连起来，选题就具体了：我想帮口播新手，从收藏夹里挑出今天能讲清的一件事。\n\n今天先把这一条写完，再去收藏下一条。',
 tools:'工具越装越多，真正完成的事情却越来越少？\n\n试试把顺序换一下：先定任务，再选工具。\n\n比如今天要做的，不是“学会一个 AI”，而是把一段会议记录整理成三条行动：谁来做、做什么、什么时候完成。\n\n任务清楚了，再找能处理它的工具。先用一小段材料试一下，看有没有遗漏责任人、时间和限制。能完成，再放到正式流程里。\n\n用完后留下一条记录：这次它帮到了哪一步，哪一步还需要自己检查。下次遇到同类任务，就不用重新试一遍。\n\n少追一个新工具，多完成一个具体任务。',
 own:'AI 给你写了一篇很顺的稿子，读起来却不像自己？\n\n先别急着让它“更口语化”。把三个东西补进去：你想表达的判断、能支撑判断的事实、你不想夸大的边界。\n\n比如，你想说的不是“AI 能解决创作焦虑”，而是“资料和进度放在一起，能帮助我接着上次写”。再补一个自己经历过的具体片段。\n\n这时候，请 AI 帮你找结构、删重复、试几种开场。最后把每一句都读一遍：这是我愿意说的话吗？这个例子是真的吗？\n\nAI 可以帮你组织语言，但说什么、信什么、怎么表达，仍然由你决定。',
 reuse:'看完一条好口播，只记住“这条不错”，下次还是不知道怎么写？\n\n试着留四样东西：角度、结构、开场和标题方法。\n\n角度是从哪一面讲这个问题；结构是先讲什么、后讲什么；开场怎样让观众进入一个具体场景；标题承诺解决哪一个小问题。\n\n存下来的应该是能迁移的方法，再记上来源和适用边界。下次先看自己的选题和观点，需要哪一种方法，再选择一条放进稿子。\n\n这样，收藏就不只是越来越长的列表，也能成为你下一次创作的起点。'
};
function task(id,title,script,opts={}){return {id,topicId:'showcase-topic-'+(topicTitles.indexOf(title)+1),title,status:'创作中',stage:2,due:date(now),viewpoint:'先把抽象问题变成具体任务，再用真实例子解释自己的判断。',viewConfirmed:true,outline:'1. 一个具体场景\n2. 提出核心判断\n3. 用三个动作展开\n4. 说明边界并收束',outlineConfirmed:true,script,final:false,finalTitle:'',finalTitleConfirmedValue:'',cover:false,assetIds:[],messages:[],publishedAt:'',references:'推广演示资料：面向刚开始拍口播的创作者，用具体问题与真实经历组织内容。案例文字为人工编写。',sourceSnapshot:{title,reference:'推广演示选题，非飞书真实记录。',links:[]},writingPreferences:{audience:'刚开始拍口播的创作者',length:'约 60–90 秒',style:'具体、克制，有动作建议；不用夸张承诺。'},presentationExample:true,...opts};}
const writing=task('showcase-writing',topicTitles[0],scripts.writing,{viewpoint:'选题卡住时，先明确讲给谁、解决什么问题、有什么真实例子。把收藏缩成今天能讲清的一件事。',assetIds:['showcase-asset-2','showcase-asset-3'],messages:[{role:'user',provider:'presentation',text:'这条是写给刚开始拍口播的人。不要泛泛讲“输出倒逼输入”，想给一个今天能照做的办法。'},{role:'assistant',provider:'presentation',text:'可以先收敛成三个问题：讲给谁、解决什么具体困难、有什么真实例子。\n\n建议用“收藏了很多，却不知道今天拍什么”的场景开头。正文每次只回答一个问题，结尾落到“今天先写完这一条”。'},{role:'user',provider:'presentation',text:'保留这个结构。再把开场缩短，少一点说教，让人能直接代入自己的收藏夹。'},{role:'assistant',provider:'presentation',text:'开场候选：\n“收藏夹里存了几十条灵感，轮到自己拍视频，还是不知道先讲什么？”\n\n后面直接接：\n“先别继续找资料，拿出其中一条，回答三个问题。”\n\n这样先给场景，再进入动作。左侧保留了完整稿件，等你读一遍后再定稿。'}]});
s.tasks.push(writing);
const publishedSpecs=[['showcase-tools',topicTitles[1],scripts.tools,'先定任务，再选工具',12],['showcase-own',topicTitles[2],scripts.own,'让 AI 帮你写，保留自己的表达',10],['showcase-reuse',topicTitles[3],scripts.reuse,'好内容，留下四种方法',9]];
for(const [id,title,script,finalTitle,ago] of publishedSpecs)s.tasks.push(task(id,title,script,{status:'已复盘',stage:3,final:true,inRepository:true,archivedAt:iso(now-ago*day-day),finalTitle,finalTitleConfirmedValue:finalTitle,titleConfirmedAt:now-ago*day-day,due:date(now-ago*day),publishedAt:iso(now-ago*day),publishedUrl:'',assetIds:['showcase-asset-1','showcase-asset-8'],filmReady:true,factsReady:true}));
s.tasks.push(task('showcase-ready',topicTitles[4],'看到播放数字不理想，第一反应是换选题？\n\n先把事实和猜测分开。记下什么时候采样、哪些指标确实有、哪些暂时没有。然后回到原稿，看开场承诺的问题有没有被正文回答。\n\n最后只挑一个小改进：下一条把开场说得更具体，或让标题与正文更一致。先试一次，再看结果，不急着给单条数据找确定原因。',{status:'待拍摄',stage:3,final:true,inRepository:true,archivedAt:iso(now-day),due:date(now+day),finalTitle:'数据不好，先别急着换选题',finalTitleConfirmedValue:'数据不好，先别急着换选题'}));
s.tasks.push(task('showcase-idea',topicTitles[5],'',{stage:0,due:date(now+2*day),viewpoint:'先选定一个读者今天遇到的具体任务，再决定讲哪一个 AI 功能。',viewConfirmed:false,outline:'',outlineConfirmed:false}));
for(const t of s.tasks)t.assetUses=t.assetIds.map(id=>({assetId:id,snapshot:assetSnapshot(s.assets.find(a=>a.id===id)),reason:'展示：这条方法与当前观点一致，帮助把抽象判断讲成具体动作。',usage:id.endsWith('3')?'用于口播第一句，先给能想象的场景。':'用于正文结构和举例，保留自己的事实与表达。',selectedAt:now-day}));
s.notes=[{id:'showcase-note-1',text:'讲“创作效率”时，先从打开电脑后找不到上次写到哪的瞬间讲起。',createdAt:now-3600000},{id:'showcase-note-2',text:'下次比较两款工具，先统一任务，再看用户需要做多少分工和交接。',createdAt:now-1800000}];
s.inbox=[{id:'showcase-inbox-1',title:'关于“收藏很多却难以开始”的观察',text:'可能不是缺少资料，而是每条资料都还没对应到一个具体问题。先做一条，再判断方法是否有用。',kind:'文字',favorite:true},{id:'showcase-inbox-2',title:'下一次工具分析的比较维度',text:'输入怎么交代、任务怎么持续、结果怎么核对、失败怎么恢复。预置演示资料。',kind:'文字'},{id:'showcase-inbox-3',title:'口播开场的删改清单',text:'删掉自我介绍和无关背景，保留具体场景、问题和下一步动作。',kind:'文字'}];
s.bloggers=[{id:'showcase-source-1',name:'工具观察 · 演示栏目',platform:'小红书'},{id:'showcase-source-2',name:'创作方法 · 演示栏目',platform:'X'}];
s.trends=[['从“学一个工具”到“完成一个任务”','先确定交付物和检查标准，再比较工具如何处理任务。'],['把收藏变成可复用的表达方法','记录角度、结构、开场、标题方法，同时保留来源与边界。'],['一份有用的复盘，最后会变成一个动作','先区分观察事实与可能原因，每次只验证一个小改进。']].map(([title,text],i)=>({id:'showcase-trend-'+i,author:'预置演示栏目 · 非真实博主动态',platform:i%2?'X':'小红书',title,text,status:i===1?'收藏':'未处理',presentationExample:true}));
s.todos=[{id:'showcase-todo-1',title:'把口播开场缩成一个具体场景',done:false,due:date(now),presentationExample:true},{id:'showcase-todo-2',title:'下一条只验证“标题与正文是否一致”',done:false,due:date(now+day),presentationExample:true}];
const metricSets=[[[960,54,43,8],[1830,108,96,15]],[[720,39,31,6],[1420,81,68,11]],[[1130,68,61,9],[2360,137,126,18]]];
for(const [i,t] of s.tasks.filter(t=>t.publishedAt).entries()){
 for(const [j,period] of ['24h','7d'].entries())s.samples.push({id:t.id+'-'+period,taskId:t.id,testOnly:false,presentationExample:true,period,sampledAt:iso(Date.parse(t.publishedAt)+(j?7:1)*day),metrics:['views','likes','saves','comments'].map((key,k)=>({key,name:['播放','点赞','收藏','评论'][k],value:metricSets[i][j][k],unit:'次'})),sourceNote:'预置演示数据，非真实账号指标；未附后台截图。仅展示按内容保存与复盘的流程。',screenshot:null,publishedAtSnapshot:t.publishedAt,confirmedAt:Date.parse(t.publishedAt)+7*day+1000,createdAt:Date.parse(t.publishedAt)+(j?7:1)*day,revision:1,history:[]});
}

for(const [i,t] of s.tasks.filter(t=>t.inRepository).entries()){
 const id=String(i+1).repeat(64)+'.png';
 const v=addCoverVersion(t,{id,path:'06-附件/封面图片/'+id,mime:'image/png',name:'合成测试封面',size:100},{source:'imported',request:'测试夹具；不是真实封面'},now-day);
 confirmCover(t,v.id,now-day);t.factsReady=true;delete t.needsReview;
}
for(const t of s.tasks.filter(t=>t.publishedAt)){
 const ids=s.samples.filter(x=>x.taskId===t.id).map(x=>x.id),basis=reviewBasis(s,t.id,ids),latest=s.samples.find(x=>x.taskId===t.id&&x.period==='7d');
 s.contentReports.push({id:t.id+'-report',taskId:t.id,jobId:'presentation-report',testOnly:false,presentationExample:true,sampleIds:ids,basis,reviewedAgainst:structuredClone(basis),observations:`演示案例：7 天采样为 ${latest.metrics[0].value} 次播放、${latest.metrics[2].value} 次收藏。两个节点分别保存，累计数不相加。以上均为预置数字，用于展示报告如何引用采样。`,hypothesis:'如果观众把内容视为可照做的方法，收藏可能是一个观察方向。但仅凭这些指标无法确认原因，需要结合实际评论、观看过程与后续样本核对。此处为复盘写法示意。',limitations:'这是一份预置演示报告，没有真实发布记录或平台后台截图；不能据此判断账号表现、证明产品效果或承诺内容增长。',suggestions:[{id:'showcase-suggestion-'+t.id,text:'下一条保留相同受众与问题，只把开场改为一个具体场景。发布后记录同样时点的数据，结合评论判断是否更容易理解，不只看播放数字。'}],revision:1,createdAt:now-day,confirmedAt:now-day,history:[],checks:[],needsReview:false});
}
return s;
}
