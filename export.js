// 生产稿导出：按色料分层 + 1:1 扇形花纸（300dpi），以及手绘分水工艺图
// 胜利杯主纹带 = body.outer_07(上) + body.outer_06(下)，参数来自 spec.md v3
export const FANS={cup_shengli_13p8_v3:[
  {id:'outer_07',name:'上段 outer_07',Rin:575.70,Rout:632.00,theta:25.03,size:'273.9×70.0',v:[0,0.585]},
  {id:'outer_06',name:'下段 outer_06',Rin:571.67,Rout:611.54,theta:23.56,size:'249.7×51.9',v:[0.585,1]}]};
export const DPMM=11.81; // 300dpi
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
// 读取裁切后的纹样像素并分类到 (色料, 浓淡档)
export function classify(img,pal,crop){const sh=Math.round(img.naturalHeight*(crop[1]-crop[0])),sy=Math.round(img.naturalHeight*crop[0]),W=img.naturalWidth,H=sh;
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(img,0,sy,W,sh,0,0,W,H);
  const d=g.getImageData(0,0,W,H).data,N=W*H,cls=new Int16Array(N),cache=new Map();
  for(let i=0;i<N;i++){const key=(d[4*i]<<16)|(d[4*i+1]<<8)|d[4*i+2];let k=cache.get(key);
    if(k===undefined){let best=1e9;k=0;for(let s=0;s<pal.sw.length;s++){const c=pal.sw[s].c,e=(d[4*i]-c[0])**2+(d[4*i+1]-c[1])**2+(d[4*i+2]-c[2])**2;if(e<best){best=e;k=s}}cache.set(key,k)}cls[i]=k}
  const cover=new Map();for(let i=0;i<N;i++){const s=pal.sw[cls[i]];if(s.pi>=0)cover.set(s.pi,(cover.get(s.pi)||0)+1)}
  const layers=[...cover.entries()].filter(([,c])=>c/N>0.001).sort((a,b)=>b[1]-a[1]).map(([pi,c])=>({pi,name:pal.names[pi],cover:c/N,hex:pal.hexes[pi]}));
  return {W,H,cls,rgb:d,layers};}
const FACT=[1,0.7,0.45,0.25];
// 把矩形纹样某一段扭成扇形；fn(i)->[r,g,b] 给出源像素颜色
export function fan(src,band,scale,fn,mark=true){const R1=band.Rin*scale,R2=band.Rout*scale,th=band.theta*Math.PI/180,pad=Math.round(8*scale);
  const W=Math.ceil(2*R2*Math.sin(th/2))+2*pad,H=Math.ceil(R2-R1*Math.cos(th/2))+2*pad;const cx=W/2,cy=pad+R2; // 圆心在下方
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');const im=g.createImageData(W,H),o=im.data;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const dx=x-cx,dy=cy-y,r=Math.hypot(dx,dy),a=Math.atan2(dx,dy),p=4*(y*W+x);
    if(r<R1||r>R2||Math.abs(a)>th/2){o[p]=o[p+1]=o[p+2]=255;o[p+3]=255;continue}
    const u=(a+th/2)/th,vv=band.v[0]+(R2-r)/(R2-R1)*(band.v[1]-band.v[0]);const sx=Math.min(src.W-1,Math.floor(u*src.W)),sy=Math.min(src.H-1,Math.floor(vv*src.H));
    const c=fn(sy*src.W+sx);o[p]=c[0];o[p+1]=c[1];o[p+2]=c[2];o[p+3]=255}
  g.putImageData(im,0,0);
  if(mark){g.strokeStyle='#d0021b';g.lineWidth=Math.max(1,scale*0.25);g.beginPath();g.arc(cx,cy,R1,-Math.PI/2-th/2,-Math.PI/2+th/2);g.arc(cx,cy,R2,-Math.PI/2+th/2,-Math.PI/2-th/2,true);g.closePath();g.stroke();
    // 套准十字
    const cross=(x,y)=>{const s=4*scale;g.beginPath();g.moveTo(x-s,y);g.lineTo(x+s,y);g.moveTo(x,y-s);g.lineTo(x,y+s);g.stroke();g.beginPath();g.arc(x,y,s*.5,0,7);g.stroke()};
    cross(pad*0.6,pad*0.6);cross(W-pad*0.6,pad*0.6);cross(W/2,H-pad*0.4);}
  return cv;}
// 颜色函数：合成 / 单色料灰度层 / 分水线稿
export const colorFn={
  composite:(src)=>i=>[src.rgb[4*i],src.rgb[4*i+1],src.rgb[4*i+2]],
  layer:(src,pal,pi)=>i=>{const s=pal.sw[src.cls[i]];if(s.pi!==pi)return [255,255,255];const v=Math.round(255*(1-FACT[s.li]));return [v,v,v]},
  lineart:(src,pal)=>{const W=src.W;return i=>{const s=pal.sw[src.cls[i]];if(s.pi>=0)return [255,255,255];
    // 白描线：与色块相邻的白色像素画成黑线
    for(const j of [i-1,i+1,i-W,i+W]){if(j>=0&&j<src.cls.length&&pal.sw[src.cls[j]].pi>=0)return [30,30,30]}return [255,255,255]}}};
export function download(cv,name){cv.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click()})}
