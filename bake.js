// 矩形纹样 -> 扇形UV图集：在UV空间渲染网格，按 (绕轴角度, 母线弧长) 采样矩形纹样
import * as THREE from 'three';
export function addPatternCoords(mesh){
  const g=mesh.geometry,p=g.attributes.position,n=p.count;
  const cs=new Float32Array(n*2),s=new Float32Array(n),ry=[];
  for(let i=0;i<n;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(x,z);cs[2*i]=Math.cos(a);cs[2*i+1]=Math.sin(a);ry.push([Math.round(y*1e4),Math.hypot(x,z)])}
  // 母线：按高度分环，取每环最大半径（外轮廓），累计弧长
  const rings=new Map();for(const [k,r] of ry)rings.set(k,Math.max(rings.get(k)||0,r));
  const ks=[...rings.keys()].sort((a,b)=>a-b);const arc=new Map();let acc=0,pk=ks[0];
  for(const k of ks){acc+=Math.hypot((k-pk)/1e4,rings.get(k)-rings.get(pk));arc.set(k,acc);pk=k}
  for(let i=0;i<n;i++)s[i]=arc.get(ry[i][0])/acc;
  g.setAttribute('pcs',new THREE.BufferAttribute(cs,2));g.setAttribute('parc',new THREE.BufferAttribute(s,1));
  return acc; // 母线总长(m)
}
const vs=`attribute vec2 pcs;attribute float parc;varying vec2 vcs;varying float vs;varying vec2 vpos;
void main(){vcs=pcs;vs=parc;vpos=position.xz;gl_Position=vec4(uv*2.0-1.0,0.0,1.0);}`;
const fs=`uniform sampler2D pat;uniform sampler2D lidpat;uniform vec2 band;uniform float tiles;uniform int mode;uniform float lidR;uniform vec2 crop;
varying vec2 vcs;varying float vs;varying vec2 vpos;
void main(){vec3 white=vec3(0.93,0.93,0.90);
 if(mode==0){float u=fract(0.5+atan(vcs.y,vcs.x)/6.2831853*tiles);float v=(vs-band.x)/(band.y-band.x);
  if(v<0.0||v>1.0){gl_FragColor=vec4(white,1.0);return;} vec4 c=texture2D(pat,vec2(u,mix(crop.x,crop.y,v)));gl_FragColor=vec4(mix(white,c.rgb,c.a),1.0);}
 else if(mode==1){vec2 q=vpos/lidR*0.5+0.5;vec4 c=texture2D(lidpat,vec2(q.x,1.0-q.y));gl_FragColor=vec4(mix(white,c.rgb,c.a),1.0);}
 else gl_FragColor=vec4(white,1.0);}`;
// 扩边：把UV岛外的透明像素用相邻有效像素填满，消除采样到岛缝时的细线
const dvs=`varying vec2 vu;void main(){vu=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;
const dfs=`uniform sampler2D src;uniform vec2 px;varying vec2 vu;
void main(){vec4 c=texture2D(src,vu);if(c.a>0.99){gl_FragColor=c;return;}
 vec4 acc=vec4(0.0);for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){vec4 n=texture2D(src,vu+vec2(i,j)*px);if(n.a>0.99)acc+=vec4(n.rgb,1.0);}
 gl_FragColor=acc.a>0.0?vec4(acc.rgb/acc.a,1.0):vec4(c.rgb,0.0);}`;
export class Baker{
  constructor(renderer,size=2048){this.r=renderer;this.rt=new THREE.WebGLRenderTarget(size,size,{colorSpace:THREE.SRGBColorSpace,samples:4});
    this.rt.texture.flipY=false;
    const o={colorSpace:THREE.SRGBColorSpace,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter};this.pp=[new THREE.WebGLRenderTarget(size,size,o),new THREE.WebGLRenderTarget(size,size,o)];
    this.pp.forEach(t=>t.texture.flipY=false);
    this.dmat=new THREE.ShaderMaterial({vertexShader:dvs,fragmentShader:dfs,uniforms:{src:{value:null},px:{value:new THREE.Vector2(1/size,1/size)}}});
    this.dscene=new THREE.Scene();this.dscene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.dmat));this.scene=new THREE.Scene();this.cam=new THREE.OrthographicCamera(-1,1,1,-1,-1,1);}
  bake(meshes,{pattern,lidPattern,band=[0.15,0.85],tiles=1,crop=[0,1]}){
    for(const t of [pattern,lidPattern])if(t&&t.minFilter!==THREE.LinearFilter){t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;t.needsUpdate=true;}
    this.scene.clear();
    for(const m of meshes){const name=m.userData.slot||'';const mode=/outer/.test(name)?0:/lidtop/.test(name)?1:2;
      const geo=m.geometry;geo.computeBoundingBox();const lidR=Math.max(geo.boundingBox.max.x,-geo.boundingBox.min.x);
      const mat=new THREE.ShaderMaterial({vertexShader:vs,fragmentShader:fs,side:THREE.DoubleSide,
        uniforms:{pat:{value:pattern},lidpat:{value:lidPattern||pattern},band:{value:new THREE.Vector2(...band)},tiles:{value:tiles},mode:{value:mode},lidR:{value:lidR},crop:{value:new THREE.Vector2(...crop)}}});
      this.scene.add(new THREE.Mesh(geo,mat));}
    this.r.setRenderTarget(this.rt);this.r.setClearColor(0xedede6,0);this.r.clear();this.r.render(this.scene,this.cam);
    let src=this.rt.texture;for(let k=0;k<10;k++){const dst=this.pp[k%2];this.dmat.uniforms.src.value=src;this.r.setRenderTarget(dst);this.r.render(this.dscene,this.cam);src=dst.texture;}
    this.r.setRenderTarget(null);this.r.setClearColor(0xf3efe8,1);return src;}
}
