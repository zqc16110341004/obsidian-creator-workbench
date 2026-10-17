const fsDefault = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const KEY = 'creator-workbench-prototype-v1';
const digest = text => createHash('sha256').update(text).digest('hex');
const idName = id => digest(String(id)).slice(0,16);
const text = value => typeof value === 'string' ? value : '';

function validateState(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 10 * 1024 * 1024) throw Error('工作台数据格式或大小不受支持');
  const s = JSON.parse(raw);
  if (s.version !== 1 || !Array.isArray(s.tasks) || !s.tasks.length || !Array.isArray(s.topics)) throw Error('工作台存档格式不正确');
  for (const key of ['assets','notes','inbox','todos','trends','bloggers','samples','contentReports','contentReviewJobs','videoRecords','topicSubmissions']) if (s[key] !== undefined && !Array.isArray(s[key])) throw Error('工作台存档字段不正确');
  const ids = new Set();
  for (const task of s.tasks) {
    if (!task || typeof task.id !== 'string' || ids.has(task.id) || typeof task.title !== 'string' || typeof task.script !== 'string') throw Error('稿件存档不完整');
    ids.add(task.id);
  }
  return s;
}

function documents(s) {
  const out = new Map();
  const preamble = '> 工作台自动导出的查阅副本。请在工作台修改；这里的手动修改不会回写，更新时会保留到待合并文件。\n\n';
  for (const t of s.tasks) {
    const name = idName(t.id);
    const pending=Object.keys(t.needsReview||{}).filter(k=>t.needsReview[k]?.length);
    const reviewLabel=pending.length?'待复核：'+pending.map(k=>({assets:'选用资产',outline:'提纲',script:'口播稿',finalTitle:'最终标题',cover:'封面',publish:'发布检查'})[k]||k).join('、'):'';
    const body = `---\nworkbench_id: ${JSON.stringify(t.id)}\naliases: [${JSON.stringify(t.title)}]\nstatus: ${JSON.stringify(t.status || '创作中')}\ndue: ${JSON.stringify(t.due || '')}\n---\n\n# ${t.title}\n\n${preamble}${reviewLabel}\n\n## 核心观点\n\n${text(t.viewpoint)}\n\n## 提纲\n\n${text(t.outline)}\n\n## 口播稿\n\n${text(t.script)}\n\n## 最终标题\n\n${text(t.finalTitle) || '待补齐'}\n\n## 参考素材\n\n${text(t.references)}\n\n## 选题来源\n\n${text(t.sourceSnapshot?.feishu?.url) || '本地选题'}\n\n${text(t.sourceSnapshot?.feishu?.recordId)}\n\n## 资产使用\n\n${(t.assetUses||[]).map(u=>`- ${text(u.snapshot?.name||u.assetId)} · ${u.endedAt?'已取消关联':'已选用'}\n  来源：${text(u.snapshot?.source)}\n  理由：${text(u.reason)}\n  用法：${text(u.usage)}\n  关联资产：[[03-创作资产/资产-${idName(u.assetId)}]]\n`).join('\n')||'暂无使用记录'}\n\n## 发布\n\n${text(t.publishedAt) || '尚未发布'}\n\n发布链接：${text(t.publishedUrl)||'待补'}\n`;
    out.set(`01-创作任务/稿件-${name}.md`, body);
    if (t.inRepository || t.final || t.archivedAt) out.set(`02-内容仓库/内容-${name}.md`, `# ${t.finalTitle || t.title}\n\n${preamble}[[01-创作任务/稿件-${name}|返回完整稿件]]\n\n${t.final && t.viewConfirmed && t.outlineConfirmed && !t.needsReview?.outline?.length && !t.needsReview?.script?.length ? '文案已定稿' : '文案待重新确认'}\n\n${reviewLabel}\n\n${text(t.script)}\n\n封面：${t.cover ? '已保留封面生成参数，可在工作台查看和另存为图片。' : '待补齐'}\n`);
  }
  for(const t of s.tasks){if(t.coverVersions?.length)out.set(`02-内容仓库/封面版本-${idName(t.id)}.md`, `# ${text(t.title)} · 封面版本\n\n${preamble}最终版本：${text(t.finalCoverId)||'未确认'}\n\n${t.coverVersions.map((v,i)=>`## 版本 ${i+1} · ${v.source==='codex'?'Codex 生成':'导入图片'}\n\n${text(v.request)}\n\n![[${text(v.file?.path)}]]\n\n依据：${text(v.basis)}\n`).join('\n')}`);}
  for(const [kind,label] of [['notes','随手记录'],['inbox','待处理资料']])out.set(`04-选题与灵感/${label}完整记录.md`, `# ${label}\n\n${preamble}${(s[kind]||[]).map(x=>`## ${text(x.title)||'随手记录'}\n\n${text(x.text)}\n\n${text(x.url)}\n\n状态：${x.archivedAt?'已归档':'待处理'}\n\n${(x.taskLinks||[]).map(l=>'[[01-创作任务/稿件-'+idName(l.taskId)+']]').join('\n')}\n\n关联与整理历史：\n\n`+'```json\n'+JSON.stringify({id:x.id,topicLinks:x.topicLinks||[],history:x.history||[]},null,2)+'\n```').join('\n\n')}`);
  if(s.topicSubmissions?.length)out.set('04-选题与灵感/飞书提交记录.md','# 飞书提交记录\n\n'+preamble+s.topicSubmissions.map(x=>`## ${text(x.payload?.title)}\n\n状态：${x.completedAt?'已完成':'待确认或核实'}\n\n${text(x.error)}\n\n`+'```json\n'+JSON.stringify(x,null,2)+'\n```').join('\n\n'));
  for (const a of s.assets || []) out.set(`03-创作资产/资产-${idName(a.id)}.md`, `# ${text(a.name)}\n\n${preamble}类型：${text(a.type)}\n\n## 可复用方法\n\n${text(a.method)}\n\n## 适用场景\n\n${text(a.scene)}\n\n## 来源\n\n${text(a.source)}\n\n${text(a.sourceUrl)}\n\n${a.videoId?`[[08-视频拆解/视频-${idName(a.videoId)}|查看来源视频与拆解报告]]`:''}\n\n## 关联报告 / 提炼说明\n\n${text(a.report)||'未提供'}\n\n## 原文片段 / 时间点\n\n${text(a.excerpt)||'未提供'}\n\n资产标记：${a.testOnly?'测试资产':a.example||/示例|演示/.test(a.source||'')?'示例资产':a.confirmedAt?'已确认':'待核对旧资产'}\n`);
  for(const v of s.videoRecords||[]){
    const transcript=t=>(t?.segments||[]).map(x=>`[${x.start==null?'时间点未提供':x.start+'–'+x.end+' 秒'}${x.uncertain?' · 识别存疑':''}] ${text(x.text)}`).join('\n\n');
    out.set(`08-视频拆解/视频-${idName(v.id)}.md`, `# ${text(v.title)}\n\n${preamble}作者：${text(v.author)}\n\n来源：${text(v.sourceUrl)||'未知链接'}\n\n原视频：[[${text(v.file?.path)}]]\n\n关联任务：${text(v.taskId)||'独立积累'}\n\n${v.testOnly?'测试视频，不计作真实业务验收。':''}\n\n## 当前转写\n\n${transcript(v.transcript)||'尚无文字'}\n\n${(v.transcriptHistory||[]).map(t=>`## 旧转写版本 ${t.revision}\n\n${transcript(t)}`).join('\n\n')}\n\n${(v.reports||[]).map(r=>`## 报告 ${r.id} · 版本 ${r.revision}\n\n${r.data?Object.entries(r.data).filter(([k])=>k!=='candidates').map(([k,value])=>`${k}：${value}`).join('\n\n'):'格式未通过核验'}\n\n### AI 原回复\n\n${text(r.raw)}\n\n### 本次依据\n\n${transcript(r.basis?.transcript)}\n\n### 候选与修改记录\n\n${JSON.stringify({candidates:r.data?.candidates,history:r.history||[]},null,2)}`).join('\n\n')}`);
  }
  for(const x of s.samples||[]){
    const t=s.tasks.find(t=>t.id===x.taskId),metricText=v=>(v.metrics||[]).map(m=>`${text(m.name)}：${m.value==null?'未提供':m.value+text(m.unit)}`).join('；');
    const recognitionText=v=>v.recognition?'\n\n### 本地截图识别依据\n\n候选供核对，最终值以已确认指标为准；缩写仍为近似值。\n\n'+JSON.stringify(v.recognition,null,2).split('\n').map(line=>'> '+line).join('\n'):'';
    const imageText=v=>v.screenshot&&/^[a-f0-9]{64}\.(png|jpg|webp)$/.test(v.screenshot.id)?`![[06-附件/数据采样/${v.screenshot.id}]]`:'未附截图';
    out.set(`05-复盘与计划/采样-${idName(x.id)}.md`,`# ${x.testOnly?'测试采样':'内容采样'} · ${x.period==='7d'?'7 天':'24 小时'}\n\n${preamble}内容：[[01-创作任务/稿件-${idName(x.taskId)}|${text(t?.title)||text(x.taskId)}]]\n\n实际采样：${text(x.sampledAt)}\n\n确认时发布时间：${text(x.publishedAtSnapshot)}\n\n当前发布时间：${text(t?.publishedAt)}${t?.publishedAt!==x.publishedAtSnapshot?' · 发布时间已变化，请复核':''}\n\n${metricText(x)}\n\n来源说明：${text(x.sourceNote)||'已附原图'}\n\n${imageText(x)}${recognitionText(x)}\n\n## 修改历史\n\n${(x.history||[]).map(v=>`版本 ${v.revision} · ${text(v.sampledAt)}\n\n${metricText(v)}\n\n${text(v.sourceNote)}\n\n${imageText(v)}${recognitionText(v)}`).join('\n\n---\n\n')||'暂无修改'}\n\n## 核对记录\n\n版本 ${x.revision}；确认时间 ${new Date(x.confirmedAt).toISOString()}\n`);
  }
  for(const r of s.contentReports||[]){
    if(!r.basis)continue;
    out.set(`05-复盘与计划/内容复盘-${idName(r.id)}.md`, `# ${r.testOnly?'测试内容复盘':'内容复盘'} · ${text(r.basis.title)}\n\n${preamble}内容：[[01-创作任务/稿件-${idName(r.taskId)}]]\n\n状态：${r.needsReview?'待复核':r.confirmedAt?'已确认':'待确认'} · 版本 ${r.revision}\n\n## 观察事实\n\n${text(r.observations)}\n\n## 可能原因（待验证）\n\n${text(r.hypothesis)}\n\n## 分析限制\n\n${text(r.limitations)}\n\n## 改进建议\n\n${r.suggestions.map(x=>'- '+text(x.text)).join('\n')}\n\n## 所用采样\n\n${r.sampleIds.map(id=>'[[05-复盘与计划/采样-'+idName(id)+']]').join('\n')}\n\n## 原稿、依据与版本历史\n\n\`\`\`json\n${JSON.stringify(r,null,2)}\n\`\`\`\n`);
  }
  for(const j of s.contentReviewJobs||[])if(j.error)out.set(`05-复盘与计划/复盘请求-${idName(j.id)}.md`,`# 复盘请求记录\n\n${preamble}状态：${text(j.status)}\n\n${text(j.error)}\n\n${text(j.rawText)||'无可确认回复'}\n`);
  const contentTodos=(s.todos||[]).filter(t=>t.contentReviewSource);
  if(contentTodos.length)out.set('05-复盘与计划/内容复盘待办.md','# 内容复盘改进待办\n\n'+preamble+contentTodos.map(t=>{const ref=t.contentReviewSource,r=s.contentReports?.find(x=>x.id===ref.reportId);return `- [${t.done?'x':' '}] ${text(t.title)}\n  日期：${text(t.due)||'未排期'}；${ref.testOnly?'测试复盘':'正式内容'}；来源${!r?'缺失':r.revision!==ref.revision?'已修订':r.needsReview?'待复核':'已确认'}\n  原内容：[[01-创作任务/稿件-${idName(ref.taskId)}]]；报告：[[05-复盘与计划/内容复盘-${idName(ref.reportId)}]]；版本 ${ref.revision}；建议 ${text(ref.suggestionId)}${t.targetTaskId?'；后续稿件：[[01-创作任务/稿件-'+idName(t.targetTaskId)+']]':''}\n`;}).join('\n'));
  out.set('04-选题与灵感/选题.md', '# 本地选题\n\n'+preamble+s.topics.map(t=>`## ${text(t.title)}\n\n${text(t.reference)}\n\n来源：${text(t.source)}\n`).join('\n'));
  out.set('04-选题与灵感/随手记录.md', '# 随手记录\n\n'+preamble+(s.notes||[]).map(n=>text(n.text)).join('\n\n---\n\n'));
  out.set('05-复盘与计划/待办.md', '# 改进待办\n\n'+preamble+(s.todos||[]).map(t=>`- [${t.done?'x':' '}] ${text(t.title)}${t.reviewSource?' · 示例复盘 '+t.reviewSource.period+' / 版本 '+t.reviewSource.revision+' / '+(s.reviewReports?.[t.reviewSource.period]?.needsReview?'来源报告待复核':s.reviewReports?.[t.reviewSource.period]?.revision!==t.reviewSource.revision?'来源报告已修订，请核对':'来源报告已复核'):''}`).join('\n'));
  out.set('05-复盘与计划/复盘记录.md', '# 复盘记录\n\n'+preamble+'当前复盘仍为原型演示样本，非账号实时数据。\n\n'+Object.entries(s.reviewReports||{}).map(([p,r])=>`## ${p==='7d'?'7 天':'24 小时'} · ${r.needsReview?'待复核':r.confirmedAt?'已复核':'待确认'}\n\n版本 ${r.revision}；原报告及原数据保留。\n\n${text(r.observations)}\n\n可能原因（待验证）：${text(r.hypothesis)}\n\n${(r.suggestions||[]).map(c=>'- '+text(c.text)).join('\n')}\n`).join('\n')+'\n## 数据与完整复核记录\n\n```json\n'+JSON.stringify({title:s.reviewTitle,metrics:s.reviews,sampling:s.reviewSampleTimes,reports:s.reviewReports},null,2)+'\n```\n');
  return out;
}

class LocalStore {
  constructor(root, fs = fsDefault) { this.root = path.resolve(root); this.fs = fs; this.dir = path.join(this.root,'工作台数据'); this.file = path.join(this.dir,'state.json'); this.backup = path.join(this.dir,'state.previous.json'); this.cached = undefined; }
  atomic(file, content) {
    this.fs.mkdirSync(path.dirname(file),{recursive:true});
    const temp = file + '.pending';
    const fd = this.fs.openSync(temp,'w',0o600);
    try { this.fs.writeFileSync(fd,content); this.fs.fsyncSync(fd); } finally { this.fs.closeSync(fd); }
    this.fs.renameSync(temp,file);
  }
  getItem(key) {
    if (key !== KEY) return null;
    if (!this.fs.existsSync(this.file)) return null;
    const raw = this.fs.readFileSync(this.file,'utf8');
    validateState(raw); // Never silently replace an unreadable vault with demo data.
    this.cached = raw;
    return raw;
  }
  setItem(key, raw) {
    if (key !== KEY) throw Error('未知存储键');
    validateState(raw);
    const previous = this.getItem(key);
    if (raw === previous) return;
    if (previous !== null) this.atomic(this.backup,previous);
    this.atomic(this.file,raw);
    this.cached = raw;
  }
  exportNotes() {
    const raw = this.getItem(KEY);
    if (!raw) return [];
    const indexFile = path.join(this.dir,'export-index.json');
    let index = {};
    try { index = JSON.parse(this.fs.readFileSync(indexFile,'utf8')); } catch { /* Unknown files are always protected. */ }
    const conflicts = [];
    for (const [relative, content] of documents(validateState(raw))) {
      const target = path.join(this.root,relative), hash = digest(content);
      if (this.fs.existsSync(target)) {
        const actual = digest(this.fs.readFileSync(target,'utf8'));
        if (actual === hash) { index[relative] = hash; continue; }
        if (actual !== index[relative]) {
          const conflict = path.join(this.root,'07-更新待合并',path.basename(relative,'.md')+'-'+hash.slice(0,10)+'.md');
          if (!this.fs.existsSync(conflict)) this.atomic(conflict,content);
          conflicts.push(relative);
          continue;
        }
      }
      this.atomic(target,content); index[relative] = hash;
    }
    this.atomic(indexFile,JSON.stringify(index,null,2));
    return conflicts;
  }
}
module.exports = {KEY, LocalStore, validateState, documents};
