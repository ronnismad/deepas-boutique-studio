import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// The original measured model is sectional. The eye-level cameras use a separate
// lining which rises from each cut edge, so the architectural overview can stay open.
const HEIGHT = 3.4;
const plaster = (colour, name) => new THREE.MeshStandardMaterial({
  name, color: colour, roughness: .96, metalness: 0
});

function tintSources(asset) {
  const sources = {};
  const associations = asset.parser?.associations;
  asset.scene.traverse(node => {
    if (!node.isMesh || !associations) return;
    const ref = associations.get(node);
    if (ref?.primitives === undefined) return;
    const {meshes, materials} = asset.parser.json;
    const name = materials[meshes[ref.meshes].primitives[ref.primitives].material].name;
    if (name === 'Ivory and sage') sources.accent = node;
    if (name === 'Warm ivory plaster') sources.companion = node;
  });
  return sources;
}

function boxes(bounds) {
  const solids = bounds.map(([x0,y0,z0,x1,y1,z1]) => {
    const g = new THREE.BoxGeometry(x1-x0, y1-y0, z1-z0).toNonIndexed();
    g.translate((x1+x0)/2, (y1+y0)/2, (z1+z0)/2);
    const uv = g.getAttribute('uv'), n = g.getAttribute('normal'), p = g.getAttribute('position');
    for(let i=0; i<p.count; ++i) {
      const xFace = Math.abs(n.getX(i)) > .9;
      uv.setXY(i, xFace ? p.getZ(i) : p.getX(i), Math.abs(n.getY(i))>.9 ? p.getZ(i) : p.getY(i));
    }
    return g;
  });
  const out = mergeGeometries(solids,false);
  for (const g of solids) g.dispose();
  return out;
}

let architecture;
function measureShell() {
  if (architecture) return architecture;
  const h = HEIGHT;
  const accent = [
    [0,2.92,-4.60,1.39,h,-4.5],                      // Complete plaster above the retained transom.
    [1.39,0,-4.6,2.45,h,-4.498],                     // Right of the arch, behind the stair.
    [2.45,2.28,-3.37,2.55,h,0], [2.45,2.28,-4.50,2.55,h,-4.40],
    [2.45,3.32,-4.40,2.55,h,-3.37]                   // Full-width mezzanine slider stays openable.
  ];
  const companion = [
    [-.09,1.94,-4.5,0,h,0],
    [0,2.243,-.056,2.45,h,.03]
  ];
  const secondary = [
    // The 1.20 m room beyond the arch has a 2.05 m, a 0.90 m and a 1.05 m opening.
    [-.09,.32,-7.78,0,h,-7.23], [-.09,.32,-5.18,0,h,-4.50],
    [-.09,0,-7.23,0,.84,-5.18],[-.09,2.20,-7.23,0,h,-5.18],
    [1.2,.45,-7.78,1.289,h,-7.32],[1.2,.45,-6.42,1.289,h,-6],
    [1.2,.45,-4.95,1.289,h,-4.60],
    [1.2,0,-7.32,1.289,.84,-6.42],[1.2,2.20,-7.32,1.289,h,-6.42],
    [1.2,2.14,-6,1.289,h,-4.95],[0,0,-7.78,1.2,h,-7.687],
    // Close the street face below the raised slab in eye-level views. The cutaway retains its open underside.
    [2.45,-.35,0,5.15,1.18,.09],
    // Mezzanine floor is +1.350 m. Preserve both measured windows.
    [2.45,1.82,-4.60,5.15,h,-4.5],
    [5.15,1.82,-4.50,5.24,h,-4.25],[5.15,1.82,-2.45,5.24,h,0],
    [5.15,1.35,-4.25,5.24,2.09,-2.45],[5.15,3.02,-4.25,5.24,h,-2.45],
    [2.45,1.73,0,3.70,h,.09],[3.70,1.35,0,5.15,2.09,.09],[3.70,3.02,0,5.15,h,.09]
  ];
  const ceiling = [
    [0,h,-4.50,5.15,h+.06,0], [0,h,-7.78,1.2,h+.06,-4.50],
    // The perimeter return and shallow setback are visible in the room photographs.
    [0,3.315,-4.50,.14,h,0], [2.31,3.315,-4.50,2.45,h,0],
    [.14,3.315,-4.50,2.31,h,-4.36], [.14,3.315,-.14,2.31,h,0],
  ];
  const panes = [], frames = [];
  // Reconstruct the window surfaces only within their recorded floor-plan openings.
  function windowX(x,z0,z1,lo,hi) {
    panes.push([x,lo,z0,x+.006,hi,z1]);
    const d=.022;
    for(const y of [lo,hi-d])frames.push([x-.006,y,z0,x+.019,y+d,z1]);
    for(const z of [z0,(z0+z1)/2,z1-d])frames.push([x-.006,lo,z,x+.019,hi,z+d]);
  }
  windowX(-.049,-7.23,-5.18,.84,2.20);
  windowX(1.244,-7.32,-6.42,.84,2.20);
  windowX(5.197,-4.25,-2.45,2.09,3.02);
  panes.push([3.7,2.09,.042,5.15,3.02,.048]);
  for(const y of [2.09,3.00])frames.push([3.7,y,.034,5.15,y+.02,.056]);
  for(const x of [3.70,4.415,5.13])frames.push([x,2.09,.034,x+.02,3.02,.056]);
  architecture = Object.fromEntries(Object.entries({accent,companion,secondary,ceiling,panes,frames})
    .map(([key, rows]) => [key, boxes(rows)]));
  // A little diffuse occlusion behind the arch keeps the depth of the narrow
  // unlit side room legible when the broad ambient shop light is raised.
  const sideWalls=architecture.secondary;
  const positions=sideWalls.getAttribute('position');
  const colours=new Float32Array(positions.count*3);
  for (let i=0; i<positions.count; i++) {
    const depth=THREE.MathUtils.clamp((-positions.getZ(i)-4.51)/3.15,0,1);
    const bounce=1-depth*.29;
    colours.set([bounce,bounce,bounce],i*3);
  }
  sideWalls.setAttribute('color', new THREE.BufferAttribute(colours,3));
  return architecture;
}

export function makeEnclosure(asset) {
  const group = new THREE.Group(), shell = measureShell(), sources = tintSources(asset);
  group.name = 'Eye-level interior ceiling and wall returns';
  group.visible = false;
  // Picking and automatic cutaway framing can exclude this entire subtree.
  group.userData.eyeLevelOnly = true;
  const fallback = {accent: plaster('#a0a98b','Accent wall continuation'),
    companion: plaster('#e7decb','Companion wall continuation')};
  const parts = {};
  function panel(key, material, name) {
    const m = new THREE.Mesh(shell[key], material);
    m.name = name;
    m.receiveShadow = true;
    // Let the existing broad-area lighting continue to approximate indirect light
    // inside the ceiling. Original model pieces retain their own shadow settings.
    parts[key]=m;group.add(m);return m;
  }
  panel('accent',fallback.accent,'Accent plaster above sectional cut');
  panel('companion',fallback.companion,'Entrance header and shelf-wall plaster');
  panel('ceiling',plaster('#efece4','Warm white gypsum'),'Shop ceiling and perimeter step');
  const sidePaint=plaster('#e5dfd3','Side-room plaster');sidePaint.vertexColors=true;
  panel('secondary',sidePaint,'Rear and mezzanine wall returns');
  const daylightGlass = new THREE.MeshStandardMaterial({name:'Daylit window glass',color:'#b6c4bc',
    emissive:'#e0e5dc',emissiveIntensity:.40,roughness:.37,metalness:.10});
  panel('panes',daylightGlass,'Glazing in side-room and mezzanine windows');
  panel('frames',plaster('#675f53','Window reveals'),'Window frames');
  function update({accent='#a0a98b',companion='#e7decb',daylight=62}={}) {
    for(const [key,colour] of Object.entries({accent,companion})) {
      // Reuse the live model's textured walls where available so scale and colour
      // exactly match on either side of the former cut line.
      if(sources[key]?.material?.name==='Interior plaster') parts[key].material=sources[key].material;
      else {fallback[key].color.set(colour);parts[key].material=fallback[key];}
    }
    const sun=THREE.MathUtils.clamp(Number(daylight)/100,0,1);
    daylightGlass.emissiveIntensity=.16+.47*sun;
  }
  update();
  return {group, update};
}
