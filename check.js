// 工艺校验：逐像素对色板（色相+浓淡档），禁止叠色，主色数量。规则参数可配置，待工厂标定。
export const RULES={offTol:28,offRatio:0.003,overlay:[['艳黑','海碧'],['艳黑','海蓝']],overlayRadius:2,overlayRatio:0.002,maxPigments:8,minCover:0.004};
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
export async function loadPalette(url){const p=await (await fetch(url)).json();const sw=[];const names=Object.keys(p.tint_levels.tints);const hexes=names.map(n=>p.pigments[n]);
  names.forEach((n,pi)=>p.tint_levels.tints[n].forEach((h,li)=>sw.push({n,pi,li,c:hex(h)})));sw.push({n:'白描线',pi:-1,li:0,c:[255,255,255]});return {names,sw,hexes};}
export function check(img,pal,crop=[0,1],W=1024,rules=RULES){
  const sh=Math.round(img.naturalHeight*(crop[1]-crop[0])),sy=Math.round(img.naturalHeight*crop[0]);const H=Math.max(1,Math.round(W*sh/img.naturalWidth));
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(img,0,sy,img.naturalWidth,sh,0,0,W,H);
  const d=g.getImageData(0,0,W,H).data,N=W*H,cls=new Int16Array(N),off=new Uint8Array(N),cover=new Float64Array(pal.names.length);let nOff=0;const t2=rules.offTol**2;
  for(let i=0;i<N;i++){const r=d[4*i],gg=d[4*i+1],b=d[4*i+2];let best=1e9,k=0;for(let s=0;s<pal.sw.length;s++){const c=pal.sw[s].c,e=(r-c[0])**2+(gg-c[1])**2+(b-c[2])**2;if(e<best){best=e;k=s}}
    cls[i]=k;if(best>t2){off[i]=1;nOff++}else if(pal.sw[k].pi>=0)cover[pal.sw[k].pi]++;}
  // 叠色：A色（浓档）像素周围 radius 内出现 B 色
  const idx=n=>pal.names.indexOf(n),ov=new Uint8Array(N);let nOv=0;const R=rules.overlayRadius;const pairs=[];
  for(const [a,b] of rules.overlay){const A=idx(a),B=idx(b);let cnt=0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x,s=pal.sw[cls[i]];if(off[i]||s.pi!==A||s.li>1)continue;
      let hit=false;for(let dy=-R;dy<=R&&!hit;dy++)for(let dx=-R;dx<=R;dx++){const xx=(x+dx+W)%W,yy=y+dy;if(yy<0||yy>=H)continue;const j=yy*W+xx,t=pal.sw[cls[j]];if(!off[j]&&t.pi===B){hit=true;break}}
      if(hit){if(!ov[i]){ov[i]=1;nOv++}cnt++}}
    pairs.push({a,b,ratio:cnt/N});}
  const used=pal.names.map((n,i)=>({n,r:cover[i]/N})).filter(o=>o.r>=rules.minCover).sort((x,y)=>y.r-x.r);
  const items=[
    {rule:'色板校验',pass:nOff/N<=rules.offRatio,detail:`色板外像素 ${(100*nOff/N).toFixed(2)}%（阈值 ${(100*rules.offRatio).toFixed(1)}%）`},
    {rule:'禁止叠色',pass:pairs.every(p=>p.ratio<=rules.overlayRatio),detail:pairs.map(p=>`${p.a}压${p.b} ${(100*p.ratio).toFixed(2)}%`).join('，')},
    {rule:'主色数量',pass:used.length<=rules.maxPigments,detail:`${used.length} 种：${used.map(o=>o.n).join('、')}（上限 ${rules.maxPigments}）`}];
  // 高亮图：违规红色，其余淡化
  const out=g.createImageData(W,H);for(let i=0;i<N;i++){const bad=off[i]||ov[i];const o=4*i;
    if(bad){out.data[o]=255;out.data[o+1]=0;out.data[o+2]=40}else{for(let c=0;c<3;c++)out.data[o+c]=Math.round(d[o+c]*0.35+255*0.65)}out.data[o+3]=255}
  const hc=document.createElement('canvas');hc.width=W;hc.height=H;hc.getContext('2d').putImageData(out,0,0);
  return {pass:items.every(i=>i.pass),items,used,highlight:hc,cls,W,H};}
