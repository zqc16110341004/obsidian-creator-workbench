const {FeishuWrites}=require('./feishu-writes.cjs');
const {Modal,Setting,SecretComponent,requestUrl} = require('obsidian');
const fs = require('node:fs');
const path = require('node:path');
const {FeishuClient,DEFAULT_SOURCE,parseSource,sourceKey} = require('./feishu-client.cjs');

class FeishuIntegration {
  constructor(plugin) {
    this.plugin=plugin; this.file=path.join(plugin.pluginDir,'feishu.json'); this.config={sourceUrl:DEFAULT_SOURCE,fields:{}};
    try { const c=JSON.parse(fs.readFileSync(this.file,'utf8')); if(c && typeof c==='object') this.config=c; } catch { /* No secret values are stored here. */ }
    this.resetClient(); this.writes=new FeishuWrites(this);
  }
  credentials(config=this.config) {
    const appSecret=this.plugin.app.secretStorage?.getSecret(config.secretName || '');
    if (!appSecret) throw Error('未找到所选 App Secret，请打开连接设置，在 Obsidian 密钥库中重新选择');
    return {appId:config.appId,appSecret};
  }
  resetClient() { this.client=new FeishuClient({request:requestUrl,getCredentials:()=>this.credentials()}); }
  status() {
    const c=this.config;
    const configured=Boolean(c.appId && c.secretName && c.appToken && c.tableId && c.fields?.title);
    let secretReady=false; try { secretReady=Boolean(configured && this.credentials().appSecret); } catch { /* Public status contains no credentials. */ }
    return {configured,secretReady,sourceUrl:c.sourceUrl || DEFAULT_SOURCE,sourceKey:configured?sourceKey(c):'',tableName:c.tableName || '',fields:c.fields || {}};
  }
  async readTopics() {
    if (!this.status().configured) throw Error('请先配置飞书连接，并确认数据表与字段');
    if (this.pending) return this.pending;
    const config=structuredClone(this.config),client=this.client;
    this.pending=client.topics(config);
    try { return await this.pending; } finally { this.pending=null; }
  }
  configure() { return new Promise(resolve=>new FeishuConnectionModal(this,resolve).open()); }
  save(config) {
    // An allowlist prevents accidental persistence of secret values or API responses.
    const clean={appId:config.appId,secretName:config.secretName,sourceUrl:parseSource(config.sourceUrl).url,appToken:config.appToken,tableId:config.tableId,tableName:config.tableName,fields:{title:config.fields.title,reference:config.fields.reference || '',links:config.fields.links || ''}};
    this.plugin.disk.atomic(this.file,JSON.stringify(clean,null,2)); this.config=clean; this.resetClient();
  }
}

class FeishuConnectionModal extends Modal {
  constructor(integration,done) {
    super(integration.plugin.app); this.integration=integration; this.done=done;
    this.draft=structuredClone(integration.config); this.draft.fields ??={}; this.tables=[]; this.fields=[];
  }
  onOpen() { this.modalEl.addClass('creator-feishu-modal'); this.render(); }
  onClose() { this.contentEl.empty(); this.done(this.integration.status()); }
  signature() { return JSON.stringify([this.draft.appId,this.draft.secretName,this.draft.sourceUrl,this.draft.tableId]); }
  setBusy(value) { this.busy=value; this.contentEl.querySelectorAll('input,select,button').forEach(el=>el.disabled=value); }
  async run(action) {
    if(this.busy)return; this.setBusy(true); this.message.setText('正在连接飞书…');
    try { await action(); } catch(err) { this.message.setText(err.message || '连接未完成，请核对设置后重试'); this.message.addClass('creator-feishu-error'); }
    finally { this.setBusy(false); }
  }
  render() {
    const root=this.contentEl; root.empty(); root.createEl('h2',{text:'连接飞书选题库'});
    root.createEl('p',{text:'用飞书自建应用读取原表。选题、参考文案和链接会保存在当前知识库，后续创作进度在本地维护。'});
    const help=root.createEl('p');
    help.createEl('a',{text:'查看配置指引',href:'#'}).addEventListener('click',e=>{e.preventDefault();this.integration.plugin.openGuide('FEISHU_SETUP.md');});
    if (!this.app.secretStorage || !SecretComponent) { root.createEl('p',{text:'当前 Obsidian 不支持原生密钥选择器，请升级到 1.14.4 或更新版本后配置。'}); return; }
    new Setting(root).setName('App ID').setDesc('飞书开放平台 → 应用 → 凭证与基础信息').addText(t=>t.setPlaceholder('cli_…').setValue(this.draft.appId || '').onChange(v=>this.draft.appId=v.trim()));
    new Setting(root).setName('App Secret').setDesc('选择或新建一个 Obsidian 密钥，只把密钥名称保存到连接配置。不要把密钥写进笔记或聊天。').addComponent(el=>new SecretComponent(this.app,el).setValue(this.draft.secretName || '').onChange(v=>this.draft.secretName=v));
    new Setting(root).setName('原表链接').setDesc('支持 /wiki/ 与 /base/ 链接').addText(t=>t.setValue(this.draft.sourceUrl || DEFAULT_SOURCE).onChange(v=>this.draft.sourceUrl=v.trim()));
    new Setting(root).setName('读取数据表').setDesc('只读取这个链接中的表格信息，不修改飞书内容。').addButton(b=>b.setButtonText('读取数据表').onClick(()=>this.run(async()=>{
      const draft=structuredClone(this.draft);
      const client=new FeishuClient({request:requestUrl,getCredentials:()=>this.integration.credentials(draft)});
      const source=await client.resolve(draft.sourceUrl), tables=await client.tables(source.appToken);
      if(!tables.length)throw Error('这个多维表格没有可访问的数据表，请检查协作者权限');
      this.draft.appToken=source.appToken; this.draft.sourceUrl=source.url; this.tables=tables;
      this.draft.tableId=tables.some(t=>t.table_id===(source.tableId || draft.tableId))?(source.tableId || draft.tableId):tables[0].table_id;
      this.fields=[]; this.readySignature=''; this.render(); this.message.setText('已读取数据表，请选择目标表并读取字段。');
    })));
    if(this.tables.length) {
      new Setting(root).setName('选题数据表').addDropdown(d=>{
        for(const t of this.tables)d.addOption(t.table_id,t.name || t.table_id);
        d.setValue(this.draft.tableId).onChange(v=>{this.draft.tableId=v;this.fields=[];this.readySignature='';this.render();});
      });
      new Setting(root).setName('读取字段').setDesc('读取表头后，确认哪些列用作标题、参考文案和资料链接。').addButton(b=>b.setButtonText('读取字段').onClick(()=>this.run(async()=>{
        const draft=structuredClone(this.draft),client=new FeishuClient({request:requestUrl,getCredentials:()=>this.integration.credentials(draft)});
        const source=await client.resolve(draft.sourceUrl);
        if(source.appToken!==draft.appToken)throw Error('表格链接已经变化，请重新读取数据表');
        this.fields=await client.fields(draft.appToken,draft.tableId);
        if(!this.fields.length)throw Error('未读取到字段，请检查原表权限');
        const names=this.fields.map(f=>f.field_name);
        const choose=(current,hints)=>names.includes(current)?current:hints.find(n=>names.includes(n)) || '';
        this.draft.fields={title:choose(this.draft.fields.title,['选题标题','视频标题','标题','选题']),reference:choose(this.draft.fields.reference,['参考文案','视频文案','文案','原文文案','内容']),links:choose(this.draft.fields.links,['资料链接','视频链接','原文链接','链接'])};
        this.readySignature=this.signature(); this.render(); this.message.setText('字段已读到，请核对下面的对应关系后保存。');
      })));
    }
    if(this.fields.length) {
      for(const [key,label,desc] of [['title','选题标题','必填，开始创作时成为任务标题'],['reference','参考文案','可选，保存到本地任务的参考资料'],['links','资料链接','可选，保留 HTTP / HTTPS 链接']])new Setting(root).setName(label).setDesc(desc).addDropdown(d=>{
        d.addOption('',key==='title'?'请选择标题字段':'不读取');for(const f of this.fields)d.addOption(f.field_name,f.field_name);
        d.setValue(this.draft.fields[key] || '').onChange(v=>this.draft.fields[key]=v);
      });
      new Setting(root).addButton(b=>b.setButtonText('保存并读取选题').setCta().onClick(()=>this.run(async()=>{
        if(this.readySignature!==this.signature())throw Error('应用、链接或数据表已变化，请重新读取字段后保存');
        if(!this.fields.some(f=>f.field_name===this.draft.fields.title))throw Error('请选择选题标题字段');
        const table=this.tables.find(t=>t.table_id===this.draft.tableId);
        this.integration.save({...this.draft,tableName:table?.name || this.draft.tableId}); this.close();
      })));
    }
    this.message=root.createEl('p',{cls:'creator-feishu-status',attr:{role:'status','aria-live':'polite'}});
    root.createEl('p',{cls:'creator-feishu-footnote',text:'读取与创作仍在本地。仅在你预览确认新增选题时写入飞书，不同步稿件和进度。'});
  }
}
module.exports={FeishuIntegration};
