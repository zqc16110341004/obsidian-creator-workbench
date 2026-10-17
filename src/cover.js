export function paintCover(canvas,task){
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,dark=/深|黑|dark/i.test(task.coverSnapshot?.request??task.coverRequest??'');
 const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,dark?'#282e25':'#f5f0e3');g.addColorStop(1,dark?'#515941':'#dce0cd');c.fillStyle=g;c.fillRect(0,0,w,h);
 c.strokeStyle=dark?'#b3bb9545':'#7a89622e';c.lineWidth=1;for(let i=0;i<14;i++){c.beginPath();c.ellipse(w*.62,h*.67,80+i*19,35+i*8,-.4,0,Math.PI*2);c.stroke();}
 const glow=c.createRadialGradient(w*.72,h*.62,0,w*.72,h*.62,110);glow.addColorStop(0,'#fff1b899');glow.addColorStop(1,'#d3b65c00');c.fillStyle=glow;c.fillRect(0,0,w,h);
 c.fillStyle=dark?'#c1c8ad':'#7b8666';c.font='18px sans-serif';c.fillText('CREATOR’S NOTE',48,71);c.fillRect(48,94,54,2);
 c.fillStyle=dark?'#f5f1e4':'#35432b';c.font='600 48px sans-serif';const title=task.coverSnapshot?.title??(task.finalTitle||task.title);let line='',y=190;for(const ch of title){if(c.measureText(line+ch).width>w-96){c.fillText(line,48,y);line=ch;y+=72;}else line+=ch;}c.fillText(line,48,y);
 c.fillStyle=dark?'#b2bc9e':'#839270';c.font='22px sans-serif';c.fillText('从一个真实问题开始',48,650);c.font='16px sans-serif';c.fillText('本地演示样张 · 非 AI 生成',48,740);
}
