// 3D 预览组件：加载 GLB，GPU 烘焙扇形贴图，开合盖、违规高亮、截图
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Baker,addPatternCoords} from './bake.js';
export const BAND={cup_shengli_13p8_v3:[0.08,0.92],bowl_maoci_12p5_v3:[0.1,0.9],vase_fengweizun_46_v3:[0.22,0.55]};
export const ASPECT={cup_shengli_13p8_v3:2.87,vase_fengweizun_46_v3:7.3,bowl_maoci_12p5_v3:6};
export const cropFor=id=>{const h=2/ASPECT[id];return [0.5-h/2,0.5+h/2]};
export class Viewer{
  constructor(el){this.el=el;const R=this.R=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});R.setPixelRatio(Math.min(devicePixelRatio,2));
    R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=1.1;R.outputColorSpace=THREE.SRGBColorSpace;el.appendChild(R.domElement);
    const S=this.S=new THREE.Scene();S.background=new THREE.Color(0xf6f2ea);S.environment=new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(),0.04).texture;
    this.cam=new THREE.PerspectiveCamera(35,1,0.001,50);this.ctl=new OrbitControls(this.cam,R.domElement);this.ctl.enableDamping=true;this.ctl.autoRotateSpeed=1.5;
    S.environmentIntensity=1.15;const dl=new THREE.DirectionalLight(0xfff6ea,1.4);dl.position.set(-2,3,2);S.add(dl);const fl=new THREE.DirectionalLight(0xeaf2ff,0.5);fl.position.set(2,1,1.5);S.add(fl);const rl=new THREE.DirectionalLight(0xffffff,0.7);rl.position.set(0.5,2,-2.5);S.add(rl);
    this.ctl.autoRotate=true;let to;this.ctl.addEventListener('start',()=>{this.ctl.autoRotate=false;clearTimeout(to)});this.ctl.addEventListener('end',()=>{clearTimeout(to);to=setTimeout(()=>this.ctl.autoRotate=true,4000)});
    {const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(60,45,30,0.45)');gr.addColorStop(0.5,'rgba(60,45,30,0.15)');gr.addColorStop(1,'rgba(60,45,30,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
     this.shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;S.add(this.shadow)}
    this.bar=document.createElement('div');this.bar.style.cssText='position:absolute;left:20%;right:20%;top:50%;height:4px;border-radius:2px;background:#e4dccd;overflow:hidden;display:none;pointer-events:none';this.bar.innerHTML='<div style="height:100%;width:0;background:#2f6f8f;transition:width .2s"></div>';
    this.baker=new Baker(R,2048);this.loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);this.meshes=[];this.tex=null;this.hl=null;
    this.white=new THREE.DataTexture(new Uint8Array([255,255,255,0]),1,1);this.white.needsUpdate=true;
    new ResizeObserver(()=>this.resize()).observe(el);this.resize();const loop=()=>{requestAnimationFrame(loop);this.ctl.update();R.render(S,this.cam)};loop();}
  resize(){const w=this.el.clientWidth||1,h=this.el.clientHeight||1;this.R.setSize(w,h);this.cam.aspect=w/h;this.cam.updateProjectionMatrix()}
  mat(n){const r=/base/.test(n);return new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:r?0.6:0.18,ior:1.52,clearcoat:r?0:0.8,clearcoatRoughness:0.04,side:THREE.DoubleSide})}
  async load(id){if(this.id===id)return;this.id=id;if(getComputedStyle(this.el).position==='static')this.el.style.position='relative';this.el.appendChild(this.bar);this.bar.style.display='block';const f=this.bar.firstChild;f.style.width='5%';
    const gl=await this.loader.loadAsync('models/'+id+'_meshopt.glb',e=>{if(e.total)f.style.width=Math.round(100*e.loaded/e.total)+'%'}).finally(()=>{this.bar.style.display='none'});if(this.cur)this.S.remove(this.cur);
    this.cur=gl.scene;this.lid=null;this.lidOpen=false;this.meshes=[];
    this.cur.traverse(o=>{if(o.isMesh){o.userData.slot=o.material.name||'';o.material=this.mat(o.userData.slot);this.meshes.push(o)}if(/_lid$/.test(o.name))this.lid=o});
    this.meshes.forEach(addPatternCoords);this.S.add(this.cur);this.rebake();
    const b=new THREE.Box3().setFromObject(this.cur),c=b.getCenter(new THREE.Vector3()),sz=b.getSize(new THREE.Vector3()).length();
    this.shadow.position.set(c.x,b.min.y+0.0005,c.z);const sw=Math.max(b.max.x-b.min.x,b.max.z-b.min.z)*1.8;this.shadow.scale.set(sw,sw,1);this.ctl.target.copy(c);this.cam.position.copy(c).add(new THREE.Vector3(0,sz*.45,sz*2.1));this.ctl.update();}
  async setPattern(url){if(!url){this.tex=null;this.hl=null;return this.rebake()}const t=await new THREE.TextureLoader().loadAsync(url);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;this.tex=t;this.hl=null;this.rebake()}
  setHighlight(canvas){if(!canvas){this.hl=null}else{const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;this.hl=t}this.rebake()}
  rebake(){if(!this.meshes.length)return;const pat=this.hl||this.tex||this.white;
    const t=this.baker.bake(this.meshes,{pattern:pat,band:BAND[this.id],crop:this.hl||!this.tex?[0,1]:cropFor(this.id)});
    for(const m of this.meshes){m.material.map=/base|floor|under/.test(m.userData.slot)?null:t;m.material.needsUpdate=true}}
  toggleLid(){if(!this.lid)return;this.lidOpen=!this.lidOpen;this.lid.position.y+=this.lidOpen?0.05:-0.05}
  snapshot(){return this.R.domElement.toDataURL('image/png')}
  moveTo(el){el.appendChild(this.R.domElement);this.el=el;new ResizeObserver(()=>this.resize()).observe(el);this.resize()}
}
