const {presentationHost}=require('./presentation-host.cjs');
const {CoverService}=require('./cover-service.cjs');
const {CostLedger}=require('./cost-ledger.cjs');
const {PublicFeeds}=require('./public-feeds.cjs');
const {FeedSettings}=require('./feed-settings.cjs');
const {embeddedSite}=require('./embedded-site.cjs');
const {Plugin, ItemView, Notice, Modal, Setting, MarkdownRenderer, requestUrl} = require('obsidian');
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {LocalStore, KEY} = require('./local-store.cjs');
const {FeishuIntegration} = require('./feishu-integration.cjs');
const {SamplingFiles} = require('./sampling-files.cjs');
const {VideoFiles} = require('./video-files.cjs');
const {ScreenshotOCR} = require('./screenshot-ocr.cjs');
const {CodexClient} = require('./codex-client.cjs');
const VIEW = 'creator-workbench-view';

class WorkbenchView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW; }
  getDisplayText() { return '内容创作工作台'; }
  getIcon() { return 'layout-dashboard'; }
  async onOpen() {
    this.contentEl.empty(); this.contentEl.addClass('creator-workbench-container');
    try {
      this.plugin.disk.getItem(KEY);
      const html = fs.readFileSync(path.join(this.plugin.pluginDir,'workbench.html'),'utf8');
      this.token = randomUUID();
      const hostWindow = this.contentEl.ownerDocument.defaultView;
      this.hostWindow = hostWindow;
      hostWindow.__creatorWorkbenchHosts ??= new Map();
      hostWindow.__creatorWorkbenchHosts.set(this.token,{
        storage: {
          getItem: key => this.plugin.disk.getItem(key),
          setItem: (key,value) => { this.plugin.disk.setItem(key,value); this.plugin.scheduleExport(); }
        },
        kind: 'obsidian',
        openHelp:()=>this.plugin.openGuide('HELP.md'),
        covers:{status:()=>this.plugin.covers.status(),configure:()=>new Promise(resolve=>{const modal=new Modal(this.app);modal.setTitle('封面生成设置');modal.contentEl.createEl('p',{text:'图像生成需要在工作台独立的 Codex 子进程中启用 code_mode 和 code_mode_host。这会增加工具调度与代码执行能力。仅图像进程启用；命令、浏览器、外部插件及其他已知工具仍关闭，不修改全局 Codex 配置。'});modal.contentEl.createEl('p',{text:'生成时会发送你选入的文字和图片，使用现有订阅；随时可以在此关闭。'});new Setting(modal.contentEl).setName('本机图像生成').addButton(b=>b.setButtonText(this.plugin.covers.authorized?'关闭图像工具':'确认启用图像工具').onClick(()=>{this.plugin.covers.authorize(!this.plugin.covers.authorized);modal.close();}));modal.onClose=()=>resolve(this.plugin.covers.status());modal.open();}),save:(data,name)=>this.plugin.covers.files.save(data,name),read:id=>this.plugin.covers.files.read(id),start:(id,prompt,refs)=>this.plugin.covers.start(id,prompt,refs),get:id=>this.plugin.covers.client.snapshot(id),cancel:id=>this.plugin.covers.client.cancel(id)},
        costs:{summary:()=>this.plugin.costs.summary(),confirm:(id,fen,note)=>this.plugin.costs.confirm(id,fen,note)},
        feeds:{status:()=>this.plugin.feeds.status(),fetch:(b,cursor)=>this.plugin.feeds.fetch(b,cursor),configure:()=>new Promise(resolve=>new FeedSettings(this.plugin,resolve).open())},
        openSite: kind => embeddedSite(this,kind),
        video: {save:(data,name)=>this.plugin.video.save(data,name),read:id=>this.plugin.video.read(id),status:()=>this.plugin.video.status(),start:id=>this.plugin.video.start(id),get:id=>this.plugin.video.get(id),cancel:id=>this.plugin.video.cancel(id)},
        screenshotOCR: {status:()=>this.plugin.screenshotOCR.status(),recognize:(id,data)=>this.plugin.screenshotOCR.recognize(id,data),cancel:id=>this.plugin.screenshotOCR.cancel(id)},
        samplingFiles: {save:(data,name)=>this.plugin.samplingFiles.save(data,name),read:id=>this.plugin.samplingFiles.read(id)},
        codex: {status:()=>this.plugin.codex.status(),start:(id,prompt)=>this.plugin.codex.start(id,prompt),get:id=>this.plugin.codex.snapshot(id),cancel:id=>this.plugin.codex.cancel(id)},
        feishu: {
          writes: () => this.plugin.feishu.writes.list(),
          revise: (id,input) => this.plugin.feishu.writes.revise(id,input),
          prepare: (id,input) => this.plugin.feishu.writes.prepare(id,input),
          confirm: id => this.plugin.feishu.writes.confirm(id),
          status: () => this.plugin.feishu.status(),
          configure: () => this.plugin.feishu.configure(),
          readTopics: () => this.plugin.feishu.readTopics(),
          openGuide: () => this.plugin.openGuide('FEISHU_SETUP.md')
        },
        download: (blob,name) => this.plugin.saveDownload(blob,name),
        openExternal: url => { if (/^https?:\/\//i.test(url)) require('electron').shell.openExternal(url); }
      });
      if(this.plugin.presentation){const bridge=hostWindow.__creatorWorkbenchHosts.get(this.token);hostWindow.__creatorWorkbenchHosts.set(this.token,presentationHost(bridge,text=>new Notice(text)));}
      this.frame = this.contentEl.createEl('iframe',{attr:{title:'内容创作工作台',allow:'clipboard-write'}});
      // Trusted local app only; CSP blocks network fetches. It shares a narrow storage bridge.
      this.frame.srcdoc = html.replace('__WORKBENCH_TOKEN__',JSON.stringify(this.token));
    } catch (err) {
      this.contentEl.createEl('h2',{text:'工作台暂时无法打开'});
      this.contentEl.createEl('p',{text:'本地存档未被覆盖。请保留「工作台数据」中的 state.json 与 state.previous.json，再检查存档。'});
      this.contentEl.createEl('pre',{text:err.message});
      new Notice('工作台读取失败，原存档已保留',8000);
    }
  }
  async onClose() {
    this.closeSite?.();
    this.plugin.screenshotOCR?.close();
    this.plugin.video?.close();
    try { this.frame?.contentWindow?.dispatchEvent(new Event('pagehide')); } catch { /* Window may already be closed. */ }
    this.plugin.flushExport();
    this.hostWindow?.__creatorWorkbenchHosts?.delete(this.token);
    this.frame?.remove();
  }
}

module.exports = class CreatorWorkbenchPlugin extends Plugin {
  async onload() {
    const root = this.app.vault.adapter.getBasePath();
    this.pluginDir = path.join(root,this.manifest.dir || `${this.app.vault.configDir}/plugins/${this.manifest.id}`);
    this.disk = new LocalStore(root);
    this.presentation=false;try{this.presentation=JSON.parse(fs.readFileSync(path.join(root,'工作台数据','推广演示.json'),'utf8')).enabled===true;}catch{}
    this.costs=new CostLedger(this.disk);
    this.feeds=new PublicFeeds({disk:this.disk,ledger:this.costs,secret:name=>this.app.secretStorage?.getSecret(name||''),request:requestUrl});
    this.samplingFiles = new SamplingFiles(root);
    this.video = new VideoFiles(root,path.join(this.pluginDir,'transcribe.py'));
    this.screenshotOCR = new ScreenshotOCR(path.join(this.pluginDir,'recognize-macos')); 
    this.feishu = new FeishuIntegration(this);
    this.covers=new CoverService(root,path.join(this.pluginDir,'cover-session'));
    this.codex = new CodexClient({cwd:path.join(this.pluginDir,'writing-session')});
    this.registerView(VIEW,leaf=>new WorkbenchView(leaf,this));
    this.addRibbonIcon('layout-dashboard','打开内容创作工作台',()=>this.open());
    this.addCommand({id:'open-workbench',name:'打开内容创作工作台',callback:()=>this.open()});
    this.addCommand({id:'workbench-help',name:'查看安装与使用说明',callback:()=>this.openGuide('HELP.md')});
    this.registerObsidianProtocolHandler('creator-workbench',()=>this.open());
    this.app.workspace.onLayoutReady(()=>this.open());
  }
  async openGuide(name) {
    if(!['HELP.md','FEISHU_SETUP.md'].includes(name))return;
    const modal=new Modal(this.app);modal.setTitle(name==='HELP.md'?'内容创作工作台 · 上手说明':'飞书接入指南');
    try {const raw=fs.readFileSync(path.join(this.pluginDir,name),'utf8');await MarkdownRenderer.render(this.app,raw,modal.contentEl,'',this);} catch {modal.contentEl.createEl('p',{text:'说明文件暂不可用，请查看项目仓库 README。'});}
    modal.open();
  }
  async open() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf('tab'); await leaf.setViewState({type:VIEW,active:true}); }
    await this.app.workspace.revealLeaf(leaf);
  }
  scheduleExport() { clearTimeout(this.exportTimer); this.exportTimer = setTimeout(()=>this.flushExport(),600); }
  flushExport() {
    clearTimeout(this.exportTimer);
    try {
      const conflicts = this.disk.exportNotes();
      if (conflicts.length && !this.warnedConflict) { this.warnedConflict = true; new Notice('已保留你手动修改的笔记，新查阅副本位于「07-更新待合并」',7000); }
    } catch { new Notice('笔记导出未完成；请保留原存档并检查知识库目录是否可写',8000); }
  }
  async saveDownload(blob,name) {
    if (blob.size > 32*1024*1024) throw Error('导出文件超过 32 MB');
    const safe = String(name).replace(/[\\/\x00-\x1f:*?"<>|]/g,'-').slice(0,150) || '导出文件';
    const dir = path.join(this.disk.root,'06-附件','导出');
    let target = path.join(dir,safe);
    if (fs.existsSync(target)) target = path.join(dir,`${Date.now()}-${safe}`);
    this.disk.atomic(target,Buffer.from(await blob.arrayBuffer()));
    new Notice('已保存到知识库：06-附件/导出',5000);
  }
  onunload() { this.covers?.close(); this.video?.close(); this.screenshotOCR?.close(); this.codex?.close(); this.flushExport(); this.app.workspace.detachLeavesOfType(VIEW); }
};
