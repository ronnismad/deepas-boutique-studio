import {finishOptions} from './finishes.js';
import {lightingOptions} from './lighting.js';
import {collections,dyes,fabrics,motifs,seats} from './merchandise.js';

export const defaults={
  floor:'limestone',wall:'sage',wood:'walnut',top:'ivory',metal:'original',
  collection:'jewel',outfitLeft:'ruby',outfitRight:'peacock',cloth:'silk',motif:'buti',seat:'saddle',
  light:'cove',kelvin:3500,intensity:100,shelf:75,daylight:50,displayLight:75,cashLight:75,beamSpread:100,
  customWall:'#a0aa8d',customCompanion:'#efe7d8'
};
export const groups=[
  ['floor','Floor','finishes',finishOptions.floors,true],['wall','Wall palette','finishes',finishOptions.walls,true],
  ['wood','Timber','finishes',finishOptions.woods,true],['top','Countertops','finishes',finishOptions.tops,false],
  ['metal','Metal fittings','finishes',finishOptions.metals,false],['seat','Stool upholstery','finishes',seats,false],
  ['collection','Shelf collection','display',collections,true],['outfitLeft','Left mannequin','display',dyes,false],
  ['outfitRight','Right mannequin','display',dyes,false],['cloth','Fabric finish','display',fabrics,true],
  ['motif','Woven motif','display',motifs,true]
];
export const ranges=[
  ['kelvin','Colour temperature',2300,7500,100,' K'],['intensity','Fixture brightness',0,150,1,'%'],
  ['daylight','Street daylight',0,100,1,'%'],['shelf','Shelf lighting',0,100,1,'%'],
  ['displayLight','Window display',0,150,1,'%'],['cashLight','Cash counter',0,150,1,'%'],
  ['beamSpread','Spot beam width',60,140,1,'%']
];
export const catalog=Object.fromEntries(groups.map(([id,,,list])=>[id,list]));catalog.light=lightingOptions;
const options=Object.fromEntries(Object.entries(catalog).map(([k,v])=>[k,new Set(v.map(e=>e.id))]));
const keys=Object.keys(defaults);
export function sameDesign(a,b){return keys.every(k=>a[k]===b[k]);}
export function validState(raw){
  if(!raw||typeof raw!=='object')return {...defaults};
  const state={...defaults};
  for(const [id,valid] of Object.entries(options)){
    if(valid.has(raw[id])||(id==='wall'&&raw[id]==='custom'))state[id]=raw[id];
  }
  for(const [id,,min,max,step] of ranges){
    if(Number.isFinite(raw[id]))state[id]=Math.min(max,Math.max(min,Math.round(raw[id]/step)*step));
  }
  for(const id of ['customWall','customCompanion'])if(/^#[0-9a-f]{6}$/i.test(raw[id]||''))state[id]=raw[id];
  return state;
}
export const looks=[
  ['Daylight & sage','diffuse',{light:'cove',kelvin:3500,daylight:70,shelf:70}],
  ['Evening display','track',{light:'track',kelvin:3000,daylight:12,shelf:82,intensity:112}],
  ['Muted rose','rose',{wall:'rose',light:'recessed',kelvin:3300}],
  ['Terracotta','oxide',{floor:'oxide',light:'recessed',kelvin:3300,shelf:78}],
  ['Peacock teal','teal',{wall:'teal',light:'recessed',kelvin:3500}],
  ['Cream terrazzo','terrazzo',{floor:'terrazzo',light:'cove',kelvin:3700}],
  ['Bridal salon',null,{floor:'marble',wall:'wine',wood:'rosewood',top:'carrara',metal:'brass',light:'lanterns',kelvin:2900,collection:'bridal',outfitRight:'ivory',outfitLeft:'wine',cloth:'satin',motif:'floral',seat:'wine',daylight:25}],
  ['Monsoon gallery',null,{floor:'slate',wall:'blueGrey',wood:'limedAsh',top:'slate',metal:'steel',light:'gallery',kelvin:4000,collection:'monsoon',outfitLeft:'sky',outfitRight:'indigo',seat:'ink',motif:'stripe'}],
  ['Coastal linen',null,{floor:'travertine',wall:'celadon',wood:'oak',top:'travertine',metal:'nickel',light:'globes',kelvin:3800,daylight:87,collection:'coast',outfitLeft:'mint',outfitRight:'ivory',cloth:'linen',motif:'plain',seat:'oat'}],
  ['Spice market',null,{floor:'oxide',wall:'saffron',wood:'copperTeak',top:'roseTerrazzo',metal:'copper',light:'pendants',kelvin:3000,collection:'spice',outfitLeft:'copper',outfitRight:'marigold',cloth:'tussar',seat:'ochre',shelf:88}],
  ['Midnight pearls',null,{floor:'checker',wall:'charcoal',wood:'midnightOak',top:'quartz',metal:'graphite',light:'linear',kelvin:4300,daylight:8,collection:'pearl',outfitLeft:'graphite',outfitRight:'ivory',cloth:'satin',motif:'diamond',seat:'black'}],
  ['Orchid atelier',null,{floor:'terrazzo',wall:'lilac',wood:'cherry',top:'ivory',metal:'brass',light:'halos',kelvin:3300,collection:'orchid',outfitLeft:'plum',outfitRight:'lilac',motif:'dot',seat:'blush'}],
  ['Forest handloom',null,{floor:'kota',wall:'forest',wood:'fumedOak',top:'kota',metal:'bronze',light:'wash',kelvin:3650,collection:'heritage',outfitLeft:'emerald',outfitRight:'wine',cloth:'cotton',motif:'check',seat:'forest'}],
  ['Festival window',null,{floor:'athangudi',wall:'champagne',wood:'teak',top:'quartz',metal:'copper',light:'rail',kelvin:3100,collection:'festival',outfitLeft:'magenta',outfitRight:'turquoise',displayLight:142,daylight:18,beamSpread:74}]
];
