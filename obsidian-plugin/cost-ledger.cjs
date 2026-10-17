const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const month=now=>{const d=new Date(now);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};
const money=n=>Number.isSafeInteger(n)&&n>=0&&n<=10000000;
class CostLedger{
 constructor(disk,now=Date.now){this.disk=disk;this.now=now;this.file=path.join(disk.dir,'cost-ledger.json');}
 load(){if(!fs.existsSync(this.file))return [];const rows=JSON.parse(fs.readFileSync(this.file,'utf8'));if(!Array.isArray(rows)||rows.some(x=>!money(x.reservedFen)||x.actualFen!==null&&!money(x.actualFen)))throw Error('费用记录无法核验，已暂停付费调用');return rows;}
 save(rows){this.disk.atomic(this.file,JSON.stringify(rows,null,2));}
 summary(){const rows=this.load(),m=month(this.now()),current=rows.filter(x=>x.month===m),used=current.reduce((n,x)=>n+(x.actualFen??x.reservedFen),0);return {month:m,limitFen:10000,usedFen:used,remainingFen:Math.max(0,10000-used),rows,estimatedFen:current.filter(x=>x.actualFen===null).reduce((n,x)=>n+x.reservedFen,0)};}
 reserve(service,task,capFen){if(!money(capFen)||capFen===0)throw Error('费用无法可靠估算，请先配置本次费用上限');const rows=this.load(),m=month(this.now()),used=rows.filter(x=>x.month===m).reduce((n,x)=>n+(x.actualFen??x.reservedFen),0);if(used+capFen>10000)throw Error('本月 100 元预算不足，已停止新增付费请求；原结果保留');const row={id:randomUUID(),service,task,month:m,at:this.now(),reservedFen:capFen,actualFen:null,status:'reserved',note:''};rows.push(row);this.save(rows);return row.id;}
 pending(id,note){const rows=this.load(),row=rows.find(x=>x.id===id);if(!row)throw Error('费用记录不存在');if(row.actualFen!==null)return;row.status='pending';row.note=String(note).slice(0,500);this.save(rows);}
 confirm(id,actualFen,note){if(!money(actualFen)||!String(note||'').trim())throw Error('请填写实际人民币费用与核对凭据说明');const rows=this.load(),row=rows.find(x=>x.id===id);if(!row)throw Error('费用记录不存在');row.history??=[];row.history.push({actualFen:row.actualFen,status:row.status,note:row.note,at:this.now()});row.actualFen=actualFen;row.status='confirmed';row.note=String(note).slice(0,1000);row.confirmedAt=this.now();this.save(rows);return this.summary();}
 fixed(service,fen){if(!money(fen))throw Error('套餐/预付费用无效');const rows=this.load(),m=month(this.now()),old=rows.find(x=>x.month===m&&x.service===service&&x.task==='fixed');if(old){if(old.actualFen!==fen)throw Error('本月固定支出已登记，请在费用记录中核对修改');return;}const used=rows.filter(x=>x.month===m).reduce((n,x)=>n+(x.actualFen??x.reservedFen),0);if(used+fen>10000)throw Error('套餐/预付费用超过本月剩余预算，不能启用服务');rows.push({id:randomUUID(),service,task:'fixed',month:m,at:this.now(),reservedFen:fen,actualFen:fen,status:'confirmed',note:'用户配置时确认的本月套餐/预付实际支出'});this.save(rows);}
}
module.exports={CostLedger,month,money};
