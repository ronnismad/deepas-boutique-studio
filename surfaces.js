import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import photo,{roadTexture} from './street-image.js';

export async function streetView() {
  const map=await new THREE.TextureLoader().loadAsync(photo);
  map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=THREE.ClampToEdgeWrapping;
  const surface=new THREE.MeshBasicMaterial({map,color:0xe1e4df,side:THREE.FrontSide,toneMapped:false});
  const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(6.50,6.12),surface);
  backdrop.name='Street through the shopfront';backdrop.userData.streetBackplate=true;
  backdrop.rotation.y=Math.PI;backdrop.position.set(2.05,2.70,4.75);
  const roadMap=await new THREE.TextureLoader().loadAsync(roadTexture);
  roadMap.colorSpace=THREE.SRGBColorSpace;
  roadMap.wrapS=roadMap.wrapT=THREE.MirroredRepeatWrapping;roadMap.repeat.set(11,8);
  const road=new THREE.MeshBasicMaterial({name:'Street paving',map:roadMap,toneMapped:false});
  road.color=surface.color;
  const pavement=new THREE.Mesh(new THREE.PlaneGeometry(22,8),road);
  pavement.rotation.x=-Math.PI/2;pavement.position.set(2.05,-.307,4.42);
  const exterior=new THREE.Group();exterior.name='Street context';exterior.add(backdrop,pavement);
  exterior.userData.surface=surface;
  return exterior;
}

// Only the room footprint receives the soft studio contact shadow. Sampling
// interior spot-shadow frusta across an endless ground plane creates dark
// triangles far beyond the cut model.
export function studioContact(){
  const width=320,height=448,bounds={left:-2,right:7.25,front:2.45,back:-9.65};
  const footprints=[
    [-.09,2.49,-4.58,.08,.32,.29],
    [-.09,1.29,-7.78,-4.44,.30,.27],
    [2.45,5.24,-4.58,.08,.18,.56],
    [0,2.45,0,.54,.31,.14]
  ];
  const data=new Uint8Array(width*height*4);
  for(let row=0;row<height;row++){
    const z=bounds.front+(bounds.back-bounds.front)*(row+.5)/height;
    for(let col=0;col<width;col++){
      const x=bounds.left+(bounds.right-bounds.left)*(col+.5)/width;
      let opacity=0;
      for(const [left,right,back,front,strength,spread] of footprints){
        const dx=Math.max(left-x,0,x-right),dz=Math.max(back-z,0,z-front);
        opacity=Math.max(opacity,strength*Math.exp(-(dx*dx+dz*dz)/(spread*spread)));
      }
      const i=(row*width+col)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(opacity*255);
    }
  }
  const mask=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);
  mask.magFilter=mask.minFilter=THREE.LinearFilter;mask.needsUpdate=true;
  const material=new THREE.MeshBasicMaterial({color:0x020504,map:mask,transparent:true,depthWrite:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(bounds.right-bounds.left,bounds.front-bounds.back),material);
  mesh.name='Footprint contact shadow';mesh.userData.traceExcluded=true;mesh.renderOrder=-1;
  mesh.rotation.x=-Math.PI/2;mesh.position.set((bounds.right+bounds.left)/2,-.347,(bounds.front+bounds.back)/2);
  return mesh;
}

class RoomContactPass extends GTAOPass {
  setSize(width,height){
    // Allocate the normal, depth and AO buffers once at their working size.
    super.setSize(Math.max(1,Math.round(width*.70)),Math.max(1,Math.round(height*.70)));
  }
  renderOverride(renderer,material,target,clearColor,clearAlpha){
    const background=this.scene.background;
    try{
      this.scene.background=null;
      super.renderOverride(renderer,material,target,clearColor,clearAlpha);
    }finally{this.scene.background=background;}
  }
  overrideVisibility() {
    super.overrideVisibility();
    this.scene.traverseVisible(o=>{
      if(o.isMesh&&(o.material?.transparent||o.userData.streetBackplate))o.visible=false;
    });
  }
}
export function liveRendering(renderer,scene,cameraGetter) {
  if(!renderer.extensions.has('EXT_color_buffer_float')){
    return {draw(){renderer.render(scene,cameraGetter());},resize(){}};
  }
  const rt=new THREE.WebGLRenderTarget(8,8,{type:THREE.HalfFloatType,samples:Math.min(2,renderer.capabilities.maxSamples)});
  const composer=new EffectComposer(renderer,rt);
  composer.setPixelRatio(1);
  const beauty=new RenderPass(scene,cameraGetter());
  const contact=new RoomContactPass(scene,cameraGetter(),8,8,undefined,
    {radius:.26,thickness:.16,samples:12,distanceExponent:1,distanceFallOff:.82,scale:1.0},
    {radius:4,samples:8,rings:2});
  contact.blendIntensity=.76;
  composer.addPass(beauty);composer.addPass(contact);composer.addPass(new OutputPass());
  return {
    draw(full=true){
      contact.enabled=full;
      const cam=cameraGetter();
      if(contact.camera!==cam){
        const perspective=cam.isPerspectiveCamera?1:0;
        contact.gtaoMaterial.defines.PERSPECTIVE_CAMERA=perspective;
        contact.gtaoMaterial.needsUpdate=true;
      }
      beauty.camera=cam;contact.camera=cam;composer.render();
    },
    resize(w,h){
      const r=renderer.getPixelRatio();
      composer.setSize(Math.max(1,Math.round(w*r)),Math.max(1,Math.round(h*r)));
    }
  };
}

let pressedGlassTexture;
export function finishTransom(geometry,material){
  if(!pressedGlassTexture){
    const size=96,data=new Uint8Array(size*size*4),tau=2*Math.PI;
    function height(u,v){
      return .72*Math.sin(4*tau*u+.48*Math.sin(2*tau*v))+.17*Math.sin(tau*(3*v+u))+.12*Math.sin(tau*(7*u-4*v));
    }
    for(let j=0;j<size;j++)for(let i=0;i<size;i++){
      const u=i/size,v=j/size,k=(j*size+i)*4;
      data[k]=128-Math.round(65*(height(u+1/size,v)-height(u-1/size,v)));
      data[k+1]=128-Math.round(65*(height(u,v+1/size)-height(u,v-1/size)));data[k+2]=250;data[k+3]=255;
    }
    pressedGlassTexture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
    pressedGlassTexture.wrapS=pressedGlassTexture.wrapT=THREE.RepeatWrapping;
    pressedGlassTexture.magFilter=THREE.LinearFilter;pressedGlassTexture.minFilter=THREE.LinearMipmapLinearFilter;
    pressedGlassTexture.generateMipmaps=true;pressedGlassTexture.needsUpdate=true;
  }
  if(!geometry.attributes.uv){
    const pos=geometry.attributes.position,coords=new Float32Array(pos.count*2);
    for(let i=0;i<pos.count;i++){coords[2*i]=pos.getX(i)*6.53;coords[2*i+1]=pos.getY(i)*6.53;}
    geometry.setAttribute('uv',new THREE.BufferAttribute(coords,2));
  }
  material.name='Pressed transom glass';
  material.normalMap=pressedGlassTexture;material.normalScale.set(.92,.92);
  material.clearcoatNormalMap=pressedGlassTexture;material.clearcoatNormalScale.set(.50,.50);
  material.color.set(0xb1c4ba);material.metalness=.24;material.roughness=.15;
  material.envMapIntensity=1.25;material.opacity=Math.min(material.opacity,.66);
}
