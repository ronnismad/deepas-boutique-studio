import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { installMirrors } from './mirrors.js';
import { enhanceModel, applyDisplay } from './realism.js';
import { createFinishes, finishOptions } from './finishes.js';
import { prepareLighting, updateEnvironment, lightingOptions } from './lighting.js';
import { makeEnclosure } from './enclosure.js';
import { createTrace } from './trace.js';
import { liveRendering, streetView, finishTransom, studioContact } from './surfaces.js';
import { $, initUI, defaults, validState, toast } from './ui.js';

const stage = $('stage'), canvas = $('view'), status = $('status');
const rigs = new Map();
let roomPromise, activeRig;
const overhead = new THREE.OrthographicCamera(-5,5,5,-5,.04,90);
const eye = new THREE.PerspectiveCamera(57,1,.035,90);
const scene = new THREE.Scene();
let renderer, controls, hemisphere, sun, packed, ui, tracer, live, street, contactShadow;
let entranceOpen=false;
let state = {...defaults}, displayed, camera = overhead, view = 'cutaway', quality = 'live';
let revision=0, framePending=false, cameraLocked=false, everFramed=false;
let redrawTimer=0, editFrame=0, previewRequested=false, performanceMode='auto', lastWidth=0, lastHeight=0, lastRatio=0;
overhead.layers.enable(1);eye.layers.enable(1);

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
function requestDraw(interacting=false) {
  if(!renderer||quality!=='live')return;
  clearTimeout(redrawTimer);
  previewRequested=performanceMode==='fast'||(performanceMode==='auto'&&interacting);
  if(!framePending){
    framePending=true;
    requestAnimationFrame(()=>{framePending=false;if(quality==='live')live.draw(!previewRequested);});
  }
  if(interacting&&performanceMode==='auto'){
    redrawTimer=setTimeout(()=>requestDraw(false),220);
  }
}
function performanceSetting(mode){
  if(!['auto','fast','fine'].includes(mode)||mode===performanceMode)return;
  performanceMode=mode;canvas.dataset.performance=mode;
  displayed?.mirrors.size(mirrorSize());
  resize();requestDraw();
}
function mirrorSize(){return performanceMode==='fine'?768:performanceMode==='fast'?256:512;}
function refreshReflections(){displayed?.mirrors.invalidate();}
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
      m.forceSinglePass=true;
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
function fixtureNode(def){
  return !!def.extensions?.KHR_lights_punctual || /retained soffit/i.test(def.name||'');
}
function buildRig(asset,base){
  const group=new THREE.Group();group.name=base+' lighting';
  const {parser}=asset;
  for(const child of [...asset.scene.children]){
    const index=parser.associations.get(child)?.nodes;
    if(index!==undefined&&fixtureNode(parser.json.nodes[index]))group.add(child);
  }
  group.traverse(node=>{if(node.isMesh){node.castShadow=!node.material.transparent;node.receiveShadow=!node.material.transparent;}});
  return {group,apply:prepareLighting({scene:group},base)};
}
function loadRig(base){
  if(!rigs.has(base)){
    // Other base files describe the same shop. Ask the glTF loader for just
    // their fixture meshes and lights, keeping the measured shell loaded once.
    const loader=new GLTFLoader();
    loader.register(parser=>({name:'StudioFixtureSubset',beforeRoot(){
      const doc=parser.json;
      for(const scene of doc.scenes)scene.nodes=scene.nodes.filter(i=>fixtureNode(doc.nodes[i]));
    }}));
    const promise=loader.parseAsync(loadPackedModel(base),'').then(asset=>buildRig(asset,base)).catch(e=>{rigs.delete(base);throw e;});
    rigs.set(base,promise);
  }
  return rigs.get(base);
}
function surveyFraming(object){
  const vertices=[],v=new THREE.Vector3();
  for(const group of object.children){
    if(!/room.shell|frontage.steps|existing.pillar|rear.arched|stair.and.sliding|right.partition/i.test(group.name))continue;
    group.traverseVisible(node=>{
      const pos=node.geometry?.attributes.position;if(!pos)return;
      for(let j=0;j<pos.count;j++)vertices.push(v.fromBufferAttribute(pos,j).applyMatrix4(node.matrixWorld).clone());
    });
  }
  return {vertices,centre:new THREE.Box3().setFromPoints(vertices).getCenter(new THREE.Vector3()),views:new Map()};
}
function hideBuriedSlabEdge(asset){
  // The cut edge of the +1.350 m mezzanine and the face of the painted
  // partition share a plane. The finish covers this internal concrete face.
  const shell=asset.scene.children.find(o=>/room.shell.and.flooring/i.test(o.name));
  shell?.traverse(node=>{
    if(!node.isMesh || node.material.name.toLowerCase()!=='#b4aba0')return;
    const g=node.geometry,pos=g.attributes.position,norm=g.attributes.normal,ix=g.index;
    const visible=[],count=ix?ix.count:pos.count;
    for(let i=0;i<count;i+=3){
      const a=ix?ix.getX(i):i,b=ix?ix.getX(i+1):i+1,c=ix?ix.getX(i+2):i+2;
      if(norm.getX(a)<-.99 && Math.abs(pos.getX(a)-2.45)<.0001 &&
         Math.min(pos.getY(a),pos.getY(b),pos.getY(c))>1.17)continue;
      visible.push(a,b,c);
    }
    if(visible.length!==count)g.setIndex(visible);
  });
}
async function prepareRoom(){
  const asset=await new GLTFLoader().parseAsync(loadPackedModel('cove'),'');
  asset.scene.updateMatrixWorld(true);
  const initialRig=buildRig(asset,'cove');rigs.set('cove',Promise.resolve(initialRig));
  hideBuriedSlabEdge(asset);
  const framing=surveyFraming(asset.scene);
  enhanceModel(asset);
  asset.scene.traverse(o=>{if(o.isMesh){o.castShadow=!o.material.transparent;o.receiveShadow=!o.material.transparent;}});
  const finishes=await createFinishes(asset);
  tuneGlass(asset);
  const mirrors=installMirrors(asset.scene);mirrors.size(mirrorSize());
  const enclosure=makeEnclosure(asset);
  if(!enclosure.group.parent)asset.scene.add(enclosure.group);
  enclosure.group.visible=false;
  const leaf=asset.scene.children.find(o=>/closed.left.glass.leaf/i.test(o.name));
  return {asset,finishes,mirrors,enclosure,framing,leaf,closedX:leaf?.position.x??0,lastFinishes:''};
}
function preloadRigs(){
  const warm=()=>Promise.allSettled(['track','recessed'].map(loadRig));
  if(window.requestIdleCallback)window.requestIdleCallback(warm,{timeout:1400});else setTimeout(warm,350);
}
const eyeViews={
  mezzanine:{position:[1.41,1.91,-3.91],target:[3.43,2.09,-3.81],fov:69},
  showcase:{position:[1.96,1.28,1.37],target:[1.96,1.07,-.20],fov:62},
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
  entranceOpen=!entranceOpen;moveDoor(displayed);refreshReflections();renderer.shadowMap.needsUpdate=true;tracer?.invalidate(true);requestDraw(true);
}
function applyDesign(model,rig){
  const key=[state.floor,state.wood,state.top,state.metal,state.wall,state.customWall,state.customCompanion].join('|');
  if(model.lastFinishes!==key){
    model.finishes(state);model.lastFinishes=key;
  }
  const scheme=finishOptions.walls.find(w=>w.id===state.wall);
  model.enclosure.update({accent:scheme?.accent||state.customWall,companion:scheme?.companion||state.customCompanion,daylight:state.daylight});
  street.userData.surface.color.setRGB(.15+.77*state.daylight/100,.20+.75*state.daylight/100,.26+.72*state.daylight/100);
  rig.apply(state,state.light);applyDisplay(state);
  const shadowKey=[state.light,state.beamSpread].join('|');
  if(shadowKey!==model.lastShadow){renderer.shadowMap.needsUpdate=true;model.lastShadow=shadowKey;}
  moveDoor(model);
  model.enclosure.group.visible=isEye();
  updateEnvironment(scene,renderer,hemisphere,sun,state,state.light);
}
async function selectDesign(){
  const token=++revision;
  if(!roomPromise)roomPromise=prepareRoom().catch(e=>{roomPromise=null;throw e;});
  const model=await roomPromise;
  if(token!==revision)return;
  const mode=lightingOptions.find(m=>m.id===state.light);
  if(activeRig?.base!==mode.base)ui.busy?.(true);
  const rig=await loadRig(mode.base);
  if(token!==revision)return;
  if(displayed!==model){scene.add(model.asset.scene);displayed=model;}
  if(activeRig!==rig){
    if(activeRig)scene.remove(activeRig.group);
    activeRig=rig;rig.base=mode.base;scene.add(rig.group);
    renderer.shadowMap.needsUpdate=true;
  }
  applyDesign(model,rig);refreshReflections();
  if(!everFramed){everFramed=true;setView(view);preloadRigs();}
  status.hidden=true;ui.busy?.(false);
  canvas.dataset.scheme=[state.light,state.floor,state.wall,state.wood].join('|');
  canvas.dataset.settings=JSON.stringify(state);
  tracer?.invalidate(true);requestDraw(true);
}
function change(partial) {
  const next=validState({...state,...partial});
  if(Object.keys(next).every(k=>next[k]===state[k])&&canvas.dataset.settings===JSON.stringify(state))return;
  state=next;revision++;ui.sync(state);
  if(editFrame)return;
  editFrame=requestAnimationFrame(()=>{
    editFrame=0;selectDesign().catch(fail);
  });
}
function zoom(factor){
  if(!displayed)return;
  camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,.5,6);camera.updateProjectionMatrix();
  refreshReflections();tracer?.invalidate(false);requestDraw(true);
}
function fitCutaway(){
  const {vertices,centre,views}=displayed.framing;
  let frame=views.get(view);
  if(!frame){
    const dir=view==='plan'?new THREE.Vector3(0,1,.00005):view==='rear'?new THREE.Vector3(-.48,1.1,-.86):new THREE.Vector3(.32,1.12,.87);
    overhead.up.set(0,1,0);overhead.position.copy(centre).addScaledVector(dir.normalize(),17);
    overhead.lookAt(centre);overhead.updateMatrixWorld();
    const v=new THREE.Vector3();
    let loX=Infinity,hiX=-Infinity,loY=Infinity,hiY=-Infinity;
    for(const p of vertices){
      v.copy(p).applyMatrix4(overhead.matrixWorldInverse);
      loX=Math.min(loX,v.x);hiX=Math.max(hiX,v.x);loY=Math.min(loY,v.y);hiY=Math.max(hiY,v.y);
    }
    const offset=v.set((hiX+loX)*.5,(hiY+loY)*.5,0).applyQuaternion(overhead.quaternion);
    frame={target:centre.clone().add(offset),position:overhead.position.clone().add(offset),halfHeight:(hiY-loY)*.5,halfWidth:(hiX-loX)*.5};
    views.set(view,frame);
  }
  controls.target.copy(frame.target);overhead.position.copy(frame.position);
  overhead.userData.halfHeight=frame.halfHeight;overhead.userData.halfWidth=frame.halfWidth;
}
function setView(next){
  view=next;ui.selectView(view);
  if(!displayed)return;
  cameraLocked=true;
  const interior=isEye(),wasEye=camera===eye;
  camera=interior?eye:overhead;controls.object=camera;
  displayed.enclosure.group.visible=interior;street.visible=interior;contactShadow.visible=!interior;
  $('door').hidden=!interior||!displayed.leaf;
  camera.zoom=1;camera.up.set(0,1,0);
  controls.enablePan=!interior;
  const outside=view==='front'||view==='showcase';
  controls.minAzimuthAngle=outside?-Math.PI*.38:-Infinity;
  controls.maxAzimuthAngle=outside?Math.PI*.38:Infinity;
  if(interior){
    eye.position.fromArray(eyeViews[view].position);controls.target.fromArray(eyeViews[view].target);
    controls.maxPolarAngle=Math.PI*.87;
  }else{fitCutaway();controls.maxPolarAngle=Math.PI*.493;}
  camera.lookAt(controls.target);controls.update();cameraLocked=false;
  if(wasEye!==interior)renderer.shadowMap.needsUpdate=true;
  refreshReflections();resize();canvas.dataset.camera=view;
  tracer?.invalidate(wasEye!==interior);requestDraw(true);
}
function constrainEye(){
  if(camera!==eye)return;
  const outside=view==='front'||view==='showcase';
  const p=eye.position, clamp=THREE.MathUtils.clamp;
  // Keep orbital eye-level views on their own side of the shell and above
  // the floor. The cutaway still permits full rotation and panning.
  p.x=clamp(p.x,outside?-.80:.06,outside?3.25:view==='mezzanine'?5.06:2.39);
  p.y=clamp(p.y,view==='mezzanine'&&p.x>2.45?1.48:.30,3.25);
  p.z=clamp(p.z,outside?.30:-4.42,outside?4.35:-.055);
  eye.lookAt(controls.target);eye.updateMatrixWorld();
}
function resize(){
  if(!renderer)return;
  const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight),aspect=w/h;
  const scale=performanceMode==='fast'?.80:performanceMode==='fine'?Math.min(1.8,devicePixelRatio||1):Math.min(1.35,devicePixelRatio||1);
  const changed=w!==lastWidth||h!==lastHeight||lastRatio!==scale;
  if(changed){
    if(scale!==lastRatio)renderer.setPixelRatio(scale);
    renderer.setSize(w,h,false);live?.resize(w,h);
    lastWidth=w;lastHeight=h;lastRatio=scale;
    refreshReflections();
  }
  eye.aspect=aspect;eye.fov=eyeViews[view]?.fov??57;
  if(aspect<.9)eye.fov+=Math.min(19,(.9-aspect)*50);
  eye.updateProjectionMatrix();
  if(overhead.userData.halfHeight){
    const marginX=w>560?1.07:1.11,marginY=h>410?1.19:1.28;
    const half=Math.max(overhead.userData.halfHeight*marginY,overhead.userData.halfWidth/aspect*marginX);
    overhead.top=half;overhead.bottom=-half;overhead.right=half*aspect;overhead.left=-overhead.right;
  }
  overhead.updateProjectionMatrix();if(changed)tracer?.resize();requestDraw();
}
async function exportPNG(){
  if(!displayed){toast('The shop is still opening');return;}
  if(editFrame){cancelAnimationFrame(editFrame);editFrame=0;}
  if(canvas.dataset.settings!==JSON.stringify(state))await selectDesign();
  if(quality==='live')live.draw(performanceMode!=='fast');
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
  console.error(e);ui.busy?.(false);
  status.hidden=false;status.className='fail';
  if(displayed){status.textContent='This design could not be displayed. Choose another finish or lighting layout.';return;}
  $('fallback').src='data:image/jpeg;base64,'+$('poster').textContent.trim();$('fallback').hidden=false;
  status.textContent='Interactive 3D needs graphics acceleration. Open this file in a browser with graphics acceleration enabled.';
  document.querySelectorAll('button,input,select').forEach(b=>b.disabled=true);
}
async function main(){
  ui=initUI({current:()=>state,change,camera:setView,zoom,reset:()=>setView(view),exportPNG,quality:setQuality,performance:performanceSetting});
  ui.sync(state);ui.selectView(view);canvas.dataset.quality='live';$('door').onclick=toggleDoor;
  packed=JSON.parse($('modelData').textContent);
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  canvas.dataset.performance=performanceMode;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  // The display transform brings this studio charcoal to the interface's #151a19.
  scene.background=new THREE.Color(0x272c2b);
  scene.environment=daylightEnvironment();
  controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minZoom=.5;controls.maxZoom=6;
  controls.minDistance=.4;controls.maxDistance=25;controls.rotateSpeed=.72;
  controls.addEventListener('change',()=>{if(!cameraLocked){constrainEye();refreshReflections();tracer?.invalidate(false);requestDraw(true);}});
  hemisphere=new THREE.HemisphereLight(0xf3f5ef,0xcdbda6,1);
  sun=new THREE.DirectionalLight(0xfff2db,1);sun.position.set(-3.4,10.8,3.3);sun.target.position.set(2,.3,-3);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:34});
  sun.shadow.normalBias=.009;sun.shadow.bias=-.00021;scene.add(hemisphere,sun,sun.target);
  live=liveRendering(renderer,scene,()=>camera);
  street=await streetView();street.visible=false;scene.add(street);
  contactShadow=studioContact();scene.add(contactShadow);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.ShadowMaterial({opacity:.17}));ground.name='Studio ground';ground.layers.set(3);ground.rotation.x=-Math.PI/2;ground.position.y=-.35;ground.receiveShadow=true;scene.add(ground);
  canvas.onkeydown=e=>{
    if(!displayed||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;e.preventDefault();
    if(['+','=','-'].includes(e.key)){zoom(e.key==='-'?.85:1.18);return;}
    const sph=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if(e.key==='ArrowLeft')sph.theta-=.11;if(e.key==='ArrowRight')sph.theta+=.11;
    if(e.key==='ArrowUp')sph.phi-=.10;if(e.key==='ArrowDown')sph.phi+=.10;
    sph.phi=THREE.MathUtils.clamp(sph.phi,.001,controls.maxPolarAngle);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));controls.update();
  };
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();clearTimeout(redrawTimer);
    status.hidden=false;status.textContent='Restoring the 3D view…';
  });
  canvas.addEventListener('webglcontextrestored',()=>{
    if(tracer){tracer.dispose();tracer=null;}
    quality='live';ui.quality('live');canvas.dataset.quality='live';
    renderer.shadowMap.needsUpdate=true;refreshReflections();
    status.hidden=!!displayed;requestDraw();
  });
  new ResizeObserver(resize).observe(stage);resize();await selectDesign();
}
main().catch(fail);
