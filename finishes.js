import * as THREE from 'three';
import { maps, thumbnails } from './finish-textures.js';
import { patternMaps, patternChips } from './finish-patterns.js';

/*
 * Material source photographs, published by Poly Haven under CC0:
 * https://polyhaven.com/license
 * smoked_walnut_veneer, teak_veneer, oak_veneer_03, rosewood_veneer_02,
 * ash_veneer, cherry_veneer, black_oak_veneer, white_plaster_02,
 * red_sandstone_tiles. Tones and roughness are adjusted for interior finishes.
 * The remaining new stone and cement patterns are authored for this room.
 */

const surface = (id, label, swatch, texture = id) => ({
  id, label, swatch, preview: patternChips[texture] || thumbnails[texture]
});
const palette = (id, label, accent, companion) => ({
  id, label, accent, companion,
  swatch: `linear-gradient(115deg, ${companion} 0% 33%, ${accent} 33% 100%)`
});

export const finishOptions = {
  floors: [
    surface('limestone', 'Ivory limestone', '#dbd2c1'),
    surface('terrazzo', 'Cream terrazzo', '#d8c6b2'),
    surface('oxide', 'Terracotta oxide', '#af5d42'),
    surface('kota', 'Kota green stone', '#687f6f'),
    surface('travertine', 'Vein-cut travertine', '#d2b995'),
    surface('slate', 'Blue-grey slate', '#4a5459'),
    surface('marble', 'Veined white marble', '#d9d9d4'),
    surface('sandstone', 'Rose sandstone', '#bf8e68'),
    surface('cement', 'Encaustic cement tile', '#a3a085'),
    surface('coalTerrazzo', 'Charcoal terrazzo', '#555850'),
    surface('shellTerrazzo', 'Shell-pink terrazzo', '#ccb09c'),
    surface('blackGranite', 'Black pepper granite', '#444445'),
    surface('concrete', 'Mist microcement', '#adac9e'),
    surface('checker', 'Marble checkerboard', '#98968d'),
    surface('parquet', 'Basketweave parquet', '#99774e'),
    surface('brick', 'Staggered clay pavers', '#b57556'),
    surface('athangudi', 'Indigo floral cement tile', '#9dada4'),
    surface('mosaic', 'Sea-glass mosaic', '#6d8b7c')
  ],
  walls: [
    palette('sage', 'Ivory & sage', '#a0a98b', '#e7decb'),
    palette('rose', 'Ivory & dusty rose', '#c0958d', '#e7decb'),
    palette('teal', 'Oyster & peacock teal', '#39615f', '#e2e0d6'),
    palette('indigo', 'Chalk & indigo', '#384668', '#e9e6de'),
    palette('saffron', 'Linen & saffron', '#bf9454', '#ece0c9'),
    palette('celadon', 'Porcelain & celadon', '#9cb7a7', '#e5e9e0'),
    palette('plum', 'Blush & dried plum', '#765b6d', '#eadfdc'),
    palette('clay', 'Sand & burnt clay', '#aa6d51', '#e3d3b6'),
    palette('denim', 'Shell & dusty blue', '#8499aa', '#e5e0d8'),
    palette('olive', 'Flax & olive', '#7c8261', '#e5ddc8'),
    palette('cocoa', 'Ecru & cocoa', '#826957', '#e8decc'),
    palette('champagne', 'Almond & champagne', '#cbb99f', '#f0e8d9'),
    palette('stone', 'Pearl & warm stone', '#acaaa1', '#e9e6de'),
    palette('charcoal', 'Parchment & graphite', '#575e60', '#e4dfce'),
    palette('wine', 'Oat & mulberry', '#763d54', '#e8d9c3'),
    palette('forest', 'Linen & forest green', '#465d4b', '#ece2cf'),
    palette('ochre', 'Sand & marigold', '#bc833c', '#f0dec1'),
    palette('aubergine', 'Pearl & aubergine', '#524356', '#e1d9d8'),
    palette('cobalt', 'Milk & ink blue', '#284b70', '#eee6d9'),
    palette('lagoon', 'Shell & lagoon', '#4a8e91', '#e9e2cf'),
    palette('copper', 'Flax & copper', '#a5583d', '#deccac'),
    palette('linen', 'Chalk & flax linen', '#c1ad8d', '#efe8dc'),
    palette('lilac', 'Ivory & wisteria', '#a69ab2', '#e9e2d6'),
    palette('pink', 'Petal & watermelon', '#b9777c', '#f1dbce'),
    palette('blueGrey', 'Fog & storm blue', '#637784', '#d5d7d3'),
    palette('celery', 'Almond & pistachio', '#aeb78b', '#e8dfc8')
  ],
  woods: [
    surface('walnut', 'Smoked walnut', '#724f3c'),
    surface('teak', 'Honey teak', '#a46f3d'),
    surface('oak', 'Natural oak', '#ba9971'),
    surface('rosewood', 'Rosewood', '#7e4232'),
    surface('ash', 'Pale ash', '#d0c2a1'),
    surface('cherry', 'Warm cherry', '#a76448'),
    surface('ebony', 'Ebonised oak', '#403c37'),
    surface('fumedOak', 'Fumed oak', '#705e4a'),
    surface('limedAsh', 'Whitewashed ash', '#e0daca'),
    surface('copperTeak', 'Copper-stained teak', '#925534'),
    surface('midnightOak', 'Ink-stained oak', '#495259'),
    surface('oliveAsh', 'Olive-stained ash', '#8d8d65'),
    surface('espressoWalnut', 'Espresso walnut', '#44382f'),
    surface('russetCherry', 'Russet cherry', '#835340')
  ],
  tops: [
    surface('ivory', 'Ivory limestone', '#efe2cc', 'limestone'),
    surface('carrara', 'Veined white marble', '#dad9d3', 'marble'),
    surface('granite', 'Black pepper granite', '#474744', 'blackGranite'),
    surface('travertine', 'Honed travertine', '#c6b192', 'travertine'),
    surface('kota', 'Kota green stone', '#708575', 'kota'),
    surface('charcoalTerrazzo', 'Charcoal terrazzo', '#555850', 'coalTerrazzo'),
    surface('roseTerrazzo', 'Shell-pink terrazzo', '#ceb29c', 'shellTerrazzo'),
    surface('slate', 'Polished slate', '#515a5a', 'slate'),
    surface('walnutSlab', 'Oiled walnut', '#805941', 'walnut'),
    surface('quartz', 'Milk-white quartz', '#f0ebe0')
  ],
  metals: [
    surface('original', 'Original mixed metals', 'linear-gradient(115deg, #46544f 55%, #c5aa72 55%)'),
    surface('brass', 'Brushed brass', '#c3a46a'),
    surface('bronze', 'Antique bronze', '#796044'),
    surface('copper', 'Satin copper', '#c38466'),
    surface('steel', 'Brushed steel', '#b6b8b3'),
    surface('nickel', 'Warm nickel', '#c3bda8'),
    surface('graphite', 'Graphite powder coat', '#464b49'),
    surface('cream', 'Ivory powder coat', '#e6dfcf')
  ]
};

const walls = new Map(finishOptions.walls.map(s => [s.id, s]));
const woodIds = new Set(finishOptions.woods.map(s => s.id));
const topIds = new Set(finishOptions.tops.map(s => s.id));
const metalIds = new Set(finishOptions.metals.map(s => s.id));
const floorIds = new Set(finishOptions.floors.map(s => s.id));
const timberScopes = new Set([
  'Cash counter - flush to pillar and wall',
  'Central sales counter and seating',
  'Inward-facing saree shelf'
]);

function texture(manifest, type, repeat = 1, seamless = false) {
  const loader = new THREE.TextureLoader();
  return loader.loadAsync(manifest[type]).then(t => {
    t.colorSpace = type === 'c' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.flipY = false;
    // Mirrored wrapping keeps the prepared material continuous across boards.
    t.wrapS = t.wrapT = seamless ? THREE.RepeatWrapping : THREE.MirroredRepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 8;
    return t;
  });
}

const repeats = { kota: 0.55, travertine: 0.64, slate: 0.51, marble: 0.37, sandstone: 0.56, cement: 0.65 / 0.225, plaster: 0.64 };
const newFloors = {
  coalTerrazzo: [.70, .63], shellTerrazzo: [.75,.68], blackGranite: [.66,.53],
  concrete: [.45,.89], checker: [1.08,.61], parquet: [.65,.66],
  brick: [1.27,.93], athangudi: [1.625,.77], mosaic: [1.09,.51]
};
const continuous = new Set(['oxide','cement', ...Object.keys(newFloors)]);
const woodStains = {
  fumedOak: ['oak','#8a7360'], limedAsh: ['ash','#ffffff'], copperTeak: ['teak','#e3ad8e'],
  midnightOak: ['oak','#5d6c74'], oliveAsh: ['ash','#9a9b74'],
  espressoWalnut: ['walnut','#827164'], russetCherry: ['cherry','#b78a80']
};
const metalFinish = {
  brass: ['#d9b77d',.82,.36], bronze:['#927152',.79,.46], copper:['#d99875',.83,.34],
  steel:['#c8cecc',.84,.38], nickel:['#d7cbb2',.86,.31],
  graphite:['#424746',.17,.58], cream:['#ede6d5',.11,.55]
};
let libraryPromise;

async function materialLibrary() {
  if (libraryPromise) return libraryPromise;
  libraryPromise = (async () => {
    const manifests = {...maps, ...patternMaps};
    const entries = await Promise.all(Object.entries(manifests).map(async ([name, manifest]) => {
      const repeat = newFloors[name]?.[0] ?? repeats[name] ?? 1;
      const [albedo, normal, roughness] = await Promise.all(
        ['c', 'n', 'r'].map(type => manifest[type] ? texture(manifest, type, repeat, !!newFloors[name]) : null)
      );
      return [name, { albedo, normal, roughness }];
    }));
    const textures = new Map(entries);
    const woods = new Map(), stones = new Map();
    for (const id of woodIds) {
      const [base, stain] = woodStains[id] || [id, '#ffffff'];
      const t = textures.get(base);
      const light = new THREE.MeshPhysicalMaterial({
        name: finishOptions.woods.find(w => w.id === id).label,
        side: THREE.DoubleSide, color: stain, map: textures.get(id)?.albedo || t.albedo, normalMap: t.normal, normalScale: new THREE.Vector2(0.21, -0.21),
        roughnessMap: t.roughness, roughness: .81, metalness: 0, clearcoat: .11, clearcoatRoughness: .44
      });
      const dark = light.clone();
      dark.color.multiply(new THREE.Color('#c6bbad'));
      woods.set(id, { light, dark });
    }
    const stoneRoughness = { kota: .88, travertine: .84, slate: .93, marble: .58, sandstone: .96, cement: .84 };
    for (const [id, [, roughness]] of Object.entries(newFloors)) stoneRoughness[id] = roughness;
    for (const id of Object.keys(stoneRoughness)) {
      const t = textures.get(id);
      stones.set(id, new THREE.MeshStandardMaterial({
        name: finishOptions.floors.find(f => f.id === id).label,
        side: THREE.DoubleSide, map: t.albedo, normalMap: t.normal,
        normalScale: new THREE.Vector2(.54, -.54), roughnessMap: t.roughness,
        roughness: stoneRoughness[id], metalness: 0 
      }));
    }
    const tops = new Map();
    const topStones = {carrara:'marble',granite:'blackGranite',travertine:'travertine',kota:'kota',
      charcoalTerrazzo:'coalTerrazzo',roseTerrazzo:'shellTerrazzo',slate:'slate'};
    for(const [id,stone] of Object.entries(topStones)){
      const mat=stones.get(stone).clone();
      mat.name=finishOptions.tops.find(s=>s.id===id).label;
      mat.roughness*=.84; tops.set(id,mat);
    }
    tops.set('walnutSlab',woods.get('walnut').light);
    tops.set('quartz',new THREE.MeshStandardMaterial({name:'Milk-white quartz',color:'#f1ecdf',roughness:.36,metalness:.025}));
    const metals = new Map(Object.entries(metalFinish).map(([id,[color,metalness,roughness]])=>[
      id,new THREE.MeshStandardMaterial({name:finishOptions.metals.find(s=>s.id===id).label,color,metalness,roughness})
    ]));
    return { textures, woods, stones, tops, metals };
  })().catch(error => { libraryPromise = undefined; throw error; });
  return libraryPromise;
}

function metreUVs(geometry, isWood = false) {
  const pos = geometry.attributes.position, normals = geometry.attributes.normal;
  if (!pos || !normals) return;
  const uv = new Float32Array(pos.count * 2);
  const coords = [0, 0, 0];
  const read = (i, a) => a === 0 ? pos.getX(i) : a === 1 ? pos.getY(i) : pos.getZ(i);
  const facing = i => {
    const nx = Math.abs(normals.getX(i)), ny = Math.abs(normals.getY(i)), nz = Math.abs(normals.getZ(i));
    return nx > ny && nx > nz ? 0 : ny > nz ? 1 : 2;
  };
  function project(first, end, grainAxis) {
    for (let i = first; i < end; i++) {
      coords[0] = pos.getX(i); coords[1] = pos.getY(i); coords[2] = pos.getZ(i);
      const normalAxis = facing(i);
      if (!isWood) {
        uv[2*i] = coords[normalAxis === 0 ? 2 : 0];
        uv[2*i + 1] = coords[normalAxis === 1 ? 2 : 1];
      } else {
        const along = grainAxis === normalAxis
          ? (normalAxis === 1 ? 2 : 1)
          : grainAxis;
        const cross = 3 - normalAxis - along;
        // Veneer photography spans one metre, with grain running along U.
        uv[2*i] = coords[along] * .96;
        uv[2*i + 1] = coords[cross] * 1.10;
      }
    }
  }
  if (!isWood) project(0, pos.count, 0);
  else {
    // Each shelf board, carcass and leg has its own grain direction. The
    // original GLB serialises each rectangular solid as twelve flat triangles.
    for (let i = 0; i < pos.count;) {
      let count = 3, grain = facing(i) === 1 ? 2 : 1;
      if (i + 36 <= pos.count) {
        const planes = new Set();
        for (let j = i; j < i + 36; j += 3) {
          const axis = facing(j), n0 = normals.getComponent(j, axis);
          if (Math.abs(n0) > .9999) planes.add(axis * 2 + Number(n0 > 0));
        }
        if (planes.size === 6) {
          const lo = [Infinity,Infinity,Infinity], hi = [-Infinity,-Infinity,-Infinity];
          for (let k = i; k < i + 36; k++) for (let a = 0; a < 3; a++) {
            const v = read(k, a); lo[a] = Math.min(lo[a], v); hi[a] = Math.max(hi[a], v);
          }
          const ext = hi.map((v, a) => v - lo[a]), longest = Math.max(...ext);
          grain = ext[1] >= .85 * longest ? 1 : ext.indexOf(longest);
          count = 36;
        }
      }
      project(i, i + count, grain);
      i += count;
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function plasterMaterial(t, colour) {
  return new THREE.MeshStandardMaterial({
    name: 'Interior plaster', side: THREE.DoubleSide,
    color: new THREE.Color(colour), map: t.albedo, normalMap: t.normal,
    normalScale: new THREE.Vector2(.13, -.13), roughnessMap: t.roughness, roughness: .96, metalness: 0
  });
}

const validHex = (v, fallback) => /^#[a-f\d]{6}$/i.test(v || '') ? v : fallback;
export async function createFinishes(asset) {
  const library = await materialLibrary();
  const parser = asset.parser, doc = parser.json;
  const lookup = new Map(doc.materials.map((m, i) => [m.name, i]));
  const material = name => parser.getDependency('material', lookup.get(name));
  const [terrazzo, oxide, border] = await Promise.all(['Cream terrazzo', 'Terracotta red oxide', 'Oxide floor ivory border'].map(material));
  const plaster = library.textures.get('plaster');
  const accent = plasterMaterial(plaster, walls.get('sage').accent);
  const companion = plasterMaterial(plaster, walls.get('sage').companion);
  const floorRows = [], borderRows = [], woodRows = [], topRows = [], metalRows = [];
  let floorSurface;
  asset.scene.traverse(node => {
    if (!node.isMesh) return;
    if(node.material.name==='brushed brass' && ['Folded and hanging silk','Upholstered counter stools'].includes(node.parent?.name)){
      metalRows.push({node,base:node.material});
      return;
    }
    if (node.userData.boutiqueWoodRole) {
      woodRows.push({ node, role: node.userData.boutiqueWoodRole === 'dark' ? 'dark' : 'light' });
      return;
    }
    const a = parser.associations.get(node);
    if (a?.primitives === undefined) return;
    const mesh = doc.meshes[a.meshes], primitive = mesh.primitives[a.primitives];
    const src = doc.materials[primitive.material].name, group = mesh.name;
    if (group === 'Room shell and flooring' && src.startsWith('Honed warm stone')) {
      floorRows.push({ node, base: node.material });
    } else if (group === 'Seamless red oxide finish and narrow ivory border') {
      const mappings = primitive.extensions?.KHR_materials_variants?.mappings ?? [];
      const includesBorder = mappings.some(mapping => doc.materials[mapping.material].name === 'Oxide floor ivory border');
      if(includesBorder){node.receiveShadow=true;borderRows.push({node,material:border});}
      else {
        // This is the original full-room oxide slab. Its UVs span 1.6 metres;
        // the tiled shell maps one repeat to .65 m. Keep each finish at its intended scale.
        const neutral=node.geometry.clone(), uv=neutral.attributes.uv;
        for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*1.6/.65,uv.getY(i)*1.6/.65);
        // The source placeholder is transparent; opaque flooring must receive
        // the shadows from footsteps, the counter, stools and storefront.
        node.receiveShadow=true;
        floorSurface={node,original:node.geometry,neutral};
      }
    } else if(timberScopes.has(group) && src.startsWith('Honed warm stone')){
      topRows.push({node,base:node.material});
    } else if(group.startsWith('Sliding entrance -') && (src==='#4d5954'||src==='#c4a35e')){
      metalRows.push({node,base:node.material});
    } else if(group==='Mirror 1 - right partition opposite shelf' && src==='#aaa99a'){
      metalRows.push({node,base:node.material});
    } else if (src === 'Ivory and sage' || src === 'Warm ivory plaster') {
      metreUVs(node.geometry);
      node.material = src === 'Ivory and sage' ? accent : companion;
    } else if (timberScopes.has(group) && src.startsWith('Smoked walnut')) {
      metreUVs(node.geometry, true);
      woodRows.push({ node, role: src.endsWith('#503c31') ? 'dark' : 'light' });
    }
  });

  let lastFloor, lastWood, lastTop, lastMetal, lastAccent, lastCompanion;
  return function applyFinishes({ floor = 'limestone', wall = 'sage', wood = 'walnut', top='ivory', metal='original', customWall, customCompanion } = {}) {
    if (!floorIds.has(floor)) floor = 'limestone';
    if (!woodIds.has(wood)) wood = 'walnut';
    if(!topIds.has(top))top='ivory';
    if(!metalIds.has(metal))metal='original';
    if (floor !== lastFloor) {
      const sheet = !!floorSurface && continuous.has(floor);
      for (const row of floorRows) {
        row.node.visible = !sheet;
        row.node.material = floor === 'limestone' ? row.base : floor === 'terrazzo' ? terrazzo
          : floor === 'oxide' ? oxide : library.stones.get(floor);
      }
      if(floorSurface){
        const {node,original,neutral}=floorSurface;
        node.visible=sheet;
        node.geometry=floor==='oxide'?original:neutral;
        node.material=floor==='oxide'?oxide:(library.stones.get(floor)||oxide);
      }
      for (const row of borderRows) {
        row.node.visible = floor === 'oxide';
        row.node.material = row.material;
      }
      lastFloor = floor;
    }
    const scheme = walls.get(wall) || walls.get('sage');
    const a=wall==='custom'?validHex(customWall,scheme.accent):scheme.accent;
    const c=wall==='custom'?validHex(customCompanion,scheme.companion):scheme.companion;
    if(a!==lastAccent){accent.color.set(a);lastAccent=a;}
    if(c!==lastCompanion){companion.color.set(c);lastCompanion=c;}
    if(top!==lastTop){
      for(const row of topRows)row.node.material=top==='ivory'?row.base:library.tops.get(top);
      lastTop=top;
    }
    if(metal!==lastMetal){
      for(const row of metalRows)row.node.material=metal==='original'?row.base:library.metals.get(metal);
      lastMetal=metal;
    }
    if (wood !== lastWood) {
      for (const row of woodRows) row.node.material = library.woods.get(wood)[row.role];
      lastWood = wood;
    }
  };
}
