// A real-time wire sculpture. No video or baked screenshot is used.
const TAU=Math.PI*2;
export class Scene{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.mode='home';this.reduced=false;this.inView=true;this.t=0;this.last=0;this.raf=0;this.resize=()=>this.measure();this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas);this.visibility=()=>{if(document.hidden||!this.inView){cancelAnimationFrame(this.raf);this.raf=0;}else this.run();};document.addEventListener('visibilitychange',this.visibility);this.intersection=new IntersectionObserver(([entry])=>{this.inView=entry.isIntersecting;this.visibility();});this.intersection.observe(canvas);this.measure();this.run();}
 measure(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;const dpr=Math.min(devicePixelRatio||1,1.7);this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);this.draw();}
 setMode(mode){this.mode=mode;this.draw();}
 setReduced(value){this.reduced=value;if(value){cancelAnimationFrame(this.raf);this.raf=0;this.draw();}else this.run();}
 run(){if(this.raf||this.reduced||document.hidden||!this.inView)return;this.last=performance.now();const loop=now=>{this.t+=Math.min(now-this.last,50)/1000;this.last=now;this.draw();this.raf=requestAnimationFrame(loop);};this.raf=requestAnimationFrame(loop);}
 project(x,y,z,scale=1){const a=.3+Math.sin(this.t*.12)*.8;const c=Math.cos(a),s=Math.sin(a);let X=x*c+z*s,Z=-x*s+z*c;const b=-.28;const Y=y*Math.cos(b)-Z*Math.sin(b);Z=y*Math.sin(b)+Z*Math.cos(b);const p=720/(720+Z*this.size);return [this.cx+X*this.size*p*scale,this.cy+Y*this.size*p*scale,Z];}
 draw(){
 const c=this.ctx,w=this.w,h=this.h;if(!w||!h)return;
 c.clearRect(0,0,w,h);
 const base=c.createLinearGradient(0,0,w,h);base.addColorStop(0,'#f3f1eb');base.addColorStop(.55,'#e2dfd4');base.addColorStop(1,'#f2eee5');c.fillStyle=base;c.fillRect(0,0,w,h);
 // Soft moving light makes the backdrop-filter visibly live.
 for(let i=0;i<14;i++){const x=w*(.3+(Math.sin(i*18.3+this.t*.06)+1)*.35),y=h*(.1+(Math.cos(i*7.7+this.t*.09)+1)*.38),r=20+(i%5)*16;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%3===0?'rgba(255,238,201,.8)':'rgba(113,125,91,.12)');g.addColorStop(1,'rgba(243,241,235,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
 this.cx=w*(this.mode==='home'?.68:.78);this.cy=h*(this.mode==='home'?.57:.53);this.size=Math.min(w*(this.mode==='home'?.17:.12),this.mode==='home'?190:132);
 if(['home','trends'].includes(this.mode))this.mesh();else if(this.mode==='analysis')this.layers();else if(this.mode==='review')this.lens();else this.paper();
 const fade=c.createLinearGradient(0,h*.78,0,h);fade.addColorStop(0,'rgba(243,241,235,0)');fade.addColorStop(1,'rgba(243,241,235,1)');c.fillStyle=fade;c.fillRect(0,h*.78,w,h*.22);
 }
 line(a,b,color,width=1){const c=this.ctx;c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
 glow(x,y,r,alpha=1){const c=this.ctx,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,252,227,'+alpha+')');g.addColorStop(.12,'rgba(255,224,145,'+alpha*.8+')');g.addColorStop(.45,'rgba(230,162,59,'+alpha*.25+')');g.addColorStop(1,'rgba(200,150,50,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
 mesh(){
 const c=this.ctx,cols=27,rows=12,points=[];
 for(let i=0;i<cols;i++){points[i]=[];for(let j=0;j<rows;j++){const u=i/cols*TAU,v=j/rows*TAU;const ripple=.08*Math.sin(3*u+2*v+this.t*.35);const radius=.78+(.36+ripple)*Math.cos(v);const x=radius*Math.cos(u),y=radius*Math.sin(u),z=(.36+ripple)*Math.sin(v);points[i][j]=this.project(x,y,z*1.3);}}
 for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){const a=points[i][j],b=points[(i+1)%cols][j],d=points[i][(j+1)%rows];const depth=(a[2]+1.5)/3;this.line(a,b,'rgba(39,36,30,'+(depth*.35+.18)+')',.7);this.line(a,d,'rgba(39,36,30,.28)',.65);this.line(a,points[(i+1)%cols][(j+1)%rows],'rgba(39,36,30,.15)',.55);c.fillStyle='rgba(35,33,25,.65)';c.beginPath();c.arc(a[0],a[1],1.45,0,TAU);c.fill();if((i*rows+j)%29===0)this.glow(a[0],a[1],9,.7);}
 this.glow(this.cx,this.cy,118,.9);
 const core=[];for(let i=0;i<18;i++){const a=i*2.399+this.t*.35,r=.12+(i%4)*.045;core.push(this.project(Math.cos(a)*r,Math.sin(a)*r,Math.sin(a*2)*.3));}
 for(let i=0;i<core.length;i++){this.line(core[i],core[(i+7)%core.length],'rgba(184,124,40,.85)',1.2);this.glow(core[i][0],core[i][1],14,.95);}
 for(let i=0;i<18;i++){const angle=i*2.399+this.t*.16,radius=(.3+(i%6)*.12)*this.size;const x=this.cx+Math.cos(angle)*radius,y=this.cy+Math.sin(angle)*radius*.8;const pulse=.35+.55*(.5+.5*Math.sin(this.t*1.2+i));this.glow(x,y,7,pulse);if(i%3===0){this.line([x-3,y],[x+3,y],'rgba(255,246,211,'+pulse+')',.8);this.line([x,y-3],[x,y+3],'rgba(255,246,211,'+pulse+')',.8);}}
 if(this.mode==='trends')this.orbit(this.cx,this.cy,this.size*1.4,this.size*.44,-.24);
 }
 orbit(x,y,rx,ry,tilt){const c=this.ctx;c.save();c.translate(x,y);c.rotate(tilt);c.strokeStyle='rgba(146,117,70,.72)';c.lineWidth=1.5;c.beginPath();c.ellipse(0,0,rx,ry,0,0,TAU);c.stroke();const a=this.t*.35,bx=Math.cos(a)*rx,by=Math.sin(a)*ry;const g=c.createRadialGradient(bx-3,by-3,0,bx,by,9);g.addColorStop(0,'#fff8d9');g.addColorStop(.45,'#d1ae6a');g.addColorStop(1,'#7b653f');c.fillStyle=g;c.beginPath();c.arc(bx,by,9,0,TAU);c.fill();c.restore();}
 card(x,y,w,h,angle,glass=false){const c=this.ctx;c.save();c.translate(x,y);c.rotate(angle);c.shadowColor='rgba(81,67,42,.17)';c.shadowBlur=18;c.shadowOffsetY=10;const g=c.createLinearGradient(-w/2,-h/2,w/2,h/2);g.addColorStop(0,glass?'rgba(255,255,255,.63)':'#fcfaf3');g.addColorStop(1,glass?'rgba(199,180,142,.18)':'#ded7c6');c.fillStyle=g;c.strokeStyle='rgba(156,133,91,.6)';c.lineWidth=.8;c.beginPath();c.roundRect(-w/2,-h/2,w,h,glass?9:3);c.fill();c.shadowColor='transparent';c.stroke();if(!glass){c.strokeStyle='rgba(134,121,98,.27)';for(let i=0;i<4;i++)this.line([-w*.32,-h*.2+i*h*.15],[w*.28,-h*.2+i*h*.15],'rgba(134,121,98,.24)',.8);}c.restore();}
 paper(){const s=this.size,t=this.t;this.card(this.cx-s*.18,this.cy+8,s*1.22,s*.9,-.18+Math.sin(t*.2)*.02,true);this.card(this.cx+18,this.cy+Math.sin(t*.35)*5,s*1.12,s*.87,.1);this.card(this.cx+s*.28,this.cy+15,s*.8,s*.95,-.06);this.orbit(this.cx,this.cy+18,s*1.48,s*.25,-.16);if(this.mode==='studio'){const c=this.ctx;c.save();c.translate(this.cx+s*.65,this.cy+s*.3);c.rotate(-.45);c.fillStyle='#3e3a31';c.beginPath();c.roundRect(-65,-5,114,11,4);c.fill();c.fillStyle='#ba9d68';c.beginPath();c.moveTo(-65,-5);c.lineTo(-83,0);c.lineTo(-65,6);c.fill();c.restore();}}
 layers(){const s=this.size;for(let i=0;i<4;i++){this.card(this.cx+(i-1.5)*s*.45,this.cy+Math.sin(this.t*.3+i)*6,s*.72,s*1.08,-.03*(i-1),true);}this.glow(this.cx,this.cy,65,.7);this.orbit(this.cx,this.cy,s*1.5,s*.3,-.15);}
 lens(){const c=this.ctx,s=this.size;this.card(this.cx+s*.3,this.cy+12,s*1.3,s*.9,.08);c.save();c.translate(this.cx-s*.2,this.cy);c.rotate(.2);const g=c.createLinearGradient(-s/2,0,s/2,s/2);g.addColorStop(0,'rgba(255,255,255,.7)');g.addColorStop(1,'rgba(176,165,139,.2)');c.fillStyle=g;c.strokeStyle='#a38a5d';c.lineWidth=3;c.beginPath();c.arc(0,0,s*.52,0,TAU);c.fill();c.stroke();c.lineWidth=9;c.strokeStyle='#494338';c.beginPath();c.moveTo(-s*.4,s*.4);c.lineTo(-s*.85,s*.9);c.stroke();c.restore();this.orbit(this.cx,this.cy,s*1.45,s*.24,-.14);}
}

