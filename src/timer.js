export const DURATION=25*60*1000;
export function freshTimer(){return {status:'idle',duration:DURATION,remainingMs:DURATION,endAt:null};}
export function remaining(timer,now=Date.now()){return Math.max(0,timer.status==='running'?timer.endAt-now:timer.remainingMs);}
export function changeTimer(timer,action,now=Date.now()){
 const t={...timer};const ms=remaining(t,now);
 if(action==='reset')return freshTimer();
 if(action==='start'){const left=ms>0?ms:t.duration;t.status='running';t.endAt=now+left;t.remainingMs=left;}
 if(action==='pause'){t.status=ms>0?'paused':'completed';t.remainingMs=ms;t.endAt=null;}
 if(action==='end'){t.status='ended';t.remainingMs=0;t.endAt=null;}
 if(action==='tick'&&t.status==='running'&&ms===0){t.status='completed';t.remainingMs=0;t.endAt=null;}
 return t;
}
export function formatTimer(ms){const n=Math.ceil(Math.max(0,ms)/1000);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}

