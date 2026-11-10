// Realistic-ish head + hair renderer (Canvas2D). Hair is built from locks (clumps of fine strands).
(function(){
const lerp=(a,b,k)=>a+(b-a)*k;
const mixc=(c1,c2,k)=>c1.map((v,i)=>Math.round(lerp(v,c2[i],k)));
const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;
function rng(seed){let s=seed%2147483647;if(s<=0)s+=2147483646;return()=>{s=s*16807%2147483647;return (s-1)/2147483646}}
function bez(p0,p1,p2,p3,u){const v=1-u;return[v*v*v*p0[0]+3*v*v*u*p1[0]+3*v*u*u*p2[0]+u*u*u*p3[0],v*v*v*p0[1]+3*v*v*u*p1[1]+3*v*u*u*p2[1]+u*u*u*p3[1]]}
// hair base colours (deep brunette with caramel)
const DARK=[58,34,20],MID=[126,80,46],LIGHT=[206,152,96],HI=[255,230,186];

// ---------- LOCK ----------
// lock: {p0,p1,p2,p3, w (root width), n strands, tone 0..1, depth 0 back..1 front, chop (end raggedness)}
function drawLock(ctx,L,t,light,grow){
  const r=rng(L.seed);const N=Math.round(L.n*1.6);const steps=22;
  const base=mixc(mixc(DARK,MID,L.tone),[18,10,6],(1-L.depth)*.45);
  // sample centre + normals
  const C=[],Nn=[];
  for(let i=0;i<=steps;i++){const u=i/steps*grow;C.push(bez(L.p0,L.p1,L.p2,L.p3,u))}
  for(let i=0;i<=steps;i++){const a=C[Math.max(0,i-1)],b=C[Math.min(steps,i+1)];const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1;Nn.push([-dy/d,dx/d])}
  // body (soft shadow mass)
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  ctx.lineCap='butt';ctx.strokeStyle=rgba(mixc(base,[10,5,3],.2),.88);
  for(let i=1;i<=Math.floor(steps*.82);i++){const s=i/steps;ctx.beginPath();ctx.moveTo(C[i-1][0],C[i-1][1]);ctx.lineTo(C[i][0],C[i][1]);ctx.lineWidth=L.w*.9*Math.max(.05,1-Math.pow(s/.82,1.6));ctx.stroke()}
  ctx.lineCap='round';
  // strands
  for(let k=0;k<N;k++){
    const off=(r()-.5);const lenF=1-L.chop*Math.pow(r(),1.6);const jit=r()*6.28;const thin=.5+r()*1.1;
    const col=mixc(base,LIGHT,Math.pow(r(),1.5)*(.25+.5*L.depth));
    ctx.beginPath();
    const last=Math.max(2,Math.floor(steps*lenF));
    for(let i=0;i<=last;i++){const s=i/steps;const taper=1-Math.pow(s,1.4)*.8;
      const spread=1+L.splay*Math.pow(s,2.5); // ends fan out
      const o=off*L.w*taper*spread+Math.sin(s*9+jit+t*1.2)*1.2;
      const x=C[i][0]+Nn[i][0]*o,y=C[i][1]+Nn[i][1]*o;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}
    ctx.strokeStyle=rgba(col,.85);ctx.lineWidth=thin*.85;ctx.stroke();
  }
  // specular: highlight band along lock where it faces light (upper part of the curve)
  ctx.globalCompositeOperation='lighter';
  const hiA=.22+.28*L.depth;
  for(let k=0;k<Math.ceil(N*.35);k++){const off=(r()-.5)*.7;const a0=.12+r()*.18+light*.1,a1=a0+.18+r()*.12;
    ctx.beginPath();for(let i=Math.floor(a0*steps);i<=Math.min(steps,Math.floor(a1*steps));i++){const s=i/steps;const o=off*L.w*(1-s*.7);const x=C[i][0]+Nn[i][0]*o,y=C[i][1]+Nn[i][1]*o;i===Math.floor(a0*steps)?ctx.moveTo(x,y):ctx.lineTo(x,y)}
    ctx.strokeStyle=rgba(HI,hiA*(.5+r()*.5));ctx.lineWidth=.8+r();ctx.stroke()}
  ctx.globalCompositeOperation='source-over';ctx.restore();
}

// ---------- HAIRSTYLES ----------
// geometry relative to face: face centre (cx,cy), half width w, half height h
function scalp(cx,cy,w,h,th,k=1.06){return[cx+w*k*Math.cos(th),cy-h*.08+h*1.02*k*Math.sin(th)]}
function buildStyle(style,cx,cy,w,h,t,seed){
  const r=rng(seed);const locks=[];const sw=(a)=>Math.sin(t*1.1+a)*6; // sway
  const push=(o)=>{o.seed=Math.floor(r()*1e9)+1;locks.push(o)};
  if(style==='wolf'){
    // 1) back shag: long, choppy, mullet-like length at the back reaching collarbone
    for(let i=0;i<44;i++){const sd=i%2?1:-1;const k=r();const th=Math.PI*(1.05+ (sd<0? k*.42 : .53+k*.42));
      const p0=scalp(cx,cy,w,h,th,1.0);const out=sd*(w*.55+r()*w*.35);
      const len=h*(1.45+r()*.3);
      push({p0,p1:[p0[0]+sd*w*.35,p0[1]+h*.25],p2:[p0[0]+out*.85,p0[1]+len*.55],p3:[p0[0]+out*.55+sd*r()*25+sw(i),p0[1]+len],w:46+r()*20,n:16,tone:r(),depth:.05+r()*.2,chop:.45,splay:.6})}
    // 2) mid layers: end at jaw/chin, flick outward (triangular silhouette)
    for(let i=0;i<40;i++){const sd=i%2?1:-1;const k=r();const th=Math.PI*(1.12+(sd<0?k*.36:.52+k*.36));
      const p0=scalp(cx,cy,w,h,th,1.02);const len=h*(.75+r()*.3);const out=sd*(w*.62+r()*w*.3);
      push({p0,p1:[p0[0]+sd*w*.45,p0[1]-h*.05],p2:[p0[0]+out,p0[1]+len*.55],p3:[p0[0]+out*.85+sd*(20+r()*30)+sw(i+3),p0[1]+len*(.9+r()*.1)-r()*20],w:40+r()*16,n:14,tone:r(),depth:.35+r()*.25,chop:.55,splay:.9})}
    // 3) crown: short choppy pieces with lift (volume on top)
    for(let i=0;i<34;i++){const k=r();const th=Math.PI*(1.22+k*.56);const sd=Math.cos(th)>0?1:-1;
      const p0=scalp(cx,cy,w,h,th,.92);const lift=h*(.3+r()*.15);const len=h*(.55+r()*.25);
      push({p0,p1:[p0[0]+Math.cos(th)*w*.15,p0[1]-lift],p2:[p0[0]+sd*w*(.35+r()*.2),p0[1]-lift*.6],p3:[p0[0]+sd*w*(.55+r()*.3)+sw(i+7),p0[1]+len*.55],w:34+r()*14,n:12,tone:.4+r()*.6,depth:.6+r()*.25,chop:.6,splay:.9})}
    // 4) curtain bangs: middle part, sweep to cheekbones, flick out
    for(let i=0;i<14;i++){const sd=i%2?1:-1;const k=r();const p0=[cx+sd*(4+k*w*.18),cy-h*1.0];
      const end=[cx+sd*w*(.95+r()*.15),cy+h*(.05+r()*.18)];
      push({p0,p1:[p0[0]+sd*w*.15,p0[1]+h*.25],p2:[cx+sd*w*.55,cy-h*.45],p3:[end[0]+sd*25+sw(i+11),end[1]],w:28+r()*10,n:12,tone:.5+r()*.5,depth:.85+r()*.15,chop:.45,splay:.7,front:1})}
  }else{ // butterfly
    // 1) long base: below the shoulders, smooth flowing, ends curled under
    for(let i=0;i<44;i++){const sd=i%2?1:-1;const k=r();const th=Math.PI*(1.05+(sd<0?k*.42:.53+k*.42));
      const p0=scalp(cx,cy,w,h,th,1.0);const len=h*(2.9+r()*.35);const out=sd*(w*.5+r()*w*.3);
      push({p0,p1:[p0[0]+sd*w*.45,p0[1]+h*.2],p2:[p0[0]+out*1.1,p0[1]+len*.55],p3:[p0[0]+out*.75+sw(i),p0[1]+len],w:50+r()*20,n:16,tone:r(),depth:.05+r()*.2,chop:.12,splay:.25})}
    // 2) "wings": long disconnected face-framing layers from part to chin, curving AWAY from face (feathered)
    for(let i=0;i<34;i++){const sd=i%2?1:-1;const k=r();const p0=[cx+sd*(6+k*w*.35),cy-h*1.0];
      const yEnd=cy+h*(.7+r()*.45);
      push({p0,p1:[cx+sd*w*.75,cy-h*.95],p2:[cx+sd*w*1.0,cy+h*.15],p3:[cx+sd*w*(1.4+r()*.2)+sw(i+5),yEnd-h*.1],w:44+r()*14,n:15,tone:.35+r()*.6,depth:.55+r()*.3,chop:.15,splay:.5})}
    // 3) crown: blow-out volume, smooth
    for(let i=0;i<20;i++){const k=r();const th=Math.PI*(1.2+k*.6);const sd=Math.cos(th)>0?1:-1;const p0=scalp(cx,cy,w,h,th,.9);
      push({p0,p1:[p0[0],p0[1]-h*.18],p2:[p0[0]+sd*w*.45,p0[1]-h*.1],p3:[p0[0]+sd*w*(.6+r()*.15),p0[1]+h*.45],w:40+r()*14,n:13,tone:.5+r()*.5,depth:.65+r()*.2,chop:.1,splay:.3})}
    // 4) long curtain bangs to cheekbone, sweeping out
    for(let i=0;i<12;i++){const sd=i%2?1:-1;const p0=[cx+sd*(4+r()*w*.12),cy-h*1.0];
      push({p0,p1:[p0[0]+sd*w*.1,cy-h*.6],p2:[cx+sd*w*.62,cy-h*.15],p3:[cx+sd*w*(1.02+r()*.12)+sw(i+9),cy+h*(.25+r()*.15)],w:28+r()*8,n:12,tone:.6+r()*.4,depth:.9+r()*.1,chop:.15,splay:.5,front:1})}
  }
  return locks;
}
// morph between two lock sets (same count per group assumed by building both and pairing by index)
function morph(A,B,m){const n=Math.max(A.length,B.length),out=[];for(let i=0;i<n;i++){const a=A[i%A.length],b=B[i%B.length];
  const lp=(p,q)=>[lerp(p[0],q[0],m),lerp(p[1],q[1],m)];
  out.push({p0:lp(a.p0,b.p0),p1:lp(a.p1,b.p1),p2:lp(a.p2,b.p2),p3:lp(a.p3,b.p3),w:lerp(a.w,b.w,m),n:a.n,tone:lerp(a.tone,b.tone,m),depth:lerp(a.depth,b.depth,m),chop:lerp(a.chop,b.chop,m),splay:lerp(a.splay,b.splay,m),seed:a.seed,front:m<.5?a.front:b.front})}return out}

// ---------- FACE ----------
function facePath(ctx,cx,cy,sh){ctx.beginPath();for(let i=0;i<=96;i++){const th=i/96*6.2832;const c=Math.cos(th),s=Math.sin(th);
  let x=sh.w*Math.sign(c)*Math.pow(Math.abs(c),2/sh.n),y=sh.h*Math.sign(s)*Math.pow(Math.abs(s),2/sh.n);
  if(y>0){x*=1-sh.tp*Math.pow(y/sh.h,1.6);} // jaw taper
  if(y<0)x*=1+.04*(-y/sh.h);
  i?ctx.lineTo(cx+x,cy+y):ctx.moveTo(cx+x,cy+y)}ctx.closePath()}
function blob(ctx,x,y,rx,ry,c0,c1,rot=0){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(1,ry/rx);const g=ctx.createRadialGradient(0,0,0,0,0,rx);g.addColorStop(0,c0);g.addColorStop(1,c1);ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,rx,0,6.2832);ctx.fill();ctx.restore()}
const SKIN={hi:[248,222,202],mid:[228,184,154],lo:[178,124,96],shadow:[120,74,52]};
function drawBody(ctx,cx,cy,sh){
  // shoulders + neck with soft lighting
  const g=ctx.createRadialGradient(cx-sh.w*.6,cy+sh.h*1.8,20,cx,cy+sh.h*2.2,sh.w*3.2);g.addColorStop(0,rgba(SKIN.mid,1));g.addColorStop(1,rgba(SKIN.lo,1));
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(cx-sh.w*.42,cy+sh.h*.7);ctx.bezierCurveTo(cx-sh.w*.45,cy+sh.h*1.35,cx-sh.w*.9,cy+sh.h*1.5,cx-sh.w*2.6,cy+sh.h*1.85);
  ctx.lineTo(cx-sh.w*2.8,cy+sh.h*7);ctx.lineTo(cx+sh.w*2.8,cy+sh.h*7);ctx.lineTo(cx+sh.w*2.6,cy+sh.h*1.85);ctx.bezierCurveTo(cx+sh.w*.9,cy+sh.h*1.5,cx+sh.w*.45,cy+sh.h*1.35,cx+sh.w*.42,cy+sh.h*.7);ctx.closePath();ctx.fill();
  // neck shading + collarbones
  blob(ctx,cx,cy+sh.h*.95,sh.w*.7,sh.h*.35,rgba(SKIN.shadow,.55),rgba(SKIN.shadow,0));
  for(const sd of[-1,1]){blob(ctx,cx+sd*sh.w*.75,cy+sh.h*1.62,sh.w*.6,sh.h*.05,rgba(SKIN.shadow,.28),rgba(SKIN.shadow,0),sd*.18);blob(ctx,cx+sd*sh.w*.8,cy+sh.h*1.55,sh.w*.55,sh.h*.035,rgba(SKIN.hi,.35),rgba(SKIN.hi,0),sd*.18)}
  blob(ctx,cx,cy+sh.h*1.62,sh.w*.12,sh.h*.06,rgba(SKIN.shadow,.35),rgba(SKIN.shadow,0));
  // top: simple satin camisole straps
  for(const sd of[-1,1]){ctx.strokeStyle='rgba(240,226,210,.85)';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(cx+sd*sh.w*1.25,cy+sh.h*1.66);ctx.lineTo(cx+sd*sh.w*1.0,cy+sh.h*7);ctx.stroke()}
}
function drawFace(ctx,cx,cy,sh,t){
  // base with shadow
  ctx.save();ctx.shadowColor='rgba(40,16,8,.5)';ctx.shadowBlur=60;ctx.shadowOffsetY=25;
  const g=ctx.createRadialGradient(cx-sh.w*.3,cy-sh.h*.25,10,cx+sh.w*.1,cy+sh.h*.1,sh.h*1.2);g.addColorStop(0,rgba(SKIN.hi,1));g.addColorStop(.55,rgba(SKIN.mid,1));g.addColorStop(1,rgba(SKIN.lo,1));
  ctx.fillStyle=g;facePath(ctx,cx,cy,sh);ctx.fill();ctx.restore();
  ctx.save();facePath(ctx,cx,cy,sh);ctx.clip();
  const W=sh.w,H=sh.h;
  // side shading (right side darker), cheekbone highlight, temple shadow
  blob(ctx,cx+W*.95,cy+H*.05,W*.55,H*.9,rgba(SKIN.shadow,.38),rgba(SKIN.shadow,0));
  blob(ctx,cx-W*.95,cy+H*.05,W*.4,H*.9,rgba(SKIN.shadow,.18),rgba(SKIN.shadow,0));
  for(const sd of[-1,1]){blob(ctx,cx+sd*W*.5,cy+H*.08,W*.28,H*.1,rgba(SKIN.hi,.55),rgba(SKIN.hi,0),sd*-.3); // cheekbone hi
    blob(ctx,cx+sd*W*.58,cy+H*.3,W*.28,H*.16,'rgba(226,128,118,.30)','rgba(226,128,118,0)');} // blush
  blob(ctx,cx,cy-H*.62,W*.55,H*.22,rgba(SKIN.hi,.45),rgba(SKIN.hi,0)); // forehead hi
  // eyes (open, almond), positioned at ~mid height
  const ey=cy-H*.1,ex=W*.38,er=W*.2;
  for(const sd of[-1,1]){const x=cx+sd*ex;
    blob(ctx,x,ey-H*.02,er*1.35,H*.12,rgba(SKIN.shadow,.35),rgba(SKIN.shadow,0)); // socket
    // eye white (almond)
    ctx.save();ctx.beginPath();ctx.moveTo(x-er,ey);ctx.quadraticCurveTo(x,ey-er*.62,x+er,ey);ctx.quadraticCurveTo(x,ey+er*.5,x-er,ey);ctx.closePath();
    const wg=ctx.createLinearGradient(0,ey-er*.5,0,ey+er*.4);wg.addColorStop(0,'#D9C9C0');wg.addColorStop(1,'#F4ECE6');ctx.fillStyle=wg;ctx.fill();ctx.clip();
    // iris + pupil + catchlight
    const ix=x+sd*-2+Math.sin(t*.5)*1.5;const ig=ctx.createRadialGradient(ix,ey,1,ix,ey,er*.42);ig.addColorStop(0,'#2A160C');ig.addColorStop(.35,'#5B3418');ig.addColorStop(.85,'#7A4A22');ig.addColorStop(1,'#2A160C');
    ctx.fillStyle=ig;ctx.beginPath();ctx.arc(ix,ey,er*.42,0,6.2832);ctx.fill();ctx.fillStyle='#0E0704';ctx.beginPath();ctx.arc(ix,ey,er*.17,0,6.2832);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.9)';ctx.beginPath();ctx.arc(ix-er*.14,ey-er*.14,er*.07,0,6.2832);ctx.fill();
    blob(ctx,x,ey-er*.38,er*1.2,er*.3,'rgba(60,30,20,.45)','rgba(60,30,20,0)'); // lid shadow
    ctx.restore();
    // upper lash line (soft, thick, tapered) + lashes
    ctx.strokeStyle='rgba(28,14,8,.92)';ctx.lineCap='round';ctx.lineWidth=4.5;ctx.beginPath();ctx.moveTo(x-er*1.02,ey+1);ctx.quadraticCurveTo(x,ey-er*.66,x+er*1.08,ey-er*.08);ctx.stroke();
    ctx.lineWidth=1.1;ctx.strokeStyle='rgba(28,14,8,.55)';for(let k=0;k<6;k++){const u=k/8;const px=lerp(x-er*.8,x+er*1.0,u),py=ey-er*.55*Math.sin(Math.PI*(.1+.8*u))+2;ctx.beginPath();ctx.moveTo(px,py);ctx.quadraticCurveTo(px+sd*0+(u-.3)*8,py-er*.22,px+(u-.2)*12,py-er*.3);ctx.stroke()}
    // crease + brow (soft, hairy)
    blob(ctx,x,ey-er*.85,er*1.1,er*.12,'rgba(120,70,48,.35)','rgba(120,70,48,0)');
    {const by0=ey-H*.2;ctx.save();ctx.beginPath();ctx.moveTo(x-sd*er*1.05,by0+5);ctx.quadraticCurveTo(x+sd*er*.1,by0-H*.075,x+sd*er*1.2,by0-H*.01);ctx.quadraticCurveTo(x+sd*er*.1,by0-H*.035,x-sd*er*1.05,by0+5);ctx.fillStyle='rgba(70,42,26,.7)';ctx.filter='blur(1.2px)';ctx.fill();ctx.filter='none';ctx.restore()}
    ctx.save();const by=ey-H*.2;for(let k=0;k<26;k++){const u=k/25;const bx=lerp(x-sd*er*1.05,x+sd*er*1.15,u);const byy=by-Math.sin(Math.PI*Math.min(1,u*1.2))*H*.045;
      ctx.strokeStyle=`rgba(${48+k},${28+k*.5},${18},.75)`;ctx.lineWidth=2.2-u*.8;ctx.beginPath();ctx.moveTo(bx,byy+4);ctx.lineTo(bx+sd*7,byy-3);ctx.stroke()}ctx.restore();
  }
  // nose: bridge highlight, side shadow, tip, nostrils
  blob(ctx,cx-W*.04,cy+H*.05,W*.06,H*.22,rgba(SKIN.hi,.55),rgba(SKIN.hi,0));
  blob(ctx,cx+W*.1,cy+H*.08,W*.08,H*.22,rgba(SKIN.shadow,.3),rgba(SKIN.shadow,0));
  blob(ctx,cx,cy+H*.3,W*.16,H*.07,rgba(SKIN.mid,.0),rgba(SKIN.mid,0));
  blob(ctx,cx+W*.02,cy+H*.33,W*.16,H*.05,rgba(SKIN.shadow,.35),rgba(SKIN.shadow,0));
  for(const sd of[-1,1])blob(ctx,cx+sd*W*.08,cy+H*.33,W*.04,H*.018,'rgba(70,32,22,.75)','rgba(70,32,22,0)');
  blob(ctx,cx-W*.02,cy+H*.27,W*.06,H*.035,rgba(SKIN.hi,.7),rgba(SKIN.hi,0));
  // lips: cupid's bow upper + fuller lower
  const ly=cy+H*.53,lw=W*.36;
  ctx.beginPath();ctx.moveTo(cx-lw,ly);ctx.bezierCurveTo(cx-lw*.5,ly-H*.07,cx-lw*.15,ly-H*.07,cx,ly-H*.035);ctx.bezierCurveTo(cx+lw*.15,ly-H*.07,cx+lw*.5,ly-H*.07,cx+lw,ly);ctx.bezierCurveTo(cx+lw*.4,ly+H*.01,cx-lw*.4,ly+H*.01,cx-lw,ly);
  let lg=ctx.createLinearGradient(0,ly-H*.07,0,ly);lg.addColorStop(0,'#B05A5A');lg.addColorStop(1,'#7E3A3C');ctx.fillStyle=lg;ctx.fill();
  ctx.beginPath();ctx.moveTo(cx-lw,ly);ctx.bezierCurveTo(cx-lw*.4,ly+H*.01,cx+lw*.4,ly+H*.01,cx+lw,ly);ctx.bezierCurveTo(cx+lw*.6,ly+H*.11,cx-lw*.6,ly+H*.11,cx-lw,ly);
  lg=ctx.createLinearGradient(0,ly,0,ly+H*.1);lg.addColorStop(0,'#8E4446');lg.addColorStop(.5,'#C06A68');lg.addColorStop(1,'#A45656');ctx.fillStyle=lg;ctx.fill();
  blob(ctx,cx-lw*.15,ly+H*.045,lw*.35,H*.018,'rgba(255,225,220,.55)','rgba(255,225,220,0)');
  ctx.strokeStyle='rgba(70,26,26,.6)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(cx-lw,ly);ctx.bezierCurveTo(cx-lw*.4,ly+H*.01,cx+lw*.4,ly+H*.01,cx+lw,ly);ctx.stroke();
  blob(ctx,cx,ly+H*.2,W*.2,H*.06,rgba(SKIN.shadow,.22),rgba(SKIN.shadow,0)); // chin shadow
  blob(ctx,cx,ly+H*.3,W*.16,H*.05,rgba(SKIN.hi,.35),rgba(SKIN.hi,0));
  ctx.restore();
}
// hairline cap (skin hidden under hair at top), with middle part
function drawCap(ctx,cx,cy,sh,t){ctx.save();facePath(ctx,cx,cy,{...sh,w:sh.w*1.04,h:sh.h*1.04});ctx.clip();
  ctx.beginPath();ctx.moveTo(cx-sh.w*1.3,cy-sh.h*1.4);ctx.lineTo(cx+sh.w*1.3,cy-sh.h*1.4);ctx.lineTo(cx+sh.w*1.3,cy-sh.h*.1);
  for(let i=0;i<=48;i++){const x=cx+sh.w*1.3-i/48*sh.w*2.6;const d=(x-cx)/sh.w;ctx.lineTo(x,cy-sh.h*.7+d*d*sh.h*.45+(Math.abs(d)<.12?-sh.h*.03:0))}ctx.closePath();
  const g=ctx.createLinearGradient(0,cy-sh.h*1.1,0,cy-sh.h*.5);g.addColorStop(0,rgba(MID,1));g.addColorStop(1,rgba(DARK,1));ctx.fillStyle=g;ctx.fill();ctx.restore()}

// public: draw head with style morph m (0=wolf,1=butterfly)
window.HEAD={drawHead(ctx,t,cx,cy,sh,m,grow,a,seed=5){
  ctx.save();ctx.globalAlpha=a;
  const A=buildStyle('wolf',cx,cy,sh.w,sh.h,t,seed),B=buildStyle('butterfly',cx,cy,sh.w,sh.h,t,seed+1);
  const L=m<=0?A:m>=1?B:morph(A,B,m);
  L.sort((x,y)=>x.depth-y.depth);
  const back=L.filter(l=>l.depth<.5&&!l.front),mid=L.filter(l=>l.depth>=.5&&!l.front),front=L.filter(l=>l.front);
  for(const l of back)drawLock(ctx,l,t,0,grow);
  drawBody(ctx,cx,cy,sh);
  drawFace(ctx,cx,cy,sh,t);
  if(grow>0)drawCap(ctx,cx,cy,sh,t);
  for(const l of mid)drawLock(ctx,l,t,.5,grow);
  for(const l of front)drawLock(ctx,l,t,1,grow);
  ctx.restore();
},drawBust(ctx,t,cx,cy,sh,a){ctx.save();ctx.globalAlpha=a;drawBody(ctx,cx,cy,sh);drawFace(ctx,cx,cy,sh,t);ctx.restore()}};
})();
