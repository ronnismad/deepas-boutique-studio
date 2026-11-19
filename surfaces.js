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

class RoomContactPass extends GTAOPass {
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
  const rt=new THREE.WebGLRenderTarget(8,8,{type:THREE.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples)});
  const composer=new EffectComposer(renderer,rt);
  const beauty=new RenderPass(scene,cameraGetter());
  const contact=new RoomContactPass(scene,cameraGetter(),8,8,undefined,
    {radius:.26,thickness:.16,samples:12,distanceExponent:1,distanceFallOff:.82,scale:1.0},
    {radius:4,samples:8,rings:2});
  contact.blendIntensity=.76;
  composer.addPass(beauty);composer.addPass(contact);composer.addPass(new OutputPass());
  return {
    draw(){
      const cam=cameraGetter();
      if(contact.camera!==cam){
        const perspective=cam.isPerspectiveCamera?1:0;
        contact.gtaoMaterial.defines.PERSPECTIVE_CAMERA=perspective;
        contact.gtaoMaterial.needsUpdate=true;
      }
      beauty.camera=cam;contact.camera=cam;composer.render();
    },
    resize(w,h){
      composer.setSize(w,h);
      const ratio=renderer.getPixelRatio();
      contact.setSize(Math.max(1,Math.round(w*ratio*.78)),Math.max(1,Math.round(h*ratio*.78)));
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
