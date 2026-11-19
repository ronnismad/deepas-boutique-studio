import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PI = Math.PI, TAU = PI * 2;
const V = (x,y,z) => new THREE.Vector3(x,y,z);
const palette = ['#a62d4d','#15786e','#c98225','#603982','#275784','#ac443b','#8a7138'];
let cachedDetail;

function finish(name,color,options={}) {
  const m = new THREE.MeshStandardMaterial({name,color,roughness:.5,...options});
  m.userData.surface = name;
  return m;
}

function clothPattern(color, role) {
  const cv = document.createElement('canvas');
  cv.width=512;cv.height=768;
  const c=cv.getContext('2d');
  c.fillStyle=color;c.fillRect(0,0,512,768);
  const glow=c.createLinearGradient(0,0,512,32);
  glow.addColorStop(0,'rgba(21,11,18,.08)');glow.addColorStop(.44,'rgba(253,215,160,.06)');glow.addColorStop(.79,'rgba(21,11,18,.06)');glow.addColorStop(1,'rgba(253,215,160,.035)');
  c.fillStyle=glow;c.fillRect(0,0,512,768);
  for(let i=0;i<768;i+=3){c.fillStyle=i%6?'rgba(250,219,157,.053)':'rgba(12,9,18,.042)';c.fillRect(0,i,512,1);}
  for(let i=0;i<512;i+=4){c.fillStyle='rgba(247,223,187,.025)';c.fillRect(i,0,1,768);}
  function buti(x,y,s) {
    c.save();c.translate(x,y);c.scale(s,s);c.lineWidth=1.15;c.strokeStyle='#d8ad67';c.fillStyle='#cf9e55';
    c.beginPath();c.moveTo(-4.8,4);c.bezierCurveTo(-10,-2,-1,-4,0,-8);c.bezierCurveTo(1,-10,1,-12,0,-13);c.bezierCurveTo(7,-7,9,1,3,5);c.bezierCurveTo(0,7,-3,6,-4.8,4);c.fill();
    c.strokeStyle=color;c.beginPath();c.moveTo(-3,3);c.quadraticCurveTo(1,2,2,-5);c.stroke();
    c.fillStyle='#ead197';c.beginPath();c.arc(0,8,1.12,0,TAU);c.fill();c.restore();
  }
  // Alternating small zari butis remain legible on both draped and folded cloth.
  const step=role==='fold'?64:48, row=role==='fold'?67:49;
  for(let j=0;j<768/row+1;j++)for(let i=-1;i<512/step+1;i++)buti(i*step+(j%2)*step*.5,j*row+12,role==='fold'?.82:.72);
  function brocade(y,height) {
    const gold=c.createLinearGradient(0,y,0,y+height);
    gold.addColorStop(0,'#b4894d');gold.addColorStop(.10,'#e4c483');gold.addColorStop(.22,'#b68d50');gold.addColorStop(.53,'#d4b16e');gold.addColorStop(.82,'#bd9459');gold.addColorStop(.94,'#e9cf91');gold.addColorStop(1,'#a87c40');
    c.fillStyle=gold;c.fillRect(0,y,512,height);
    c.lineWidth=1.2;c.strokeStyle=color;
    for(const f of [.08,.13,.84,.90]){c.beginPath();c.moveTo(0,y+height*f);c.lineTo(512,y+height*f);c.stroke();}
    for(let x=-16;x<528;x+=22){
      const cy=y+height*.50,r=height*.22;
      c.beginPath();c.moveTo(x-11,cy);c.quadraticCurveTo(x,cy-r*2,x+11,cy);c.quadraticCurveTo(x,cy+r*2,x-11,cy);c.stroke();
      c.fillStyle=color;c.beginPath();c.ellipse(x,cy,2.6,r*.56,.35,0,TAU);c.fill();
    }
  }
  if(role==='skirt'){brocade(692,65);brocade(681,5);}
  else if(role==='fold'){brocade(634,90);brocade(620,5);brocade(730,6);}
  else if(role==='pallu'){
    brocade(692,66);
    for(const x of [0,486]){c.save();c.translate(x+26,0);c.rotate(PI/2);const g=c.createLinearGradient(0,0,0,26);g.addColorStop(0,'#e7c587');g.addColorStop(.5,'#af864b');g.addColorStop(1,'#d6b675');c.fillStyle=g;c.fillRect(0,0,768,26);c.strokeStyle=color;c.lineWidth=1.3;for(let k=0;k<780;k+=18){c.beginPath();c.moveTo(k,4);c.lineTo(k+9,13);c.lineTo(k,22);c.lineTo(k-9,13);c.closePath();c.stroke();}c.restore();}
  }
  const map=new THREE.CanvasTexture(cv);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;
  return map;
}

function silk(color,role) {
  const m=new THREE.MeshPhysicalMaterial({name:'Woven silk '+color+' '+role,map:clothPattern(color,role),roughness:.48,metalness:.035,sheen:.63,sheenRoughness:.48,sheenColor:new THREE.Color(color).lerp(new THREE.Color('#dfc297'),.35),side:THREE.DoubleSide});
  m.userData.surface='silk';return m;
}

function surface(nx,ny,point,flip=false) {
  const p=[],u=[],ind=[];
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const a=i/nx,b=j/ny,pt=point(a,b);p.push(pt.x,pt.y,pt.z);u.push(a,b);
  }
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;
    if(flip)ind.push(a,c,b,b,c,d);else ind.push(a,b,c,b,d,c);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));g.setIndex(ind);g.computeVertexNormals();return g;
}

function batch(name) {
  const lists=new Map();
  return {
    add(g,mat) {
      if(g.index)g=g.toNonIndexed();
      // Retain a common vertex layout for batching.
      for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);
      if(!lists.has(mat))lists.set(mat,[]);lists.get(mat).push(g);
    },
    group() {
      const gp=new THREE.Group();gp.name=name;
      for(const [mat,parts] of lists) {
        const mesh=new THREE.Mesh(mergeGeometries(parts),mat);
        mesh.name=mat.name;if(mat.userData.surface==='timber')mesh.userData.boutiqueWoodRole='dark';mesh.castShadow=true;mesh.receiveShadow=true;gp.add(mesh);
        for(const g of parts)g.dispose();
      }
      return gp;
    }
  };
}

function oval(b,mat,ctr,r,angle=0) {
  const g=new THREE.SphereGeometry(1,22,18);g.scale(r[0],r[1],r[2]);g.rotateZ(angle);g.translate(...ctr);b.add(g,mat);
}
function rod(b,mat,start,end,r0,r1=r0,segments=10) {
  const a=V(...start),z=V(...end),diff=z.clone().sub(a);
  const g=new THREE.CylinderGeometry(r1,r0,diff.length(),segments);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,1,0),diff.normalize()));
  const mid=a.add(z).multiplyScalar(.5);g.translate(mid.x,mid.y,mid.z);b.add(g,mat);
}
function tube(b,mat,points,r,segments=32) {
  const path=new THREE.CatmullRomCurve3(points.map(p=>V(...p)));b.add(new THREE.TubeGeometry(path,segments,r,7,false),mat);
}
function box(b,mat,centre,size,radius=.004,rotationX=0){
  const g=new RoundedBoxGeometry(...size,2,Math.min(radius,...size.map(s=>s/2)));
  g.rotateX(rotationX);g.translate(...centre);b.add(g,mat);
}
function sample(rows,y) {
  for(let i=1;i<rows.length;i++)if(y<=rows[i][0]) {
    const t=THREE.MathUtils.clamp((y-rows[i-1][0])/(rows[i][0]-rows[i-1][0]),0,1);
    return rows[i].slice(1).map((v,j)=>THREE.MathUtils.lerp(rows[i-1][j+1],v,t));
  }
  return rows.at(-1).slice(1);
}
function profile(b,mat,rows,opts={}) {
  const g=surface(opts.segments||64,opts.levels||64,(u,v)=>{
    const y=THREE.MathUtils.lerp(rows[0][0],rows.at(-1)[0],v),t=u*TAU-PI;
    const [rx,rz,z0]=sample(rows,y);let x=rx*Math.sin(t),z=z0+rz*Math.cos(t),yy=y;
    if(opts.deform){const q=opts.deform(t,v,x,z,y);x=q.x;yy=q.y;z=q.z;}
    return V(x,yy,z);
  });
  b.add(g,mat);
}

function dressForm(b,c,side,materials) {
  const {skin,gold,skirt,pallu,blouse}=materials;
  const lower=[[.034,.157,.120,.005],[.07,.156,.120,.004],[.22,.147,.109,.008],[.54,.133,.103,.004],[.72,.142,.112,-.004],[.83,.148,.119,-.008],[.90,.144,.120,-.002],[.968,.112,.093,-.001],[.988,.108,.093,0]];
  profile(b,skirt,lower,{levels:62,segments:118,deform(t,v,x,z,y){
    const towardsFront=Math.exp(-Math.pow((t+.04)/.64,2)),f=(1-v*.76);
    const wave=(.0027*Math.cos(11*t+.65*v)+towardsFront*(.0096*Math.sin(27*t+v*.52)+.0034*Math.sin(55*t+1.2)))*f;
    return V(x+wave*Math.sin(t),y+(1-v)**6*.004*(.55+.45*Math.cos(12*t)),z+wave*Math.cos(t)+towardsFront*.018*(1-v)**2);
  }});
  const body=[[.907,.105,.085,.003],[.980,.101,.082,.003],[1.045,.110,.089,.005],[1.100,.125,.098,.006],[1.161,.146,.109,.010],[1.204,.150,.102,.009],[1.245,.147,.090,.004],[1.273,.157,.078,-.004],[1.290,.155,.069,-.004],[1.314,.114,.065,-.002],[1.330,.070,.057,0],[1.342,.050,.048,0]];
  const chest=(x,y)=>{const [rx,rz,z0]=sample(body,y);return z0+rz*Math.sqrt(Math.max(.008,1-(x/rx)**2))+.011*Math.exp(-Math.pow((Math.abs(x)-.065)/.040,2)-Math.pow((y-1.18)/.055,2));};
  profile(b,skin,body,{levels:56,deform(t,v,x,z,y){return V(x,y,Math.cos(t)>0?chest(x,y):z);}});
  b.add(surface(70,44,(u,v)=>{
    const t=u*TAU-PI,front=Math.max(0,Math.cos(t)),back=Math.max(0,-Math.cos(t));
    const top=1.315-.104*Math.pow(front,3.4)-.067*Math.pow(back,3),y=.997+(top-.997)*v;
    const [rx,rz,z0]=sample(body,y),x=(rx+.002)*Math.sin(t),z=Math.cos(t)>0?chest(rx*Math.sin(t),y)+.002:z0+(rz+.002)*Math.cos(t);
    return V(x,y,z);
  }),blouse);
  // Arms use tapered elliptical sections with separate hands and thumbs.
  for(const s of [-1,1]){
    const offset=s===side?.008:0;
    const rings=[[.678,.016,.014,.167,.058],[.70,.025,.015,.174,.061],[.737,.029,.021,.178,.059],[.770,.020,.016,.183,.050],[.805,.021,.019,.183,.047],[.90,.029,.025,.188,.038],[.976,.033,.030,.186,.01],[1.018,.031,.031,.180,-.005],[1.09,.039,.034,.179,-.004],[1.18,.044,.039,.172,.003],[1.245,.048,.045,.156,.004],[1.270,.034,.038,.147,.002],[1.287,.011,.015,.145,.002]];
    function armP(u,y,skinOffset=0){const [rx,rz,cx,cz]=sample(rings,y),a=TAU*u;return V(s*(cx+offset*(1-y/1.3))+(rx+skinOffset)*Math.sin(a),y,cz+(rz+skinOffset)*Math.cos(a));}
    b.add(surface(26,38,(u,v)=>armP(u,.764+(.523)*v)),skin);
    oval(b,skin,[s*.179,.749,.055],[.023,.031,.015],-.18*s);
    for(let j=0;j<4;j++) {
      const xx=.171+j*.006, yy=.712+[.004,0,.002,.009][j];
      oval(b,skin,[s*xx,yy,.062+(j===1?.002:0)],[.0052,.018-(j===3?.004:0),.006],-.10*s);
    }
    b.add(surface(32,18,(u,v)=>armP(u,1.166+(.114)*v,.003)),blouse);
    b.add(surface(32,4,(u,v)=>armP(u,1.166+.008*v,.004)),gold);
    oval(b,skin,[s*.160,.742,.069],[.008,.019,.008],s*-.32);
    // Subtle pair of rigid brass bangles on the wrist.
    for(const y of [.783,.791])b.add(surface(32,3,(u,v)=>armP(u,y+.003*v,.002)),gold);
  }
  const neck=[[1.296,.060,.050,-.004],[1.32,.062,.053,-.003],[1.343,.047,.041,-.001],[1.374,.041,.038,.003],[1.40,.045,.042,.009],[1.422,.057,.050,.009]];
  profile(b,skin,neck,{segments:48,levels:28});
  const skull=[[1.39,.008,.018,.037],[1.398,.031,.037,.033],[1.409,.044,.050,.028],[1.424,.056,.061,.020],[1.45,.066,.072,.011],[1.477,.074,.079,.006],[1.506,.078,.085,.002],[1.54,.080,.086,-.001],[1.570,.075,.082,-.006],[1.601,.063,.068,-.009],[1.621,.042,.048,-.011],[1.634,.013,.016,-.010],[1.636,.001,.002,-.01]];
  profile(b,skin,skull,{segments:62,levels:62});
  for(const s of [-1,1]){
    oval(b,skin,[s*.066,.040,.063],[.048,.026,.092],-.06*s);
    for(let i=0;i<5;i++)oval(b,skin,[s*(.045+i*.010),.027,.125-i*.005],[.0095-i*.0008,.0095,.021-i*.001],0);
  }
  // The front pallu hugs the compound curvature of the chest, then returns over
  // the left shoulder. Only the back tail extends freely away from the body.
  const path=[[-.075,.908,.098,.110],[-.065,.977,.105,.112],[-.038,1.046,.102,.106],[.005,1.125,.098,.099],[.052,1.198,.087,.083],[.102,1.253,.072,.071],[.122,1.273,.064,.043],[.122,1.289,.056,.007],[.12,1.283,.057,-.040],[.116,1.252,.059,-.075],[.105,1.169,.064,-.109],[.107,1.053,.072,-.120],[.104,.920,.078,-.126],[.099,.783,.082,-.135],[.108,.654,.084,-.133],[.114,.535,.085,-.135]];
  const centreCurve=new THREE.CatmullRomCurve3(path.map(p=>V(p[0],p[1],p[3])));
  const drape=surface(30,96,(u,v)=>{
    const q=centreCurve.getPoint(v),f=v*(path.length-1),i=Math.min(Math.floor(f),path.length-2);
    let width=THREE.MathUtils.lerp(path[i][2],path[i+1][2],f-i);
    let x=q.x+(u-.5)*width*1.65, y=q.y,z=q.z;
    if(v<.16){
      // Wrap the wide leading end around the left hip; its edge is tucked under the skirt.
      const a=THREE.MathUtils.lerp(-1.60,-.05,u), [rx,rz,z0]=sample(lower,Math.min(.987,y));
      const hipX=(rx+.002)*Math.sin(a),hipZ=z0+(rz+.003)*Math.cos(a);
      const ease=THREE.MathUtils.smoothstep(v,.02,.16);
      x=THREE.MathUtils.lerp(hipX,x,ease);z=THREE.MathUtils.lerp(hipZ,chest(x,y)+.006,ease);
      y+=.024*(u-.5)*(1-ease);
    }else if(v<.39){z=Math.max(chest(x,Math.max(.909,y)),q.z-.027)+.005;}
    const ripple=.0036*Math.sin(u*PI*10+.55*Math.sin(v*PI*4))+.0016*Math.sin(u*TAU*8);
    z+=ripple*(v>.50?-1:1);
    return V(x,y+.005*Math.cos(u*PI*2)*(v>.85?1:0),z);
  });
  const drapeUV=drape.attributes.uv;
  for(let k=0;k<drapeUV.count;k++)drapeUV.setY(k,1-drapeUV.getY(k));
  b.add(drape,pallu);
  const chain=[];
  for(let i=0;i<=48;i++){
    const a=TAU*i/48,cf=Math.cos(a),x=.069*Math.sin(a),y=1.337-.084*Math.pow(Math.max(0,cf),1.25);
    const [rx,rz,oz]=sample(body,y);
    const faceDepth=cf>0?chest(x,y)+.006:oz-rz*Math.sqrt(Math.max(.04,1-(x/rx)**2))-.002;
    chain.push([x,y,faceDepth]);
  }
  tube(b,gold,chain,.0025,60);
  oval(b,gold,[0,1.246,chest(0,1.251)+.008],[.006,.008,.003]);
  const gp=b.group();gp.position.set(c.x,.145,c.z);return gp;
}

function folded(b,mat,x,y,z,w,d,h,angle=0,variant=0) {
  // Three rolled edge rings give a soft folded lip rather than a square-ended slab.
  const rounded=(u,v)=>{
    const r=.012,xx=(u-.5)*w,zz=(v-.5)*d,cx=Math.sign(xx)*Math.max(0,Math.abs(xx)-(w*.5-r)),cz=Math.sign(zz)*Math.max(0,Math.abs(zz)-(d*.5-r));
    const len=Math.hypot(cx,cz),f=len>r?r/len:1;
    return [xx-cx+cx*f,zz-cz+cz*f];
  };
  const top=(u,v,level=1)=>{
    const [xx,zz]=rounded(u,v);const puff=.0023*Math.sin(PI*u)*Math.sin(PI*v);
    return V(xx,y+level*h+puff+.0008*Math.cos(u*PI*2+variant)*Math.sin(v*PI),zz);
  };
  const transform=g=>{g.rotateY(angle);g.translate(x,0,z);b.add(g,mat);};
  transform(surface(12,10,(u,v)=>top(u,v),true));
  for(const edge of [0,1,2,3]) {
    transform(surface(14,5,(u,v)=>{
      const coords=[[u,0],[1,u],[1-u,1],[0,1-u]][edge];const p=top(coords[0],coords[1],v);
      const bulge=Math.sin(PI*v)*.002;p.x+=Math.sign(p.x)*bulge;p.z+=Math.sign(p.z)*bulge;
      return p;
    },true));
  }
}

function shopDetails() {
  const forms=new THREE.Group();forms.name='Tailored display forms';
  const skin=finish('mannequin',0xe9dcc7,{roughness:.41});
  const gold=finish('brushed brass',0xc2a062,{metalness:.76,roughness:.32});
  ['#14776b','#a22b46'].forEach((color,i)=>{
    const skirt=silk(color,'skirt'),pallu=silk(color,'pallu'),blouse=silk(color,'blouse');
    forms.add(dressForm(batch('Saree form '+(i+1)),i===0?{x:2.165,z:-.24}:{x:1.757,z:-.23},i===0?1:-1,{skin,gold,skirt,pallu,blouse}));
  });
  const b=batch('Folded and hanging silk');
  const textiles=palette.map(c=>silk(c,'fold')),hanging=palette.map(c=>silk(c,'skirt'));
  const hanger=finish('timber',0x503827,{roughness:.43});
  const xbase=.168, shelfStart=-3.4692;
  function pile(x,y,z,w,d,count,seed) {
    for(let n=0;n<count;n++)folded(b,textiles[(seed+n)%textiles.length],x+.002*Math.sin(seed+n),y+.024*n,z+.002*Math.cos(seed+n),w,d,.023,.014*Math.sin(n+seed),n);
  }
  for(let lane=0;lane<4;lane++){
    const z=shelfStart+.30+.6096*lane;
    pile(xbase,.071,z,.246,.400,5,lane);pile(xbase,1.547,z,.246,.414,5,lane+3);
  }
  for(let i=0;i<2;i++)pile(xbase,.637+i*.6096,shelfStart+.30,.246,.396,6,i+2);
  const railx=.268;
  rod(b,gold,[railx,1.475,shelfStart+.626],[railx,1.475,shelfStart+2.406],.009,.009,18);
  for(let i=0;i<7;i++){
    const z=shelfStart+.743+i*.224,q=.005*Math.cos(i);
    tube(b,gold,[[railx,1.425,z],[railx,1.448,z],[railx,1.462,z-.008],[railx,1.483,z-.006],[railx,1.484,z+.006],[railx,1.474,z+.011]],.0022,18);
    for(const sign of [-1,1])rod(b,hanger,[railx,1.438,z],[railx,1.409,z+sign*.082],.005,.007,9);
    rod(b,hanger,[railx,1.409,z-.083],[railx,1.409,z+.083],.006,.006,10);
    b.add(surface(28,34,(u,v)=>{
      const y=.411+.018*Math.sin(i*1.7)+v*(.995-.018*Math.sin(i*1.7)),fold=Math.sin(u*TAU*(3.+(i%2)*.5)+q+v*.5);
      return V(.277+.017*(1-v)+.010*fold+.004*Math.sin(u*TAU*6.4-v*.4),y+.004*Math.sin(u*TAU*3)*(1-v),z+(u-.5)*(.175-.018*v)+.004*Math.sin(v*PI)*q);
    }),hanging[(i+3)%hanging.length]);
  }
  // Three bundles, with the same footprints as those traced from the plan.
  for(let n=0;n<3;n++)for(let j=0;j<3;j++){
    const tint=[[3,1,2],[2,6,3],[4,2,0]][n][j];
    folded(b,textiles[tint],1.615,.860+j*.014,-2.93+n*.36,.209,.256,.0135,.012*Math.sin(j*1.1+n),j);
  }
  const stool=batch('Upholstered counter stools'),upholstery=finish('upholstery',0xc99b6c,{roughness:.83}),piping=finish('saddle piping',0x9c6f4c,{roughness:.69});
  for(const z of [-3.09,-2.56,-2.03]) {
    const centre=1.14;
    for(const s of [-1,1])for(const t of [-1,1])rod(stool,hanger,[centre+s*.089,.011,z+t*.091],[centre+s*.061,.384,z+t*.067],.014,.017);
    for(const s of [-1,1])rod(stool,gold,[centre+s*.078,.143,z-.079],[centre+s*.078,.143,z+.079],.005);
    const seatRows=[[.378,.118],[.385,.129],[.398,.137],[.437,.139],[.455,.134],[.463,.118],[.468,.07],[.469,.001]];
    const p=seatRows.map(([yy,rr])=>new THREE.Vector2(rr,yy));let mesh=new THREE.LatheGeometry(p,54);mesh.translate(centre,0,z);stool.add(mesh,upholstery);
    mesh=new THREE.TorusGeometry(.1375,.0019,7,54);mesh.rotateX(PI/2);mesh.translate(centre,.429,z);stool.add(mesh,piping);
  }
  const register=batch('Cash desk payment terminal'),casing=finish('graphite terminal',0x282a29,{roughness:.45}),edge=finish('terminal bezel',0x464947,{roughness:.3,metalness:.48});
  box(register,casing,[2.054,1.013,-1.285],[.147,.024,.185],.009);
  rod(register,edge,[2.054,1.021,-1.299],[2.054,1.099,-1.285],.025,.023,14);
  const display=finish('terminal display glass',0x1d373b,{roughness:.17,metalness:.25,emissive:0x102324,emissiveIntensity:.14});
  box(register,casing,[2.054,1.119,-1.285],[.119,.025,.170],.010,-.50);
  box(register,display,[2.054,1.133,-1.281],[.100,.003,.124],.001,-.50);
  const ret=new THREE.Group();ret.name='Shop interior detailing';ret.add(forms,b.group(),stool.group(),register.group());return ret;
}

function removeStock(group,shouldHide) {
  if(!group)return;
  group.traverse(child=>{if(child.isMesh&&shouldHide(child.material.name.toLowerCase(),child))child.visible=false;});
}
function eraseOldStoolBases(group) {
  // Base cylinders share one material/primitive with the counter's walnut fluting.
  group?.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.material.name.includes('#503c31'))return;
    const src=mesh.geometry,index=src.index?.array,pos=src.attributes.position,ids=[];
    for(let i=0,count=index?.length||pos.count;i<count;i+=3){
      const a=index?index[i]:i,b=index?index[i+1]:i+1,c=index?index[i+2]:i+2;
      if(Math.max(pos.getX(a),pos.getX(b),pos.getX(c))>1.22)ids.push(a,b,c);
    }
    const geom=src.clone();geom.setIndex(ids);mesh.geometry=geom;
  });
}
export function enhanceModel(asset) {
  const scene=asset.scene;
  if(scene.userData.tailoredInterior)return;
  scene.userData.tailoredInterior=true;
  for(const group of scene.children){
    const n=group.name.toLowerCase().replace(/[^a-z0-9]/g,'');
    if(n.startsWith('streetfacingmannequin'))removeStock(group,()=>true);
    if(n.startsWith('inwardfacingsareeshelf'))removeStock(group,(m)=>m.startsWith('brocade silk')||m==='#c4a35e');
    if(n.startsWith('centralsalescounter')){
      eraseOldStoolBases(group);
      removeStock(group,(m)=>m.startsWith('brocade silk')||m==='#b28359'||m==='#c4a35e');
    }
    if(n.startsWith('cashcounter'))removeStock(group,m=>m==='#38413d'||m==='#37413d');
  }
  if(!cachedDetail)cachedDetail=shopDetails();scene.add(cachedDetail.clone(true));
}
