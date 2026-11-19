import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { AVERAGE } from 'three-mesh-bvh';

const finalSamples = 160;
const interactionDelay = 340;

function physicalMaterial(original, node, background) {
  if (node.userData.streetBackplate) {
    // Exterior luminance and its tint follow the daylight control. Keeping
    // the street image emissive also makes it appear correctly in mirrors.
    return new THREE.MeshStandardMaterial({
      name: 'Street beyond the glazing', color: 0x151515, roughness: 1,
      map: original.map, emissiveMap: original.map, emissive: original.color,
      emissiveIntensity: .79, side: original.side
    });
  }
  const isMirror = node.userData.planarMirror;
  if (isMirror) return new THREE.MeshStandardMaterial({
    name: 'Silvered mirror', color: 0xf4f7f6, metalness: 1, roughness: .012, side: THREE.DoubleSide
  });
  if (original.isShadowMaterial) {
    const charcoal = background?.isColor ? background : 0x272c2b;
    return new THREE.MeshStandardMaterial({
      name: 'Studio ground', color: charcoal, roughness: .98,
      emissive: charcoal, emissiveIntensity: .35
    });
  }
  if (/clear glazing|architectural glass/i.test(original.name)) {
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: .035, transmission: 1,
      thickness: .008, ior: 1.51, attenuationDistance: 1.1, side: THREE.DoubleSide
    });
    glass.attenuationColor.setRGB(.84, .95, .91).lerp(original.color, .10);
    return glass;
  }
  if (original.isMeshStandardMaterial) {
    const mat = original.clone();
    // The environment is sampled independently. Cube-UV raster textures
    // cannot be packed into a material's 2D texture atlas.
    mat.envMap = null;
    return mat;
  }
  const mat = new THREE.MeshStandardMaterial({ color: original.color ?? 0xffffff, roughness: .72 });
  for (const k of ['name', 'map', 'alphaMap', 'alphaTest', 'opacity', 'side', 'transparent', 'vertexColors']) {
    if (k in original) mat[k] = original[k];
  }
  return mat;
}

function readableEquirect(texture) {
  return texture?.isDataTexture && texture.format === THREE.RGBAFormat && texture.image?.data &&
    [THREE.FloatType, THREE.HalfFloatType, THREE.UnsignedByteType].includes(texture.type);
}

// Hemisphere lights are approximated by an incident radiance distribution.
// Punctual and area lamps are kept as individual importance-sampled sources.
function environmentFor(source, hemis, ambient) {
  const original = readableEquirect(source.environment) ? source.environment : null;
  const width = original?.image.width || 64, height = original?.image.height || 32;
  const values = new Float32Array(width * height * 4);
  const input = original?.image.data;
  const coefficient = source.environmentIntensity;
  const decode = original?.type === THREE.HalfFloatType ? THREE.DataUtils.fromHalfFloat :
    original?.type === THREE.UnsignedByteType ? value => value / 255 : value => value;
  const direction = new THREE.Vector3();
  const up = new THREE.Vector3(0,1,0);
  const lamps = hemis.map(lamp => ({
    upper: lamp.color, lower: lamp.groundColor, gain: lamp.intensity / Math.PI,
    axis: lamp.getWorldPosition(new THREE.Vector3()).normalize()
  }));
  const light = new THREE.Color(), fill = new THREE.Color();
  for (let y = 0; y < height; y++) {
    const elevation = ((y + .5) / height - .5) * Math.PI * (original?.flipY ? -1 : 1);
    for (let x = 0; x < width; x++) {
      const azimuth = ((x + .5) / width - .5) * 2 * Math.PI;
      const offset = (x + width * y) * 4;
      direction.set(Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.sin(azimuth));
      direction.applyEuler(source.environmentRotation);
      light.copy(ambient);
      for (const lamp of lamps) {
        const amount = .5 + .5 * direction.dot(lamp.axis.lengthSq() ? lamp.axis : up);
        fill.copy(lamp.lower).lerp(lamp.upper,amount).multiplyScalar(lamp.gain);
        light.add(fill);
      }
      values[offset] = light.r + (input ? decode(input[offset]) * coefficient : 0);
      values[offset + 1] = light.g + (input ? decode(input[offset+1]) * coefficient : 0);
      values[offset + 2] = light.b + (input ? decode(input[offset+2]) * coefficient : 0);
      values[offset + 3] = 1;
    }
  }
  const result = new THREE.DataTexture(values, width, height, THREE.RGBAFormat, THREE.FloatType);
  result.mapping = THREE.EquirectangularReflectionMapping;
  result.colorSpace = THREE.LinearSRGBColorSpace;
  result.flipY = original?.flipY ?? false;
  result.needsUpdate = true;
  return result;
}

function visibleLight(node) {
  const result = node.clone(false);
  result.matrixAutoUpdate = false;
  result.matrix.copy(node.matrixWorld);
  if (node.target) {
    // A glTF spot may have its target parented beneath a scaled or rotated
    // group. Both matrices here are in world coordinates.
    node.target.updateWorldMatrix(true,false);
    result.target = new THREE.Object3D();
    result.target.matrixAutoUpdate = false;
    result.target.matrix.copy(node.target.matrixWorld);
    result.target.updateMatrixWorld(true);
  }
  if (result.isSpotLight) result.radius = node.radius ?? (/shelf/i.test(node.name) ? .012 : .027);
  return result;
}

function geometryGroup(geometry, group) {
  const result = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) result.setAttribute(name, attribute);
  const end = Math.min(group.start + group.count, geometry.index?.count ?? geometry.attributes.position.count);
  const count = Math.max(0, end - group.start);
  const index = new Uint32Array(count);
  for (let i = 0; i < count; i++) index[i] = geometry.index?.getX(group.start + i) ?? group.start + i;
  result.setIndex(new THREE.BufferAttribute(index,1));
  return result;
}

function addWindowDaylight(output, street) {
  // Sample diffuse daylight at the two inner faces of the glazing. It
  // reaches the arched wall even when the exterior lamp's shadow ray is
  // intercepted by both faces of a closed sliding pane.
  const daylight = [
    {from: [.57,1.89,-.115], to: [.97,1.39,-4.30], gain: 5.2, radius: .32},
    {from: [1.85,1.97,-.115], to: [.87,1.18,-3.83], gain: 3.6, radius: .31}
  ];
  for (const {from,to,gain,radius} of daylight) {
    const light = new THREE.SpotLight(street.color,street.intensity * gain,9,1.04,.80,2);
    light.name = 'Diffuse frontage daylight';
    light.radius = radius;
    light.position.fromArray(from);
    light.target.position.fromArray(to);
    if (street.parent) {
      street.parent.localToWorld(light.position);
      street.parent.localToWorld(light.target.position);
    }
    output.add(light,light.target);
  }
}

// The guide contains first-hit albedo, surface orientation and view depth.
// It lets a wall or floor pool several noisy estimates without blending across
// the edges of joinery, fabric motifs, mullions or the mirror frames.
function guideMaterial(mat) {
  const tex = mat.map || null;
  if (tex && tex.matrixAutoUpdate) tex.updateMatrix();
  return new THREE.ShaderMaterial({
    uniforms: {
      base: {value: mat.color}, albedo: {value: tex}, hasMap: {value: !!tex},
      uvMatrix: {value: tex?.matrix ?? new THREE.Matrix3()}
    },
    side: mat.side,
    vertexShader: `
      uniform mat3 uvMatrix;
      varying vec3 vN; varying vec2 vTex; varying float vDepth;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.);
        vN = normalize(normalMatrix * normal);
        vTex = (uvMatrix * vec3(uv, 1.)).xy;
        vDepth = -view.z;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      uniform vec3 base; uniform sampler2D albedo; uniform bool hasMap;
      varying vec3 vN; varying vec2 vTex; varying float vDepth;
      void main() {
        vec3 ink = base;
        if (hasMap) ink *= texture2D(albedo, vTex).rgb;
        vec3 normal = normalize(vN) * (gl_FrontFacing ? 1. : -1.);
        vec3 key = .73 * sqrt(max(ink, vec3(0.))) + .27 * (.5 + .5 * normal);
        gl_FragColor = vec4(key, clamp(.128 * log2(1. + max(0., vDepth)), 0., 1.));
      }`
  });
}

function tracingFilter(renderer) {
  const guide = new THREE.WebGLRenderTarget(1,1,{
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true
  });
  const temp = [0,1].map(() => new THREE.WebGLRenderTarget(1,1,{
    type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false
  }));
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    uniforms: {
      inputImage: {value:null}, guideImage: {value:guide.texture}, texel: {value:new THREE.Vector2()},
      stepSize: {value:1}, tolerance: {value:.28}, outputPass: {value:false}
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D inputImage; uniform sampler2D guideImage;
      uniform vec2 texel; uniform float stepSize; uniform float tolerance; uniform bool outputPass;
      float visibleLuma(vec3 c) {
        float l = dot(max(vec3(0.), c), vec3(.2126,.7152,.0722)); return l / (1. + l);
      }
      void main() {
        vec4 centre = texture2D(inputImage,vUv);
        vec4 g0 = texture2D(guideImage,vUv);
        float l0 = visibleLuma(centre.rgb);
        vec3 accum = vec3(0.); float weights = 0.;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec2 tap = vUv + vec2(float(x),float(y)) * texel * stepSize;
          vec4 g = texture2D(guideImage,tap);
          vec3 c = texture2D(inputImage,tap).rgb;
          vec3 dg = g.rgb - g0.rgb;
          float depth = abs(g.a - g0.a);
          float spatial = float((x == 0 ? 2 : 1) * (y == 0 ? 2 : 1));
          float dl = visibleLuma(c) - l0;
          float w = spatial * exp(-135. * dot(dg,dg) - 135. * depth - dl * dl / (tolerance * tolerance));
          accum += c * w; weights += w;
        }
        gl_FragColor = vec4(accum / max(weights, .00001), centre.a);
        if (outputPass) {
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      }`
  });
  const quad = new FullScreenQuad(material);
  return {
    update(snapshot,camera,w,h) {
      guide.setSize(w,h);
      for (const t of temp) t.setSize(w,h);
      material.uniforms.texel.value.set(1/w,1/h);
      renderer.setRenderTarget(guide);
      renderer.clear();
      renderer.render(snapshot.guide,camera);
      renderer.setRenderTarget(null);
    },
    draw(texture,samples) {
      const u = material.uniforms;
      u.inputImage.value = texture;
      // Decrease the spatial radius and increase edge sensitivity over time.
      const steps = samples < 48 ? [1,2,4] : [1,2];
      u.tolerance.value = THREE.MathUtils.lerp(.42,.085,Math.min(1,Math.sqrt(samples / finalSamples)));
      for (let i=0;i<steps.length;i++) {
        u.stepSize.value = steps[i];
        const last = i === steps.length - 1;
        const target = last ? null : temp[i%2];
        renderer.setRenderTarget(target);
        u.outputPass.value = last;
        quad.render(renderer);
        if (target) u.inputImage.value = target.texture;
      }
    },
    dispose() {
      guide.dispose();
      for (const t of temp)t.dispose();
      material.dispose(); quad.dispose();
    }
  };
}

// Keep the order of material slots already encoded in the acceleration structure
// when a paint, fabric or lamp changes. Volume and visibility edits need new geometry.
function geometryState(geometry) {
  const result=[];
  for(const a of [geometry.index,...Object.values(geometry.attributes)])result.push(a,a?.version??0);
  return result;
}
function updateAppearance(engine,previous,next,camera) {
  if(!previous||previous.meshes.size!==next.meshes.size)return false;
  const mapping=new Map();
  for(const [id,old] of previous.meshes){
    const row=next.meshes.get(id);
    if(!row||row.mesh.geometry!==old.mesh.geometry||!row.mesh.matrix.equals(old.mesh.matrix)||
        old.attributes.length!==row.attributes.length||old.attributes.some((v,i)=>v!==row.attributes[i]))return false;
    mapping.set(old.mesh.material,row.mesh.material);
  }
  const materials=engine._materials.map(m=>mapping.get(m));
  if(materials.some(m=>!m))return false;
  engine._materials=materials;
  engine.scene=next.scene;
  engine.setCamera(camera);
  engine.updateMaterials();engine.updateLights();engine.updateEnvironment();
  return true;
}

function sceneSnapshot(source, groupCache, previous) {
  source.updateMatrixWorld(true);
  const output = new THREE.Scene();
  const guide = new THREE.Scene();
  let eyeEnclosure = false, streetLight;
  output.background = source.background?.isColor ? source.background.clone() : source.background;
  output.backgroundIntensity = source.backgroundIntensity;
  output.backgroundRotation.copy(source.backgroundRotation);
  output.environmentRotation.copy(source.environmentRotation);
  const hemis = [], ambient = new THREE.Color(0);
  const ownedMaterials = [], meshes = new Map();
  const localMatrix = new THREE.Matrix4(), worldMatrix = new THREE.Matrix4();
  source.traverseVisible(node => {
    if (node.userData.eyeLevelOnly) eyeEnclosure = true;
    if (node.isSpotLight && node.name === 'Soft street daylight') streetLight = node;
    if (node.isHemisphereLight) { hemis.push(node); return; }
    if (node.isAmbientLight) { ambient.add(node.color.clone().multiplyScalar(node.intensity / Math.PI)); return; }
    if (node.isLight && node.intensity > 0 &&
        (node.isPointLight || node.isSpotLight || node.isDirectionalLight || node.isRectAreaLight)) {
      output.add(visibleLight(node));
      return;
    }
    if (!node.isMesh || !node.geometry?.attributes.position || node.userData.traceExcluded) return;
    const groups = Array.isArray(node.material) ? node.geometry.groups : [null];
    for (let part = 0; part < groups.length; part++) {
      const group = groups[part];
      const original = group ? node.material[group.materialIndex] : node.material;
      if (!original || !original.visible || original.opacity <= 0) continue;
      if (original.isShaderMaterial && !node.userData.planarMirror) continue;
      let geometry = node.geometry;
      if (group) {
        let parts = groupCache.get(geometry);
        if (!parts) { parts = new Map(); groupCache.set(geometry, parts); }
        const key = group.start + '/' + group.count;
        if (!parts.has(key)) parts.set(key, geometryGroup(geometry,group));
        geometry = parts.get(key);
      }
      for (let i = 0, n = node.isInstancedMesh ? node.count : 1; i < n; i++) {
        const mat = physicalMaterial(original, node, output.background);
        ownedMaterials.push(mat);
        const copy = new THREE.Mesh(geometry,mat);
        copy.uuid = node.uuid + '/' + part + '/' + i;
        copy.matrixAutoUpdate = false;
        worldMatrix.copy(node.matrixWorld);
        if (node.isInstancedMesh) {
          node.getMatrixAt(i,localMatrix);
          worldMatrix.multiply(localMatrix);
          if (node.instanceColor) mat.color.multiply(new THREE.Color().fromBufferAttribute(node.instanceColor,i));
        }
        copy.matrix.copy(worldMatrix);
        output.add(copy);
        meshes.set(copy.uuid,{mesh:copy,attributes:geometryState(geometry)});
        if (!(mat.transmission > .8)) {
          const ink = guideMaterial(mat);
          ownedMaterials.push(ink);
          const surface = new THREE.Mesh(geometry,ink);
          surface.matrixAutoUpdate = false;
          surface.matrix.copy(worldMatrix);
          guide.add(surface);
        }
      }
    }
  });
  if (eyeEnclosure && streetLight?.intensity > 0) addWindowDaylight(output,streetLight);
  const envKey=[source.environment?.uuid,source.environment?.version,source.environmentIntensity,
    ...source.environmentRotation.toArray(),...ambient.toArray(),...hemis.flatMap(h=>[
      h.intensity,...h.color.toArray(),...h.groundColor.toArray(),...h.matrixWorld.elements
    ])].join('|');
  output.environment = previous?.envKey===envKey?previous.scene.environment:environmentFor(source, hemis, ambient);
  output.environmentIntensity = 1;
  output.updateMatrixWorld(true);
  return { scene: output, guide, meshes, envKey, dispose(keepEnvironment=null) {
    ownedMaterials.forEach(m => m.dispose());
    if(output.environment!==keepEnvironment)output.environment.dispose();
    output.clear();
    guide.clear();
  }};
}

export function createTrace(renderer, scene, cameraGetter, report = () => {}, onError = () => {}, drawLive) {
  const raster = drawLive || (() => renderer.render(scene,cameraGetter()));
  const groupCache = new WeakMap(), bufferSize = new THREE.Vector2();
  let enabled = false, disposed = false, changed = true, cameraDirty = true;
  let timeout = 0, frame = 0, liveFrame = 0, sampleShown = 0;
  let engine, filter, snapshot, software = false;

  function cancel() {
    clearTimeout(timeout);
    cancelAnimationFrame(frame);
    timeout = frame = 0;
  }
  function presentLive() {
    if (!liveFrame && !disposed) liveFrame = requestAnimationFrame(() => {
      liveFrame = 0;
      if (!disposed && !renderer.getContext().isContextLost()) raster();
    });
  }
  function fail(error) {
    enabled = false;
    changed = cameraDirty = true;
    cancel();
    presentLive();
    onError(error);
  }
  function setup() {
    const gl = renderer.getContext();
    if (!renderer.capabilities.isWebGL2 || !renderer.extensions.has('EXT_color_buffer_float')) {
      throw new Error('This graphics device does not support floating-point WebGL 2 rendering.');
    }
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    software = debug && /swiftshader|llvmpipe|software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL));
    engine = new WebGLPathTracer(renderer);
    engine.renderDelay = 0;
    engine.renderToCanvas = false;
    engine.rasterizeScene = false;
    engine.bounces = software ? 4 : 7;
    engine.transmissiveBounces = 7;
    engine.filterGlossyFactor = .32;
    engine.textureSize.set(512,512);
    engine._generator.bvhOptions = { strategy: AVERAGE, maxLeafTris: 5 };
    filter = tracingFilter(renderer);
  }
  function size() {
    renderer.getDrawingBufferSize(bufferSize);
    const pixels = Math.max(1,bufferSize.x * bufferSize.y);
    const budget = software ? 145000 : 1500000;
    engine.renderScale = Math.min(1, Math.sqrt(budget / pixels));
    const tiles = pixels * engine.renderScale ** 2;
    engine.tiles.set(tiles > 320000 ? 3 : tiles > 40000 ? 2 : 1, tiles > 70000 ? 2 : 1);
  }
  function render() {
    if (!enabled || disposed) return;
    // Browsers throttle background tabs; no refinement should use a hidden GPU.
    if (document.hidden) { timeout = setTimeout(render,500); return; }
    try {
      if (renderer.getContext().isContextLost()) throw new Error('The graphics context was lost.');
      if (!engine) setup();
      size();
      const updateGuide = changed || cameraDirty || !snapshot;
      if (changed || !snapshot) {
        const next = sceneSnapshot(scene,groupCache,snapshot);
        try {
          // The pinned generator appends groups on update. Start each merge
          // cleanly so switching between lighting schemes cannot retain parts.
          if(!updateAppearance(engine,snapshot,next,cameraGetter())){
            engine._generator.geometry.clearGroups();
            engine.setScene(next.scene,cameraGetter());
          }
        } catch (error) { next.dispose(snapshot?.scene.environment); throw error; }
        snapshot?.dispose(next.scene.environment);
        snapshot = next;
        changed = false;
        cameraDirty = false;
      } else if (cameraDirty) {
        engine.setCamera(cameraGetter());
        cameraDirty = false;
      }
      if (updateGuide) filter.update(snapshot,cameraGetter(),Math.max(1,Math.floor(bufferSize.x*engine.renderScale)),Math.max(1,Math.floor(bufferSize.y*engine.renderScale)));
      engine.renderSample();
      const samples = Math.floor(engine.samples + .000001);
      if (samples > sampleShown) {
        sampleShown = samples;
        filter.draw(engine.target.texture,samples);
        report(samples >= finalSamples ? 'Studio rendering complete' : 'Refining light and reflections', samples);
      }
      if (samples < finalSamples && enabled) frame = requestAnimationFrame(render);
    } catch (error) { fail(error); }
  }
  function invalidate(geometryChanged = true) {
    changed ||= geometryChanged;
    cameraDirty = true;
    if (!enabled || disposed) return;
    sampleShown = 0;
    cancel();
    presentLive();
    report(changed ? 'Preparing the studio render' : 'Waiting for the view to settle',0);
    timeout = setTimeout(() => { frame = requestAnimationFrame(render); },interactionDelay);
  }
  function stop() {
    if (!enabled) return;
    enabled = false;
    cancel();
    presentLive();
  }
  function dispose() {
    stop();
    disposed = true;
    cancelAnimationFrame(liveFrame);
    filter?.dispose();
    if (engine) {
      // The bundled release's public dispose method references a removed
      // render quad. Free its two tracing pipelines explicitly.
      for (const pipeline of [engine._pathTracer,engine._lowResPathTracer]) {
        const mat = pipeline.material;
        for (const name of ['bvh','attributesArray','materialIndexAttribute','materials','envMapInfo','stratifiedTexture','stratifiedOffsetTexture'])
          mat[name]?.dispose?.();
        mat.lights?.tex.dispose();
        mat.textures?.renderTarget?.dispose();
        mat.iesProfiles?.renderTarget?.dispose();
        mat.dispose();
        pipeline.dispose();
      }
      engine._quad.material.dispose();
      engine._quad.dispose();
      engine._generator.geometry.dispose();
      engine._colorBackground?.dispose();
    }
    snapshot?.dispose();
    engine = filter = snapshot = null;
  }
  return {
    start() { if (!enabled && !disposed) { enabled = true; invalidate(!snapshot); } },
    stop, resize() { invalidate(false); }, invalidate, dispose,
    get active() { return enabled; }
  };
}
