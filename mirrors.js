import * as THREE from 'three';

// Reflect the camera using its actual projection. The studio uses both an
// orthographic cutaway and perspective eye-level cameras.
export function installMirrors(object) {
  const mirrors=[];
  const virtualEye=new THREE.PerspectiveCamera(), virtualPlan=new THREE.OrthographicCamera();
  const centre=new THREE.Vector3(), normal=new THREE.Vector3(), direction=new THREE.Vector3();
  const position=new THREE.Vector3(), look=new THREE.Vector3(), up=new THREE.Vector3();
  const plane=new THREE.Plane(), clip=new THREE.Vector4(), corner=new THREE.Vector4();
  const bias=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
  let revision=0, pixelSize=512;
  for (const group of [...object.children]) {
    if (!group.name.toLowerCase().startsWith('mirror')) continue;
    let silver;
    group.traverse(n=>{if(n.isMesh && (n.material.name.toLowerCase().includes('silver')||n.material.metalness>.96))silver=n;});
    if(!silver)continue;
    const bounds=new THREE.Box3().setFromObject(silver),size=bounds.getSize(new THREE.Vector3());
    const alongZ=size.z>size.x;
    const target=new THREE.WebGLRenderTarget(pixelSize,pixelSize,{type:THREE.HalfFloatType,depthBuffer:true});
    const project=new THREE.Matrix4();
    const material=new THREE.ShaderMaterial({
      uniforms:{reflection:{value:target.texture},project:{value:project}},
      vertexShader:`uniform mat4 project; varying vec4 coordinates;
        void main(){coordinates=project*vec4(position,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform sampler2D reflection; varying vec4 coordinates;
        void main(){ gl_FragColor=vec4(texture2DProj(reflection,coordinates).rgb*vec3(.93,.95,.94),1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    const mirror=new THREE.Mesh(new THREE.PlaneGeometry(alongZ?size.z:size.x,size.y),material);
    mirror.name='Reflection • '+group.name; mirror.userData.planarMirror=true;
    bounds.getCenter(mirror.position);
    if(alongZ){mirror.rotation.y=-Math.PI/2;mirror.position.x-=.001;}
    else{mirror.rotation.y=Math.PI;mirror.position.z-=.001;}
    mirror.layers.set(1);
    // In a reflection, other mirrors show their physical silver surface. A
    // previously rendered camera texture must never be reused as a nested view.
    silver.layers.set(2);silver.castShadow=false;silver.userData.traceExcluded=true;
    let rendered=-1;
    mirror.onBeforeRender=(renderer,scene,camera)=>{
      if(scene.overrideMaterial || rendered===revision)return;
      const virtual=camera.isPerspectiveCamera?virtualEye:virtualPlan;
      centre.setFromMatrixPosition(mirror.matrixWorld);
      normal.set(0,0,1).transformDirection(mirror.matrixWorld);
      position.setFromMatrixPosition(camera.matrixWorld);
      camera.getWorldDirection(direction);
      if(camera.isPerspectiveCamera?look.subVectors(position,centre).dot(normal)<=.001:direction.dot(normal)>=-.0001)return;
      virtual.position.copy(position).sub(centre).reflect(normal).add(centre);
      virtual.up.copy(up.set(0,1,0).transformDirection(camera.matrixWorld).reflect(normal));
      virtual.lookAt(look.copy(virtual.position).add(direction.reflect(normal)));
      virtual.near=camera.near;virtual.far=camera.far;
      virtual.updateMatrixWorld();
      virtual.projectionMatrix.copy(camera.projectionMatrix);
      project.copy(bias).multiply(virtual.projectionMatrix).multiply(virtual.matrixWorldInverse).multiply(mirror.matrixWorld);
      plane.setFromNormalAndCoplanarPoint(normal,centre).applyMatrix4(virtual.matrixWorldInverse);
      clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
      corner.set(Math.sign(clip.x),Math.sign(clip.y),1,1).applyMatrix4(camera.projectionMatrixInverse);
      const divisor=clip.dot(corner);
      if(Math.abs(divisor)<1e-7)return;
      clip.multiplyScalar(2/divisor);
      const m=virtual.projectionMatrix.elements;
      m[2]=clip.x-m[3];m[6]=clip.y-m[7];m[10]=clip.z-m[11];m[14]=clip.w-m[15];
      virtual.projectionMatrixInverse.copy(virtual.projectionMatrix).invert();
      virtual.layers.set(0);virtual.layers.enable(2);
      const previous=renderer.getRenderTarget(),xr=renderer.xr.enabled,shadow=renderer.shadowMap.needsUpdate;
      try{
        rendered=revision;renderer.xr.enabled=false;renderer.shadowMap.needsUpdate=false;
        renderer.setRenderTarget(target);renderer.state.buffers.depth.setMask(true);
        if(!renderer.autoClear)renderer.clear();
        renderer.render(scene,virtual);
      }finally{
        renderer.setRenderTarget(previous);renderer.xr.enabled=xr;renderer.shadowMap.needsUpdate=shadow;
      }
    };
    object.add(mirror);mirrors.push(target);
  }
  return {
    invalidate(){revision++;},
    size(next){if(next===pixelSize)return;pixelSize=next;for(const t of mirrors)t.setSize(next,next);revision++;}
  };
}
