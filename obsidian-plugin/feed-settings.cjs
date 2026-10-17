const {Modal,Setting,SecretComponent}=require('obsidian');
class FeedSettings extends Modal{
 constructor(plugin,done){super(plugin.app);this.plugin=plugin;this.done=done;}
 onOpen(){const root=this.contentEl;root.createEl('h2',{text:'公开动态服务与预算'});root.createEl('p',{text:'仅使用独立数据接口密钥，不读取社交账号 Cookie 或登录态。上限为每月新增 100 元。首次配置后才会在当天首次打开工作台时请求更新。'});const config=this.plugin.feeds.config();for(const [platform,provider,link] of [['X','TwitterAPI.io','https://twitterapi.io/pricing'],['小红书','TikHub App V2','https://docs.tikhub.io/420136396e0']]){
 const draft={...(config[platform]||{}),ack:false};root.createEl('h3',{text:platform+' · '+provider});root.createEl('a',{text:'核对供应商服务与计费',href:link,attr:{target:'_blank',rel:'noopener noreferrer'}});
 new Setting(root).setName('启用该平台').addToggle(t=>t.setValue(Boolean(draft.enabled)).onChange(v=>draft.enabled=v));
 new Setting(root).setName('接口密钥').setDesc('只保存 Obsidian 密钥名称').addComponent(el=>new SecretComponent(this.app,el).setValue(draft.secretName||'').onChange(v=>draft.secretName=v));
 new Setting(root).setName('单页请求最高费用（人民币元）').setDesc('含本页最大返回量、汇率与手续费；未知上限请不要启用').addText(t=>t.setValue(draft.capFen?String(draft.capFen/100):'').onChange(v=>draft.capFen=Math.ceil(Number(v)*100)));
 new Setting(root).setName('本月套餐 / 预付实际支出（人民币元）').setDesc('没有请填 0。已发生的充值也计入本月预算，不会自动充值').addText(t=>t.setValue(draft.fixedFen===undefined?'':String(draft.fixedFen/100)).onChange(v=>draft.fixedFen=v.trim()?Math.ceil(Number(v)*100):NaN));
 new Setting(root).setName('计费依据').setDesc('填写核对日期、单价与汇率等。本月有效，下月需重新核对').addTextArea(t=>t.setValue(draft.priceNote||'').onChange(v=>draft.priceNote=v));
 new Setting(root).setName('我已核对费用，允许调用此数据服务').addToggle(t=>t.setValue(false).onChange(v=>draft.ack=v));
 const status=root.createEl('p',{attr:{role:'status'}});new Setting(root).addButton(b=>b.setButtonText('保存 '+platform+' 配置').onClick(()=>{try{this.plugin.feeds.save(platform,draft);status.setText('配置已保存；仅按本月已确认的费用上限调用。');}catch(err){status.setText(err.message);}}));
 }new Setting(root).addButton(b=>b.setButtonText('返回工作台').onClick(()=>this.close()));}
 onClose(){this.contentEl.empty();this.done(this.plugin.feeds.status());}
}
module.exports={FeedSettings};
