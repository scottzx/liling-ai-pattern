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
    R.toneMapping=THREE.ACESFilmicToneMapping;R.outputColorSpace=THREE.SRGBColorSpace;el.appendChild(R.domElement);
    const S=this.S=new THREE.Scene();S.background=new THREE.Color(0xf6f2ea);S.environment=new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(),0.04).texture;
    this.cam=new THREE.PerspectiveCamera(35,1,0.001,50);this.ctl=new OrbitControls(this.cam,R.domElement);this.ctl.enableDamping=true;this.ctl.autoRotateSpeed=1.5;
    const dl=new THREE.DirectionalLight(0xffffff,1.2);dl.position.set(2,3,2);S.add(dl);
    this.baker=new Baker(R,2048);this.loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);this.meshes=[];this.tex=null;this.hl=null;
    this.white=new THREE.DataTexture(new Uint8Array([255,255,255,0]),1,1);this.white.needsUpdate=true;
    new ResizeObserver(()=>this.resize()).observe(el);this.resize();const loop=()=>{requestAnimationFrame(loop);this.ctl.update();R.render(S,this.cam)};loop();}
  resize(){const w=this.el.clientWidth||1,h=this.el.clientHeight||1;this.R.setSize(w,h);this.cam.aspect=w/h;this.cam.updateProjectionMatrix()}
  mat(n){const r=/base/.test(n);return new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:r?0.6:0.12,ior:1.52,clearcoat:r?0:0.3,clearcoatRoughness:0.05,side:THREE.DoubleSide})}
  async load(id){if(this.id===id)return;this.id=id;const gl=await this.loader.loadAsync('models/'+id+'_meshopt.glb');if(this.cur)this.S.remove(this.cur);
    this.cur=gl.scene;this.lid=null;this.lidOpen=false;this.meshes=[];
    this.cur.traverse(o=>{if(o.isMesh){o.userData.slot=o.material.name||'';o.material=this.mat(o.userData.slot);this.meshes.push(o)}if(/_lid$/.test(o.name))this.lid=o});
    this.meshes.forEach(addPatternCoords);this.S.add(this.cur);this.rebake();
    const b=new THREE.Box3().setFromObject(this.cur),c=b.getCenter(new THREE.Vector3()),sz=b.getSize(new THREE.Vector3()).length();
    this.ctl.target.copy(c);this.cam.position.copy(c).add(new THREE.Vector3(0,sz*.45,sz*2.1));this.ctl.update();}
  async setPattern(url){if(!url){this.tex=null;this.hl=null;return this.rebake()}const t=await new THREE.TextureLoader().loadAsync(url);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;this.tex=t;this.hl=null;this.rebake()}
  setHighlight(canvas){if(!canvas){this.hl=null}else{const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;this.hl=t}this.rebake()}
  rebake(){if(!this.meshes.length)return;const pat=this.hl||this.tex||this.white;
    const t=this.baker.bake(this.meshes,{pattern:pat,band:BAND[this.id],crop:this.hl||!this.tex?[0,1]:cropFor(this.id)});
    for(const m of this.meshes){m.material.map=/base|floor|under/.test(m.userData.slot)?null:t;m.material.needsUpdate=true}}
  toggleLid(){if(!this.lid)return;this.lidOpen=!this.lidOpen;this.lid.position.y+=this.lidOpen?0.05:-0.05}
  snapshot(){return this.R.domElement.toDataURL('image/png')}
  moveTo(el){el.appendChild(this.R.domElement);this.el=el;new ResizeObserver(()=>this.resize()).observe(el);this.resize()}
}
