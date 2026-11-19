import * as THREE from 'three';

// The first three schemes retain the measured model's existing fittings. The other
// schemes retain their base hardware and add fittings exactly where their light lands.
export const lightingOptions = [
  {id:'cove', label:'Diffuse cove', base:'cove', kelvin:3500},
  {id:'recessed', label:'Recessed downlights', base:'recessed', kelvin:3000},
  {id:'track', label:'Directional track', base:'track', kelvin:3000},
  {id:'pendants', label:'Brass task pendants', base:'recessed', kelvin:3000},
  {id:'wash', label:'Architectural wall wash', base:'cove', kelvin:3700},
  {id:'rail', label:'Window display spots', base:'track', kelvin:3200},
  {id:'showroom', label:'Layered showroom', base:'cove', kelvin:3400}
];

const optionById = new Map(lightingOptions.map(option => [option.id,option]));
const getOption = value => typeof value === 'string' ? optionById.get(value) : value;
const clamp = THREE.MathUtils.clamp;
const rad = THREE.MathUtils.degToRad;
const down = new THREE.Vector3(0,-1,0);

function lampColour(kelvin) {
  const k=clamp(Number(kelvin) || 3500,2300,7500)/100;
  const red=k<=66?255:329.698727446*Math.pow(k-60,-.1332047592);
  const green=k<=66?99.4708025861*Math.log(k)-161.1195681661:288.1221695283*Math.pow(k-60,-.0755148492);
  const blue=k>=66?255:(k<=19?0:138.5177312231*Math.log(k-10)-305.0447927307);
  return new THREE.Color(clamp(red/255,0,1),clamp(green/255,0,1),clamp(blue/255,0,1)).convertSRGBToLinear();
}

function shadowedBeam(lamp) {
  lamp.castShadow=true;
  lamp.shadow.mapSize.set(512,512);
  lamp.shadow.camera.near=.065;
  lamp.shadow.camera.far=5.8;
  lamp.shadow.normalBias=.009;
  lamp.shadow.bias=-.0002;
  lamp.shadow.radius=1.6;
}

function glassEmitter() {
  return new THREE.MeshStandardMaterial({color:0xe3ded0, roughness:.28,metalness:.04,emissive:0xffddaa,emissiveIntensity:1.25});
}

function mountedPart(group,geometry,material,position,rotation) {
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow=!material.emissiveIntensity || material.emissive?.getHex()===0;
  mesh.receiveShadow=true;
  group.add(mesh);
  return mesh;
}

function bar(group,material,at,w,h,d) {
  return mountedPart(group,new THREE.BoxGeometry(w,h,d),material,at);
}

function spindle(group,material,r,len,at) {
  return mountedPart(group,new THREE.CylinderGeometry(r,r,len,16),material,at);
}

function spot(group,name,position,target,candela,angle,penumbra) {
  const point=new THREE.SpotLight(0xffffff,candela,5.6,rad(angle),penumbra,2);
  point.name=name;
  point.position.fromArray(position);
  point.target.position.fromArray(target);
  group.add(point,point.target);
  return point;
}

// Preserve the inward-facing shelf's strip as a separate dimming circuit. In each
// model the upper shelf and underside strips share one glTF material with the ceiling.
function splitOriginalDiffuser(node) {
  const geo=node.geometry, pos=geo.getAttribute('position'), ix=geo.index;
  const count=ix?ix.count:pos.count;
  const main=[], shelf=[];
  for(let i=0;i<count;i+=3) {
    const a=ix?ix.getX(i):i,b=ix?ix.getX(i+1):i+1,c=ix?ix.getX(i+2):i+2;
    const target=((pos.getY(a)+pos.getY(b)+pos.getY(c))/3<1.91) ? shelf : main;
    target.push(a,b,c);
  }
  const results=[];
  for(const [indices,isShelf] of [[main,false],[shelf,true]]) {
    if(!indices.length) continue;
    const sub=new THREE.BufferGeometry();
    for(const [name,attr] of Object.entries(geo.attributes)) sub.setAttribute(name,attr);
    sub.setIndex(indices);
    const mat=node.material.clone();
    mat.color.setHex(0xe3dccb);
    const lens=new THREE.Mesh(sub,mat);
    lens.name=isShelf?'Shelf strip diffuser':'Ceiling diffuser';
    lens.position.copy(node.position);lens.quaternion.copy(node.quaternion);lens.scale.copy(node.scale);
    node.parent.add(lens);
    results.push({mat,isShelf});
  }
  node.visible=false;
  return results;
}

function accessory(scene,modeId) {
  const group=new THREE.Group();
  group.name='Lighting scheme '+modeId;
  const brass=new THREE.MeshStandardMaterial({color:0xa97d42,roughness:.30,metalness:.83});
  const black=new THREE.MeshStandardMaterial({color:0x3c3932,metalness:.69,roughness:.43});
  const lining=new THREE.MeshStandardMaterial({color:0xe8d6ac,metalness:.42,roughness:.36,side:THREE.DoubleSide});
  const luminous=glassEmitter();
  const imported=[];
  const aimAt=(p,t,angle,candela,name,penumbra=.63) => {
    const lamp=spot(group,name,p,t,candela,angle,penumbra);
    imported.push({lamp,power:candela});
  };
  const bodyPoint=new THREE.Vector3(),targetPoint=new THREE.Vector3();
  function spotHead(p,t,size,name) {
    const pivot=new THREE.Group();
    pivot.position.fromArray(p);
    pivot.quaternion.setFromUnitVectors(down,targetPoint.fromArray(t).sub(bodyPoint.fromArray(p)).normalize());
    group.add(pivot);
    spindle(pivot,black,size*.44,size*.92,[0,-size*.44,0]);
    spindle(pivot,brass,size*.45,size*.075,[0,-size*.89,0]);
    spindle(pivot,luminous,size*.36,size*.035,[0,-size*.934,0]);
    return pivot.localToWorld(new THREE.Vector3(0,-size*.96,0)).toArray();
  }
  function pendant(z) {
    // A narrow retained ceiling plate on a transverse suspension bracket anchors
    // each real cable to the partition at its far end; neither fitting blocks the aisle.
    const x=1.605, anchor=2.44;
    bar(group,brass,[(x+anchor)/2,2.335,z],anchor-x+.04,.026,.027);
    bar(group,brass,[anchor,2.28,z],.031,.15,.06);
    spindle(group,black,.006,.205,[x,2.22,z]);
    spindle(group,brass,.022,.045,[x,2.099,z]);
    const profile=[[.024,.075],[.042,.065],[.062,.047],[.094,.015],[.130,-.022],[.139,-.030]];
    const section=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),40);
    const exterior=mountedPart(group,section,brass,[x,2.013,z]);
    exterior.material=brass;exterior.material.side=THREE.DoubleSide;
    const inner=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r*.97,y-.003)),40);
    mountedPart(group,inner,lining,[x,2.013,z]);
    spindle(group,luminous,.097,.008,[x,1.995,z]);
    aimAt([x,1.978,z],[x,.87,z],41,4.65,'Brass counter pendant',.66);
  }
  if(modeId==='pendants') {pendant(-2.14);pendant(-2.96);}
  if(modeId==='wash') {
    // Concealed, asymmetric wallwasher in a shallow ledge immediately above the
    // right mirror. The illuminated patch is confined to the sales-floor side.
    bar(group,brass,[2.398,2.194,-2.61],.069,.045,1.54);
    bar(group,luminous,[2.370,2.171,-2.61],.018,.011,1.49);
    for(const z of [-2.2,-3.01]) {
      aimAt([2.356,2.158,z],[2.43,.55,z-.08],39,2.15,'Partition wall washer',.9);
    }
    // Two small gallery heads on the far end of the original left ceiling return
    // illuminate the arch and the textiles at opposite ends of the sightline.
    for(const [p,t] of [
      [[.265,2.668,-3.42],[.7,1.85,-4.47]],
      [[.255,2.668,-1.12],[.18,1.11,-2.02]]
    ]) {
      const bulb=spotHead(p,t,.081,'Arch spot');
      aimAt(bulb,t,28,3.7,'Back wall and brocade spot',.76);
    }
  }
  if(modeId==='rail' || modeId==='showroom') {
    // Clamp to the upper fixed showcase frame, kept clear of the left sliding leaf.
    bar(group,black,[1.955,2.191,-.042],.83,.025,.038);
    for(const [x,tx] of [[1.70,1.76],[2.19,2.16]]) {
      const pt=[x,2.168,-.046],target=[tx,1.03,-.235];
      const bulb=spotHead(pt,target,.102,'Showcase head');
      aimAt(bulb,target,25,modeId==='rail'?3.8:2.65,'Window mannequin accent',.72);
    }
  }
  if(modeId==='showroom') {
    const x=1.63,z=-2.53;
    bar(group,brass,[2.035,2.339,z],.84,.024,.032);
    bar(group,brass,[2.435,2.28,z],.03,.145,.06);
    spindle(group,black,.005,.155,[x,2.251,z]);
    spindle(group,brass,.033,.046,[x,2.165,z]);
    const globe=mountedPart(group,new THREE.SphereGeometry(.084,24,18),luminous,[x,2.08,z]);
    globe.castShadow=false;
    aimAt([x,1.99,z],[1.62,.87,z],48,4.3,'Opal counter pendant',.82);
  }
  if (imported.length && modeId!=='wash') shadowedBeam(imported[0].lamp);
  group.visible=false;
  scene.add(group);
  return {group,lamps:imported,diffuser:luminous};
}

const sourceGain={recessed:.034,cove:.036,track:.032,pendants:.012,wash:.017,rail:.016,showroom:.025};
const shelfGain=.045;
export function prepareLighting(asset,initialMode) {
  const option=getOption(initialMode);
  if(!option)throw new Error('Unknown lighting plan');
  const source=[],diffusers=[],split=[],extras=new Map();
  asset.scene.traverse(node=>{
    if(node.isSpotLight)source.push({lamp:node,power:node.intensity,isShelf:/concealed.shelf/i.test(node.name)});
    if(node.isMesh && node.material?.name?.includes('luminous diffuser'))split.push(node);
  });
  for(const node of split)diffusers.push(...splitOriginalDiffuser(node));
  // The street opening adds soft, cooler frontal fill distinct from overhead sky.
  // Its target and origin lie outside the fit-out bounds used for camera framing:
  // only a light, with no extra geometry, occupies the street.
  const streetFill=spot(asset.scene,'Soft street daylight',[1.32,2.12,.97],[1.08,.85,-2.55],6.5,61,.95);
  streetFill.color.setHex(0xeaf3ff);
  streetFill.distance=7.2;
  if(option.base==='track') {
    const key=source.find(({lamp})=>/spot.1$/i.test(lamp.name));
    if(key) shadowedBeam(key.lamp);
  }
  // The ceiling and shelf strips are softened deliberately. Local fixtures are
  // near the merchandise, so their designed beam falloff has visible influence.
  for(const item of source) {
    const l=item.lamp;
    if(item.isShelf) l.penumbra=.91;
    else if(option.base==='cove')l.penumbra=.96;
    else if(option.base==='track')l.penumbra=.51;
    else l.penumbra=.75;
  }
  return (state,override=option)=>{
    const plan=getOption(override);
    if(!plan || plan.base!==option.base)throw new Error('Incompatible lighting base');
    if(!['recessed','cove','track'].includes(plan.id)&&!extras.has(plan.id)){
      extras.set(plan.id,accessory(asset.scene,plan.id));
    }
    const strength=clamp(Number(state.intensity??100),0,150)/100;
    const shelf=clamp(Number(state.shelf??70),0,100)/100;
    streetFill.intensity=6.5*clamp(Number(state.daylight??62),0,100)/100;
    const colour=lampColour(state.kelvin??plan.kelvin);
    const warmShelf=lampColour(Math.max(2300,(state.kelvin??plan.kelvin)-160));
    for(const {lamp,power,isShelf} of source) {
      lamp.intensity=power*(isShelf?shelfGain*shelf:sourceGain[plan.id]*strength);
      lamp.color.copy(isShelf?warmShelf:colour);
    }
    for(const {mat,isShelf} of diffusers){
      mat.emissive.copy(isShelf?warmShelf:colour);
      mat.emissiveIntensity=isShelf?1.5*shelf:((plan.id==='wash'||plan.id==='pendants'||plan.id==='rail')?.56:1.26)*strength;
    }
    for(const [id,extra] of extras) {
      extra.group.visible=id===plan.id;
      if(id!==plan.id)continue;
      extra.diffuser.emissive.copy(colour);
      extra.diffuser.emissiveIntensity=1.45*strength;
      for(const {lamp,power} of extra.lamps){
        lamp.color.copy(colour);lamp.intensity=power*strength;
      }
    }
  };
}

export function updateEnvironment(scene,renderer,hemisphere,sun,settings,mode) {
  const option=getOption(mode);
  const sunFraction=clamp(Number(settings.daylight??62),0,100)/100;
  const local=clamp(Number(settings.intensity??100),0,150)/100;
  const concentrated=option?.id==='track'||option?.id==='rail';
  const ambientBias=concentrated ? .82 : 1;
  hemisphere.color.setHex(0xe9f1f8);
  hemisphere.groundColor.setHex(0xc8b9a6);
  hemisphere.intensity=(.14+.52*sunFraction)*ambientBias;
  sun.color.setHex(0xfff2db);
  sun.intensity=.06+1.12*sunFraction;
  scene.environmentIntensity=.16+.40*sunFraction+.055*local;
  renderer.toneMappingExposure=.98;
}

