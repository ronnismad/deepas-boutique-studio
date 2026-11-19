import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { enhanceModel } from './realism.js';
import { createFinishes, finishOptions } from './finishes.js';
import { prepareLighting, updateEnvironment, lightingOptions } from './lighting.js';
import { makeEnclosure } from './enclosure.js';
import { createTrace } from './trace.js';
import { liveRendering, streetView, finishTransom } from './surfaces.js';
import { $, initUI, defaults, validState, toast } from './ui.js';

const stage = $('stage'), canvas = $('view'), status = $('status');
const assets = new Map();
const overhead = new THREE.OrthographicCamera(-5,5,5,-5,.04,90);
const eye = new THREE.PerspectiveCamera(57,1,.035,90);
const scene = new THREE.Scene();
let renderer, controls, hemisphere, sun, packed, ui, tracer, live, street;
let entranceOpen=false;
let state = {...defaults}, displayed, camera = overhead, view = 'cutaway', quality = 'live';
let revision = 0, framePending = false, mirrorDepth = 0, cameraLocked = false, everFramed = false;

function loadPackedModel(name) {
  const model = packed.models[name], bytes = new Uint8Array(model.length);
  for (const [offset,id] of model.segments) {
    if (typeof packed.chunks[id] === 'string') {
      const str = atob(packed.chunks[id]), part = new Uint8Array(str.length);
      for(let k=0;k<part.length;k++) part[k] = str.charCodeAt(k);
      packed.chunks[id] = part;
    }
    bytes.set(packed.chunks[id],offset);
  }
  return bytes.buffer;
}

// Sky, a large street opening and two soft studio highlights, in linear radiance.
function daylightEnvironment() {
  const width=256,height=128, pixels=new Float32Array(width*height*4);
  const lights = [[-.20,.25,.95,2.4,12],[.73,.58,-.36,1.7,19],[-.22,.96,-.15,2.2,7]];
  for(let y=0;y<height;y++){
    const phi=(y+.5)*Math.PI/height, dy=-Math.cos(phi);
    for(let x=0;x<width;x++){
      const a=((x+.5)/width-.5)*Math.PI*2,dx=Math.cos(a)*Math.sin(phi),dz=Math.sin(a)*Math.sin(phi);
      const sky=Math.max(dy,0), ground=Math.max(-dy,0);
      let r=.39+.53*sky+.10*ground,g=.38+.61*sky+.06*ground,b=.37+.74*sky+.015*ground;
      for(const [lx,ly,lz,power,sharp] of lights){
        const v=power*Math.pow(Math.max(0,dx*lx+dy*ly+dz*lz),sharp);
        r+=v;g+=v*.965;b+=v*.89;
      }
      const i=(y*width+x)*4;pixels[i]=r;pixels[i+1]=g;pixels[i+2]=b;pixels[i+3]=1;
    }
  }
  const tex=new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat,THREE.FloatType);
  tex.mapping=THREE.EquirectangularReflectionMapping;tex.colorSpace=THREE.LinearSRGBColorSpace;
  tex.needsUpdate=true;return tex;
}
function requestDraw() {
  if(framePending||!renderer)return;
  framePending=true;
  requestAnimationFrame(()=>{framePending=false;if(quality==='live')live.draw();});
}
function setupMirrors(object) {
  for(const group of [...object.children]) {
    if(!group.name.toLowerCase().startsWith('mirror'))continue;
    let silver;
    group.traverse(m=>{if(m.isMesh&&(m.material.name.toLowerCase().includes('silver')||m.material.metalness>.96))silver=m;});
    if(!silver)continue;
    const bounds=new THREE.Box3().setFromObject(silver),size=bounds.getSize(new THREE.Vector3()),centre=bounds.getCenter(new THREE.Vector3());
    const alongZ=size.z>size.x;
    const mirror=new Reflector(new THREE.PlaneGeometry(alongZ?size.z:size.x,size.y),{color:0xe1e5df,textureWidth:768,textureHeight:768,clipBias:.001});
    mirror.name='Reflection • '+group.name;mirror.userData.planarMirror=true;
    mirror.rotation.y=alongZ?-Math.PI/2:Math.PI;mirror.position.copy(centre);
    if(alongZ)mirror.position.x-=.0025;else mirror.position.z-=.0025;
    const reflect=mirror.onBeforeRender;
    mirror.onBeforeRender=function(...args){if(mirrorDepth||scene.overrideMaterial)return;mirrorDepth++;try{reflect.apply(this,args);}finally{mirrorDepth--;}};
    silver.visible=false;object.add(mirror);
  }
}
function tuneGlass(asset){
  const replacements=new Map();
  asset.scene.traverse(o=>{
    if(!o.isMesh||!o.material)return;
    if(/sliding.entrance/i.test(o.parent?.name||'')){
      if(o.material.name==='#c4a35e'){o.material.metalness=.72;o.material.roughness=.28;}
      if(o.material.name==='#4d5954'){o.material.metalness=.52;o.material.roughness=.38;}
    }
    if(!o.material.name.toLowerCase().includes('clear glazing'))return;
    const original=o.material;
    if(!replacements.has(original)){
      const m=new THREE.MeshPhysicalMaterial({name:original.name,color:0xc6e3de,transparent:true,opacity:Math.min(original.opacity,.065),side:original.side,depthWrite:false,roughness:.085,metalness:.18,clearcoat:1,clearcoatRoughness:.035,envMapIntensity:1.2});
      if(original.opacity>.40){m.opacity=original.opacity;m.roughness=.24;}
      else {
        m.onBeforeCompile=shader=>{
          shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
            'diffuseColor.a += 0.29 * pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 4.0);\n#include <opaque_fragment>');
        };
      }
      replacements.set(original,m);
    }
    o.material=replacements.get(original);
    if(original.opacity>.40)finishTransom(o.geometry,o.material);
    o.castShadow=false;o.receiveShadow=false;
  });
}
async function prepare(base,initialMode){
  const asset=await new GLTFLoader().parseAsync(loadPackedModel(base),'');
  asset.scene.updateMatrixWorld(true);
  enhanceModel(asset);
  asset.scene.traverse(o=>{if(o.isMesh){o.castShadow=!o.material.transparent;o.receiveShadow=!o.material.transparent;}});
  const finishes=await createFinishes(asset), lights=prepareLighting(asset,initialMode);
  tuneGlass(asset);setupMirrors(asset.scene);
  const enclosure=makeEnclosure(asset);
  if(!enclosure.group.parent)asset.scene.add(enclosure.group);
  enclosure.group.visible=false;
  const leaf=asset.scene.children.find(o=>o.name.toLowerCase().includes('closed_left_glass_leaf')||o.name.toLowerCase().includes('closed left glass leaf'));
  return {asset,finishes,lights,enclosure,leaf,closedX:leaf?.position.x??0,lastFinishes:''};
}
const eyeViews={
  front:{position:[1.09,1.56,2.38],target:[1.20,1.32,-2.7],fov:57},
  aisle:{position:[.64,1.57,-3.36],target:[1.53,1.15,-.85],fov:66},
  display:{position:[2.27,1.50,-2.15],target:[.19,1.02,-2.24],fov:59},
  till:{position:[.69,1.50,-2.99],target:[1.89,.99,-1.25],fov:52},
  arch:{position:[.78,1.57,-2.20],target:[.94,1.70,-4.54],fov:67}
};
function isEye(){return !!eyeViews[view];}
function moveDoor(model) {
  if(model?.leaf)model.leaf.position.x=model.closedX+(entranceOpen?1.14:0);
  $('door').setAttribute('aria-pressed',String(entranceOpen));
  $('door').textContent=entranceOpen?'Close sliding door':'Open sliding door';
  canvas.dataset.entrance=entranceOpen?'open':'closed';
}
function toggleDoor(){
  if(!displayed?.leaf)return;
  entranceOpen=!entranceOpen;moveDoor(displayed);tracer?.invalidate(true);requestDraw();
}
function applyDesign(model){
  const key=[state.floor,state.wood,state.wall,state.customWall,state.customCompanion].join('|');
  if(model.lastFinishes!==key){
    model.finishes(state);model.lastFinishes=key;
  }
  const scheme=finishOptions.walls.find(w=>w.id===state.wall);
  model.enclosure.update({accent:scheme?.accent||state.customWall,companion:scheme?.companion||state.customCompanion,daylight:state.daylight});
  street.userData.surface.color.setRGB(.15+.77*state.daylight/100,.20+.75*state.daylight/100,.26+.72*state.daylight/100);
  moveDoor(model);model.lights(state,state.light);
  model.enclosure.group.visible=isEye();
  updateEnvironment(scene,renderer,hemisphere,sun,state,state.light);
}
async function selectDesign(){
  const token=++revision;
  const mode=lightingOptions.find(m=>m.id===state.light);
  if(!assets.has(mode.base))assets.set(mode.base,prepare(mode.base,mode.id).catch(e=>{assets.delete(mode.base);throw e;}));
  const model=await assets.get(mode.base);
  if(token!==revision)return;
  applyDesign(model);
  if(displayed!==model){
    if(displayed)scene.remove(displayed.asset.scene);
    scene.add(model.asset.scene);displayed=model;
  }
  if(!everFramed){everFramed=true;setView(view);}
  status.hidden=true;canvas.dataset.scheme=[state.light,state.floor,state.wall,state.wood].join('|');
  canvas.dataset.settings=JSON.stringify(state);
  tracer?.invalidate(true);requestDraw();
}
function change(partial) {
  state=validState({...state,...partial});ui.sync(state);
  selectDesign().catch(fail);
}
function zoom(factor){
  if(!displayed)return;
  camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,.5,6);camera.updateProjectionMatrix();
  tracer?.invalidate(false);requestDraw();
}
function fitCutaway(){
  const object=displayed.asset.scene;
  object.updateMatrixWorld(true);
  const bounds=new THREE.Box3(),box=new THREE.Box3(),v=new THREE.Vector3(),points=[];
  object.traverseVisible(o=>{
    if(!o.isMesh||!o.geometry?.attributes.position)return;
    const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();
    box.copy(g.boundingBox).applyMatrix4(o.matrixWorld);bounds.union(box);
    points.push(o);
  });
  const centre=bounds.getCenter(v).clone();
  const dir=view==='plan'?new THREE.Vector3(0,1,.00005):view==='rear'?new THREE.Vector3(-.48,1.1,-.86):new THREE.Vector3(.32,1.12,.87);
  overhead.up.set(0,1,0);overhead.position.copy(centre).addScaledVector(dir.normalize(),17);overhead.lookAt(centre);overhead.updateMatrixWorld();
  let loX=Infinity,hiX=-Infinity,loY=Infinity,hiY=-Infinity;
  const transform=new THREE.Matrix4();
  for(const o of points){
    transform.multiplyMatrices(overhead.matrixWorldInverse,o.matrixWorld);
    const pos=o.geometry.attributes.position;
    for(let j=0;j<pos.count;j++){
      v.fromBufferAttribute(pos,j).applyMatrix4(transform);
      loX=Math.min(loX,v.x);hiX=Math.max(hiX,v.x);loY=Math.min(loY,v.y);hiY=Math.max(hiY,v.y);
    }
  }
  const offset=new THREE.Vector3((hiX+loX)*.5,(hiY+loY)*.5,0).applyQuaternion(overhead.quaternion);
  controls.target.copy(centre).add(offset);overhead.position.add(offset);
  overhead.userData.halfHeight=(hiY-loY)*.5;overhead.userData.halfWidth=(hiX-loX)*.5;
}
function setView(next){
  view=next;ui.selectView(view);
  if(!displayed)return;
  cameraLocked=true;
  const interior=isEye(),wasEye=camera===eye;
  camera=interior?eye:overhead;controls.object=camera;
  displayed.enclosure.group.visible=interior;street.visible=interior;
  $('door').hidden=!interior||!displayed.leaf;
  camera.zoom=1;camera.up.set(0,1,0);
  if(interior){
    eye.position.fromArray(eyeViews[view].position);controls.target.fromArray(eyeViews[view].target);
    controls.maxPolarAngle=Math.PI*.87;
  }else{fitCutaway();controls.maxPolarAngle=Math.PI*.493;}
  camera.lookAt(controls.target);controls.update();cameraLocked=false;
  resize();canvas.dataset.camera=view;
  tracer?.invalidate(wasEye!==interior);requestDraw();
}
function resize(){
  if(!renderer)return;
  const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight),aspect=w/h;
  renderer.setSize(w,h,false);live?.resize(w,h);
  eye.aspect=aspect;eye.fov=eyeViews[view]?.fov??57;
  if(aspect<.9)eye.fov+=Math.min(19,(.9-aspect)*50);
  eye.updateProjectionMatrix();
  if(overhead.userData.halfHeight){
    const marginX=w>560?1.07:1.11,marginY=h>410?1.19:1.28;
    const half=Math.max(overhead.userData.halfHeight*marginY,overhead.userData.halfWidth/aspect*marginX);
    overhead.top=half;overhead.bottom=-half;overhead.right=half*aspect;overhead.left=-overhead.right;
  }
  overhead.updateProjectionMatrix();tracer?.resize();requestDraw();
}
function exportPNG(){
  if(!displayed){toast('The shop is still opening');return;}
  if(quality==='live')live.draw();
  canvas.toBlob(blob=>{
    if(!blob){toast('The browser could not export this view');return;}
    const link=document.createElement('a'),url=URL.createObjectURL(blob);
    link.href=url;link.download=['Boutique',view,state.floor,state.wall,state.wood,state.light].join('-')+'.png';
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    toast('Image exported');
  },'image/png');
}
function setQuality(k){
  if(k===quality||!displayed)return;
  if(k==='trace'&&!renderer.extensions.has('EXT_color_buffer_float')){toast('Ray tracing needs floating-point graphics support on this device');return;}
  quality=k;ui.quality(k);canvas.dataset.quality=k;
  if(k==='trace'){
    try{
      if(!tracer)tracer=createTrace(renderer,scene,()=>camera,(msg,n)=>{$('sample').textContent=n>0?msg+' · '+n+' samples':msg;$('sample').dataset.samples=String(n||0);},traceFailed,()=>live.draw());
      tracer.start();
    }catch(e){traceFailed(e);}
  }else{tracer?.stop();requestDraw();}
}
function traceFailed(e){console.warn(e);quality='live';tracer?.stop();ui.quality('live');canvas.dataset.quality='live';toast('Using Live rendering. Ray tracing is unavailable on this device.');requestDraw();}
function fail(e){
  console.error(e);
  status.hidden=false;status.className='fail';
  if(displayed){status.textContent='This design could not be displayed. Choose another finish or lighting layout.';return;}
  $('fallback').src='data:image/jpeg;base64,'+$('poster').textContent.trim();$('fallback').hidden=false;
  status.textContent='Interactive 3D needs graphics acceleration. Open this file in a browser with graphics acceleration enabled.';
  document.querySelectorAll('button,input,select').forEach(b=>b.disabled=true);
}
async function main(){
  ui=initUI({current:()=>state,change,camera:setView,zoom,reset:()=>setView(view),exportPNG,quality:setQuality});
  ui.sync(state);ui.selectView(view);canvas.dataset.quality='live';$('door').onclick=toggleDoor;
  packed=JSON.parse($('modelData').textContent);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(1.65,window.devicePixelRatio||1));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  // The display transform brings this studio charcoal to the interface's #151a19.
  scene.background=new THREE.Color(0x272c2b);
  scene.environment=daylightEnvironment();
  controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minZoom=.5;controls.maxZoom=6;
  controls.minDistance=.4;controls.maxDistance=25;controls.rotateSpeed=.72;
  controls.addEventListener('change',()=>{if(!cameraLocked){tracer?.invalidate(false);requestDraw();}});
  hemisphere=new THREE.HemisphereLight(0xf3f5ef,0xcdbda6,1);
  sun=new THREE.DirectionalLight(0xfff2db,1);sun.position.set(-3.4,10.8,3.3);sun.target.position.set(2,.3,-3);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:34});
  sun.shadow.normalBias=.009;sun.shadow.bias=-.00021;scene.add(hemisphere,sun,sun.target);
  live=liveRendering(renderer,scene,()=>camera);
  street=await streetView();street.visible=false;scene.add(street);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.ShadowMaterial({opacity:.17}));ground.name='Studio ground';ground.rotation.x=-Math.PI/2;ground.position.y=-.35;ground.receiveShadow=true;scene.add(ground);
  canvas.onkeydown=e=>{
    if(!displayed||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;e.preventDefault();
    if(['+','=','-'].includes(e.key)){zoom(e.key==='-'?.85:1.18);return;}
    const sph=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if(e.key==='ArrowLeft')sph.theta-=.11;if(e.key==='ArrowRight')sph.theta+=.11;
    if(e.key==='ArrowUp')sph.phi-=.10;if(e.key==='ArrowDown')sph.phi+=.10;
    sph.phi=THREE.MathUtils.clamp(sph.phi,.001,controls.maxPolarAngle);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));controls.update();
  };
  new ResizeObserver(resize).observe(stage);resize();await selectDesign();
}
main().catch(fail);
