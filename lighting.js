import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const lightingOptions = [
  {id:'cove', label:'Diffuse cove', base:'cove', kelvin:3500},
  {id:'recessed', label:'Recessed downlights', base:'recessed', kelvin:3000},
  {id:'track', label:'Directional track', base:'track', kelvin:3000},
  {id:'pendants', label:'Brass task pendants', base:'recessed', kelvin:3000},
  {id:'wash', label:'Architectural wall wash', base:'cove', kelvin:3700},
  {id:'rail', label:'Window display spots', base:'track', kelvin:3200},
  {id:'showroom', label:'Layered showroom', base:'cove', kelvin:3400},
  {id:'linear', label:'Suspended light bar', base:'cove', kelvin:3900},
  {id:'globes', label:'Opal globe trio', base:'recessed', kelvin:3200},
  {id:'halos', label:'Brushed-brass halo', base:'cove', kelvin:3300},
  {id:'lanterns', label:'Brass lattice lanterns', base:'recessed', kelvin:2800},
  {id:'gallery', label:'Twin gallery picture lights', base:'track', kelvin:3600}
];

const optionById = new Map(lightingOptions.map(option => [option.id,option]));
const getOption = value => typeof value === 'string' ? optionById.get(value) : value;
const clamp = THREE.MathUtils.clamp;
const rad = THREE.MathUtils.degToRad;
const down = new THREE.Vector3(0,-1,0);
const sourceGain={recessed:.034,cove:.036,track:.032,pendants:.015,wash:.017,rail:.019,showroom:.025,linear:.021,globes:.016,halos:.022,lanterns:.014,gallery:.023};
const primaryLayouts=new Set(['recessed','cove','track']);

function lampColour(kelvin,out) {
  const k=clamp(Number(kelvin)||3500,2300,7500)/100;
  const r=k<=66?255:329.698727446*Math.pow(k-60,-.1332047592);
  const g=k<=66?99.4708025861*Math.log(k)-161.1195681661:288.1221695283*Math.pow(k-60,-.0755148492);
  const b=k>=66?255:(k<=19?0:138.5177312231*Math.log(k-10)-305.0447927307);
  return out.setRGB(clamp(r/255,0,1),clamp(g/255,0,1),clamp(b/255,0,1)).convertSRGBToLinear();
}

function shadowedBeam(lamp) {
  lamp.castShadow=true;
  lamp.shadow.mapSize.set(512,512);
  lamp.shadow.camera.near=.065;
  lamp.shadow.camera.far=6;
  lamp.shadow.normalBias=.007;
  lamp.shadow.bias=-.00018;
}

function materials() {
  function metal(color,roughness) {
    return new THREE.MeshStandardMaterial({color,roughness,metalness:.78,side:THREE.DoubleSide});
  }
  function diffuser() {
    return new THREE.MeshStandardMaterial({color:0xdedbcf,roughness:.30,metalness:.04,emissive:0xffddaa,emissiveIntensity:1.25});
  }
  return {brass:metal(0xa97d42,.33),black:metal(0x35352e,.45),lining:metal(0xe1cfab,.32),
    main:diffuser(),display:diffuser(),cash:diffuser()};
}

function part(group,geometry,material,at,rotation) {
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.fromArray(at);
  if(rotation)mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
}
function bar(group,material,at,w,h,d) {
  return part(group,new THREE.BoxGeometry(w,h,d),material,at);
}
function spindle(group,material,r,len,at) {
  return part(group,new THREE.CylinderGeometry(r,r,len,16),material,at);
}
function rod(group,material,a,b,r) {
  const start=new THREE.Vector3().fromArray(a),end=new THREE.Vector3().fromArray(b);
  const axis=end.clone().sub(start);
  const mesh=spindle(group,material,r,axis.length(),start.add(end).multiplyScalar(.5).toArray());
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());
}
function bracket(group,material,x,z) {
  bar(group,material,[(x+2.438)/2,2.333,z],2.46-x,.023,.031);
  bar(group,material,[2.431,2.282,z],.031,.134,.068);
}
function ring(group,material,x,y,z,r,tube) {
  return part(group,new THREE.TorusGeometry(r,tube,8,48),material,[x,y,z],[Math.PI/2,0,0]);
}

// All decorative meshes are stationary within a fixture. One batch per surface
// avoids dozens of calls for small brass fins, cables and opal-glass diffusers.
function batchFixture(group,mats) {
  group.updateMatrixWorld(true);
  const inverse=group.matrixWorld.clone().invert(),matrix=new THREE.Matrix4(),bins=new Map();
  group.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
    geometry.applyMatrix4(matrix.multiplyMatrices(inverse,mesh.matrixWorld));
    if(!bins.has(mesh.material))bins.set(mesh.material,[]);
    bins.get(mesh.material).push(geometry);
    mesh.geometry.dispose();
  });
  group.clear();
  for(const [material,pieces] of bins) {
    const geometry=mergeGeometries(pieces,false);
    for(const piece of pieces)piece.dispose();
    const mesh=new THREE.Mesh(geometry,material);
    mesh.castShadow=material!==mats.main && material!==mats.display && material!==mats.cash;
    mesh.receiveShadow=true;
    group.add(mesh);
  }
  return group;
}
function beam(name,at,to,angle,power,penumbra=.70,distance=5.6) {
  return {name,at:new THREE.Vector3().fromArray(at),to:new THREE.Vector3().fromArray(to),angle:rad(angle),power,penumbra,distance};
}
function head(group,mats,at,to,size,emitter) {
  const pivot=new THREE.Group();
  pivot.position.fromArray(at);
  pivot.quaternion.setFromUnitVectors(down,new THREE.Vector3().fromArray(to).sub(pivot.position).normalize());
  group.add(pivot);
  spindle(pivot,mats.black,size*.44,size*.92,[0,-size*.44,0]);
  spindle(pivot,mats.brass,size*.45,size*.075,[0,-size*.89,0]);
  spindle(pivot,emitter,size*.36,size*.035,[0,-size*.95,0]);
  return pivot.localToWorld(new THREE.Vector3(0,-size*.985,0)).toArray();
}

// Preserve independent dimming for the original shelf and soffit. Their geometry
// shares one imported material, with the hanging-display strips below 1.91 m.
function splitOriginalDiffuser(node) {
  const geometry=node.geometry,pos=geometry.getAttribute('position'),index=geometry.index;
  const count=index?index.count:pos.count;
  const triangles=[[],[]];
  for(let i=0;i<count;i+=3) {
    const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
    const shelf=(pos.getY(a)+pos.getY(b)+pos.getY(c))/3<1.91;
    triangles[Number(shelf)].push(a,b,c);
  }
  const output=[];
  triangles.forEach((indices,circuit)=>{
    if(!indices.length)return;
    const subset=new THREE.BufferGeometry();
    for(const [name,attribute] of Object.entries(geometry.attributes))subset.setAttribute(name,attribute);
    subset.setIndex(indices);
    const material=node.material.clone();
    material.color.setHex(0xe3dccb);
    const lens=new THREE.Mesh(subset,material);
    lens.name=circuit?'Shelf strip diffuser':'Ceiling diffuser';
    lens.position.copy(node.position);lens.quaternion.copy(node.quaternion);lens.scale.copy(node.scale);
    lens.receiveShadow=true;
    node.parent.add(lens);
    output.push({mat:material,shelf:!!circuit});
  });
  node.visible=false;
  return output;
}

function accentFittings(rig,mats) {
  const group=new THREE.Group(),display=[];
  group.name='Showcase and cash-counter accent fittings';
  // Both heads attach to the fixed, street-right half of the front glazing.
  for(const [x,tx] of [[1.69,1.76],[2.19,2.16]]) {
    const target=[tx,.99,-.244],origin=[x,2.158,-.075];
    bar(group,mats.black,[x,2.18,-.061],.046,.048,.071);
    const lamp=head(group,mats,origin,target,.077,mats.display);
    display.push(beam('Showcase accent',lamp,target,30,2.7,.74,3.6));
  }
  const target=[1.83,1.125,-1.27],origin=[2.407,2.235,-1.28];
  bar(group,mats.brass,[2.428,2.265,-1.28],.043,.078,.069);
  const outlet=head(group,mats,origin,target,.086,mats.cash);
  const cash=beam('Cash desk task light',outlet,target,34,3.3,.70,4.2);
  rig.add(batchFixture(group,mats));
  return {display,cash};
}

function supplement(rig,id,m) {
  const group=new THREE.Group(),beams=[];
  group.name='Lighting scheme '+id;
  function at(name,position,target,angle,power,penumbra=.75) {beams.push(beam(name,position,target,angle,power,penumbra));}
  function pendant(z) {
    const x=1.605;
    bracket(group,m.brass,x,z);
    spindle(group,m.black,.006,.205,[x,2.22,z]);
    spindle(group,m.brass,.022,.045,[x,2.099,z]);
    const profile=[[.024,.075],[.042,.065],[.062,.047],[.094,.015],[.130,-.022],[.139,-.030]];
    part(group,new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),32),m.brass,[x,2.013,z]);
    part(group,new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r*.96,y-.007)),32),m.lining,[x,2.013,z]);
    spindle(group,m.main,.096,.008,[x,1.995,z]);
    at('Brass counter pendant',[x,1.976,z],[x,.87,z],41,4.65);
  }
  function globe(x,y,z,r) {
    bracket(group,m.brass,x,z);
    const stemBottom=y+r+.028;
    spindle(group,m.black,.005,2.32-stemBottom,[x,(2.32+stemBottom)*.5,z]);
    spindle(group,m.brass,r*.40,.041,[x,stemBottom-.015,z]);
    part(group,new THREE.SphereGeometry(r,24,16),m.main,[x,y,z]);
    at('Opal globe',[x,y-r-.015,z],[1.55,.87,z],54,3.7,.91);
  }
  if(id==='pendants') {pendant(-2.14);pendant(-2.96);}
  if(id==='wash') {
    bar(group,m.brass,[2.398,2.194,-2.61],.069,.045,1.54);
    bar(group,m.main,[2.369,2.168,-2.61],.018,.011,1.49);
    for(const z of [-2.20,-3.01])at('Partition wall washer',[2.354,2.158,z],[2.43,.55,z-.08],39,2.15,.9);
    const p=[.265,2.668,-3.42],t=[.70,1.85,-4.47];
    at('Arched doorway spot',head(group,m,p,t,.081,m.main),t,28,3.7);
  }
  if(id==='rail'||id==='showroom') {
    // The two permanent showcase heads have their own dimmer. A continuous
    // rail connects their mounting plates in these two layouts.
    bar(group,m.black,[1.95,2.202,-.065],.86,.018,.040);
  }
  if(id==='showroom')globe(1.63,2.08,-2.53,.084);
  if(id==='linear') {
    const x=1.55,z=-2.54;
    for(const offset of [-.48,.48]) {
      bracket(group,m.black,x,z+offset);
      spindle(group,m.black,.0045,.193,[x,2.223,z+offset]);
    }
    bar(group,m.black,[x,2.102,z],.073,.055,1.28);
    bar(group,m.main,[x,2.072,z],.058,.007,1.25);
    for(const dz of [-.36,.36])at('Suspended linear diffuser',[x,2.062,z+dz],[x,.85,z+dz],53,4.1,.93);
  }
  if(id==='globes') {
    globe(1.48,2.061,-2.06,.080);globe(1.64,2.105,-2.54,.100);globe(1.49,2.070,-3.02,.076);
  }
  if(id==='halos') {
    const x=1.53,y=2.091,z=-2.59,r=.26;
    bracket(group,m.brass,x,z);
    spindle(group,m.brass,.046,.026,[x,2.309,z]);
    for(let i=0;i<3;i++) {
      const a=i*2*Math.PI/3;
      rod(group,m.black,[x,2.303,z],[x+r*Math.cos(a),y+.011,z+r*Math.sin(a)],.0035);
    }
    ring(group,m.brass,x,y,z,r,.019);
    ring(group,m.main,x,y-.015,z,r,.0105);
    for(const dz of [-.16,.16])at('Halo pendant',[x,y-.032,z+dz],[x,.83,z+dz],49,3.8,.89);
  }
  if(id==='lanterns') {
    for(const z of [-2.11,-2.96]) {
      const x=1.55,y=2.079,r=.084;
      bracket(group,m.brass,x,z);
      spindle(group,m.black,.005,.139,[x,2.251,z]);
      spindle(group,m.brass,.058,.026,[x,y+.096,z]);
      spindle(group,m.main,.050,.158,[x,y,z]);
      for(const off of [-.082,.082])ring(group,m.brass,x,y+off,z,r,.006);
      for(let i=0;i<12;i++) {
        const a=i*Math.PI/6,b=a+.18;
        rod(group,m.brass,[x+r*Math.cos(a),y-.080,z+r*Math.sin(a)],
          [x+r*Math.cos(b),y+.080,z+r*Math.sin(b)],.0045);
      }
      at('Brass lantern',[x,y-.10,z],[x,.83,z],44,4.15,.80);
    }
  }
  if(id==='gallery') {
    for(const z of [-1.70,-2.84]) {
      const x=.27,y=2.42;
      // A drop rod fixes the pivot to the underside of the existing left soffit.
      // It stays visibly supported in both the open cutaway and the enclosed shop.
      bar(group,m.brass,[.194,2.675,z],.075,.022,.091);
      rod(group,m.brass,[.194,2.666,z],[.194,y+.078,z],.009);
      rod(group,m.brass,[.194,y+.078,z],[x,y,z],.012);
      const lens=part(group,new THREE.CylinderGeometry(.030,.030,.45,16),m.black,[x,y,z],[Math.PI/2,0,0]);
      lens.rotateZ(.25);
      bar(group,m.main,[x-.007,y-.026,z],.036,.009,.420);
      at('Gallery picture light',[x-.008,y-.035,z],[.36,.97,z],31,6.4,.77);
    }
  }
  batchFixture(group,m);
  group.visible=false;rig.add(group);
  return {group,beams};
}

function slot(rig,name,shadow=false) {
  const light=new THREE.SpotLight(0xffffff,0,5.6,rad(40),.70,2);
  light.name=name;
  light.target.position.set(0,0,-1);
  rig.add(light,light.target);
  if(shadow)shadowedBeam(light);
  return light;
}
function sourceBeam(rig,lamp,base,shelf) {
  const at=rig.worldToLocal(lamp.getWorldPosition(new THREE.Vector3()));
  const to=rig.worldToLocal(lamp.target.getWorldPosition(new THREE.Vector3()));
  const penumbra=shelf?.91:base==='cove'?.96:base==='track'?.51:.75;
  return {name:lamp.name,at,to,angle:lamp.angle,power:lamp.intensity,penumbra,distance:lamp.distance||5.6};
}
function pointSlot(light,template,spread=1) {
  if(!template){light.intensity=0;return;}
  light.position.copy(template.at);
  light.target.position.copy(template.to);
  light.distance=template.distance;
  light.angle=clamp(template.angle*spread,rad(12),rad(77));
  light.penumbra=template.penumbra;
  if(light.castShadow)light.shadow.needsUpdate=true;
}
function powerSlot(light,template,intensity,colour) {
  light.intensity=(template?.power||0)*intensity;
  light.color.copy(colour);
}

// The number of active Three.js lights is deliberately constant. Changing light
// types or counts would recompile every wood, glass and textile shader and every
// planar reflection. Unused sockets keep zero intensity in the same shader.
export function prepareLighting(asset,initialMode) {
  const option=getOption(initialMode);
  if(!option)throw new Error('Unknown lighting plan');
  const rig=asset.scene;
  rig.updateWorldMatrix(true,true);
  const sources=[],strips=[],split=[],diffusers=[],extras=new Map(),m=materials();
  rig.traverse(node=>{
    if(node.isSpotLight) {
      const shelf=/concealed.shelf/i.test(node.name);
      (shelf?strips:sources).push(sourceBeam(rig,node,option.base,shelf));
      node.visible=false;
    }
    if(node.isMesh&&node.material?.name?.includes('luminous diffuser'))split.push(node);
  });
  for(const mesh of split)diffusers.push(...splitOriginalDiffuser(mesh));
  const accent=accentFittings(rig,m);
  const main=Array.from({length:4},(_,index)=>slot(rig,'Ceiling beam '+(index+1),index===0));
  const shelf=strips.map((_,index)=>slot(rig,'Shelf strip '+(index+1)));
  const displays=accent.display.map((_,index)=>slot(rig,'Showcase accent '+(index+1)));
  const cash=slot(rig,'Cash desk task light');
  const street=slot(rig,'Soft street daylight');
  const daylight=beam('Soft street daylight',[1.32,2.12,.97],[1.08,.85,-2.55],61,6.5,.95,7.2);
  street.color.setHex(0xeaf3ff);pointSlot(street,daylight);
  strips.forEach((definition,i)=>pointSlot(shelf[i],definition));
  let active,extra,assignments=[],lastSpread,lastSignature;
  const warm=new THREE.Color(),warmShelf=new THREE.Color();
  return (state,override=option)=>{
    const plan=getOption(override);
    if(!plan||plan.base!==option.base)throw new Error('Incompatible lighting base');
    const temperature=state.kelvin??plan.kelvin;
    const strength=clamp(Number(state.intensity??100),0,150)/100;
    const shelfLevel=clamp(Number(state.shelf??75),0,100)/100;
    const daylightLevel=clamp(Number(state.daylight??50),0,100)/100;
    const displayLevel=clamp(Number(state.displayLight??75),0,150)/100;
    const cashLevel=clamp(Number(state.cashLight??75),0,150)/100;
    const spread=clamp(Number(state.beamSpread??100),60,140)/100;
    const signature=[plan.id,temperature,strength,shelfLevel,daylightLevel,displayLevel,cashLevel,spread].join('|');
    if(signature===lastSignature)return;
    lastSignature=signature;
    const changed=active!==plan.id;
    if(changed) {
      if(extra)extra.group.visible=false;
      if(!primaryLayouts.has(plan.id)&&!extras.has(plan.id))extras.set(plan.id,supplement(rig,plan.id,m));
      extra=extras.get(plan.id);
      if(extra)extra.group.visible=true;
      const featured=extra?.beams||[];
      // Retain the most evenly spaced original emitters in the remaining sockets.
      const count=Math.min(sources.length,main.length-featured.length);
      const kept=Array.from({length:count},(_,i)=>sources[count===1?Math.floor((sources.length-1)/2):Math.round(i*(sources.length-1)/(count-1))]);
      assignments=[...featured.map(definition=>({definition,gain:1})),...kept.map(definition=>({definition,gain:sourceGain[plan.id]}))];
      active=plan.id;
    }
    if(changed||lastSpread!==spread) {
      main.forEach((light,i)=>pointSlot(light,assignments[i]?.definition,spread));
      displays.forEach((light,i)=>pointSlot(light,accent.display[i],spread));
      pointSlot(cash,accent.cash,spread);
      lastSpread=spread;
    }
    lampColour(temperature,warm);lampColour(temperature-160,warmShelf);
    street.intensity=daylight.power*daylightLevel;
    main.forEach((light,i)=>powerSlot(light,assignments[i]?.definition,(assignments[i]?.gain??0)*strength,warm));
    shelf.forEach((light,i)=>powerSlot(light,strips[i],.045*shelfLevel,warmShelf));
    const windowGain=(plan.id==='rail'?1.6:plan.id==='showroom'?1.32:1)*displayLevel*strength;
    displays.forEach((light,i)=>powerSlot(light,accent.display[i],windowGain,warm));
    powerSlot(cash,accent.cash,cashLevel*strength,warm);
    for(const {mat,shelf} of diffusers) {
      mat.emissive.copy(shelf?warmShelf:warm);
      mat.emissiveIntensity=shelf?1.5*shelfLevel:(primaryLayouts.has(plan.id)?1.26:.63)*strength;
    }
    m.main.emissive.copy(warm);m.main.emissiveIntensity=1.45*strength;
    m.display.emissive.copy(warm);m.display.emissiveIntensity=1.30*windowGain;
    m.cash.emissive.copy(warm);m.cash.emissiveIntensity=1.30*cashLevel*strength;
  };
}

export function updateEnvironment(scene,renderer,hemisphere,sun,settings,mode) {
  const option=getOption(mode);
  const sunFraction=clamp(Number(settings.daylight??50),0,100)/100;
  const local=clamp(Number(settings.intensity??100),0,150)/100;
  const concentrated=['track','rail','gallery','lanterns'].includes(option?.id);
  const ambientBias=concentrated?.82:1;
  hemisphere.color.setHex(0xe9f1f8);
  hemisphere.groundColor.setHex(0xc8b9a6);
  hemisphere.intensity=(.14+.52*sunFraction)*ambientBias;
  sun.color.setHex(0xfff2db);
  sun.intensity=.06+1.12*sunFraction;
  scene.environmentIntensity=.16+.40*sunFraction+.055*local;
  renderer.toneMappingExposure=.98;
}
