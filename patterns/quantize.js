// quantize.js — dependency-free ES module. Browser port of process2.py + snap.py per-pixel colour step.
// Demo palette, to be calibrated by factory. 14 pigments x 4 tints (pigment*f + white*(1-f), f=[1.0, 0.7, 0.45, 0.25]) + #FFFFFF.
export const TINT_FACTORS = [1.0, 0.7, 0.45, 0.25];
export const PALETTE = {
 "玛瑙红": [
  "#B8323A",
  "#CD7075",
  "#DFA3A6",
  "#EDCCCE"
 ],
 "桃红": [
  "#E07A8F",
  "#E9A2B1",
  "#F1C3CD",
  "#F7DEE3"
 ],
 "芙蓉红": [
  "#E8A0A0",
  "#EFBCBC",
  "#F5D4D4",
  "#F9E7E7"
 ],
 "海碧": [
  "#2F6FA8",
  "#6D9AC2",
  "#A1BED8",
  "#CBDBE9"
 ],
 "海蓝": [
  "#3D5A98",
  "#778CB7",
  "#A8B5D1",
  "#CED6E5"
 ],
 "草青": [
  "#4E8C4A",
  "#83AE80",
  "#AFCBAE",
  "#D3E2D2"
 ],
 "浅绿": [
  "#9CC79A",
  "#BAD8B8",
  "#D2E6D2",
  "#E6F1E6"
 ],
 "墨绿": [
  "#2E5A3A",
  "#6D8C75",
  "#A1B5A6",
  "#CBD6CE"
 ],
 "碧绿": [
  "#3E9A8A",
  "#78B8AD",
  "#A8D2CA",
  "#CFE6E2"
 ],
 "钛黄": [
  "#E8C84A",
  "#EFD880",
  "#F5E6AE",
  "#F9F1D2"
 ],
 "橘黄": [
  "#E89A3A",
  "#EFB875",
  "#F5D2A6",
  "#F9E6CE"
 ],
 "赭色": [
  "#8A5A3A",
  "#AD8C75",
  "#CAB5A6",
  "#E2D6CE"
 ],
 "紫": [
  "#7A5A9A",
  "#A28CB8",
  "#C3B5D2",
  "#DED6E6"
 ],
 "艳黑": [
  "#2A2A2A",
  "#6A6A6A",
  "#9F9F9F",
  "#CACACA"
 ]
};
export const WHITE = "#FFFFFF";
const names = Object.keys(PALETTE);
const hex = h => [1,3,5].map(i => parseInt(h.slice(i,i+2),16));
// TARGETS[k] = [r,g,b], k = pigment*4 + tint; k = 56 is white
const TARGETS = names.flatMap(n => PALETTE[n].map(hex)).concat([[255,255,255]]);
const WHITE_IDX = TARGETS.length - 1;
function lin(c){ c/=255; return c>0.04045 ? ((c+0.055)/1.055)**2.4 : c/12.92; }
function lab(r,g,b){
  r=lin(r); g=lin(g); b=lin(b);
  const f=t=> t>0.008856 ? Math.cbrt(t) : 7.787*t+16/116;
  const x=f((0.4124*r+0.3576*g+0.1805*b)/0.9505), y=f(0.2126*r+0.7152*g+0.0722*b), z=f((0.0193*r+0.1192*g+0.9505*b)/1.089);
  return [116*y-16, 500*(x-y), 200*(y-z)];
}
const TLAB = TARGETS.slice(0,WHITE_IDX).map(c=>lab(...c));
function nearest(r,g,b){
  const [L,A,B]=lab(r,g,b);
  if (L>90 && Math.hypot(A,B)<10) return WHITE_IDX;      // near-white paper -> white (process2 rule)
  let best=0, bd=Infinity;
  for (let k=0;k<TLAB.length;k++){ const t=TLAB[k], d=(L-t[0])**2+(A-t[1])**2+(B-t[2])**2; if(d<bd){bd=d;best=k;} }
  return best;
}
const LUTS = {};
function lut(bits){
  if (LUTS[bits]) return LUTS[bits];
  const n=1<<bits, s=256/n, o=s/2, L=new Uint8Array(n*n*n);
  for (let r=0;r<n;r++) for (let g=0;g<n;g++) for (let b=0;b<n;b++) L[(r*n+g)*n+b]=nearest(r*s+o,g*s+o,b*s+o);
  return LUTS[bits]=L;
}
const FLAT = new Uint8Array(TARGETS.flat());
/** quantize(imageData, {lutBits=6, inPlace=false}) -> ImageData with every pixel an exact palette tint or #FFFFFF. Alpha is kept. */
export function quantize(img, opts={}){
  const bits=opts.lutBits??6, L=lut(bits), sh=8-bits, src=img.data;
  const out = opts.inPlace ? img : (typeof ImageData!=="undefined" ? new ImageData(new Uint8ClampedArray(src), img.width, img.height) : {width:img.width,height:img.height,data:new Uint8ClampedArray(src)});
  const d=out.data;
  for (let i=0;i<d.length;i+=4){
    const k=L[(((src[i]>>sh)<<bits|(src[i+1]>>sh))<<bits)|(src[i+2]>>sh)]*3;
    d[i]=FLAT[k]; d[i+1]=FLAT[k+1]; d[i+2]=FLAT[k+2];
  }
  return out;
}
/** stats(imageData) -> {pigment: pixelCount, ..., white, other} (counts exact matches only) */
export function stats(img){
  const m=new Map(); TARGETS.forEach((c,k)=>m.set((c[0]<<16)|(c[1]<<8)|c[2], k===WHITE_IDX?"white":names[k>>2]));
  const res=Object.fromEntries(names.map(n=>[n,0])); res.white=0; res.other=0; const d=img.data;
  for (let i=0;i<d.length;i+=4){ const n=m.get((d[i]<<16)|(d[i+1]<<8)|d[i+2]); res[n??"other"]++; }
  return res;
}
