import {finishOptions} from './finishes.js';
import {lightingOptions} from './lighting.js';
export const $=id=>document.getElementById(id);
const icons={
 plus:'M12 5v14m-7-7h14',minus:'M5 12h14',reset:'M4 11a8 8 0 1 1 2 6M4 5v6h6',
 download:'M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4',bookmark:'M6 3h12v18l-6-4-6 4z',
 cut:'M3 9l9-5 9 5-9 5zm0 0v8l9 5 9-5V9m-9 5v8',shop:'M3 7h18l-2-4H5zm1 1v12h16V8M7 12h4v8m3-8h3v4h-3z',
 aisle:'M3 4l6 5v7l-6 4zm18 0-6 5v7l6 4zm-12 5h6m-6 7h6',rear:'M4 7h12a4 4 0 0 1 0 8H9m-5-8 4-4m-4 4 4 4',
 plan:'M3 3h8v5h10v13H3zm8 5v6m0 3v4M3 14h5', check:'m4 12 5 5L20 6'
};
function icon(key){const NS='http://www.w3.org/2000/svg';const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.classList.add('ico');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(NS,'path');p.setAttribute('d',icons[key]);svg.append(p);return svg;}
const cameraViews=[['cutaway','Cutaway','cut'],['front','Entrance','shop'],['aisle','Inside','aisle'],['rear','Reverse','rear'],['plan','Plan','plan']];
export const defaults={floor:'limestone',wall:'sage',wood:'walnut',light:'cove',kelvin:3500,intensity:100,shelf:75,daylight:50,customWall:'#a0aa8d',customCompanion:'#efe7d8'};
const ranges=[['kelvin','Colour temperature',2300,7500,100,' K'],['intensity','Fixture brightness',0,150,1,'%'],['shelf','Shelf glow',0,100,1,'%'],['daylight','Daylight',0,100,1,'%']];
const presets=[
 ['Daylight & sage','diffuse',{light:'cove',kelvin:3500,daylight:70,shelf:70}],
 ['Evening display','track',{light:'track',kelvin:3000,daylight:12,shelf:82,intensity:112}],
 ['Muted rose','rose',{wall:'rose',light:'recessed',kelvin:3300}],
 ['Terracotta','oxide',{floor:'oxide',light:'recessed',kelvin:3300,shelf:78}],
 ['Peacock teal','teal',{wall:'teal',light:'recessed',kelvin:3500}],
 ['Cream terrazzo','terrazzo',{floor:'terrazzo',light:'cove',kelvin:3700}]
];
const key='boutique-studio-designs-v2';
const arrayFor={floor:finishOptions.floors,wall:finishOptions.walls,wood:finishOptions.woods,light:lightingOptions};
export function validState(raw={}){
 const result={...defaults};
 for(const [prop,list] of Object.entries(arrayFor)){
   if(list.some(x=>x.id===raw[prop])||(prop==='wall'&&raw.wall==='custom'))result[prop]=raw[prop];
 }
 for(const [prop,,min,max,step] of ranges){if(Number.isFinite(raw[prop]))result[prop]=Math.min(max,Math.max(min,Math.round(raw[prop]/step)*step));}
 for(const prop of ['customWall','customCompanion'])if(/^#[0-9a-f]{6}$/i.test(raw[prop]||''))result[prop]=raw[prop];
 return result;
}
let toastTimer;
export function toast(message){const e=$('toast');e.textContent=message;e.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.hidden=true,3400);}
function el(tag,cls,txt){const a=document.createElement(tag);if(cls)a.className=cls;if(txt)a.textContent=txt;return a;}
function btn(cls,txt,fn){const b=el('button',cls,txt);b.type='button';b.addEventListener('click',fn);return b;}
function titleGroup(name){const t=el('div','group-title');t.append(el('h2','',name));return t;}
function option(select,value,label){const o=el('option','',label);o.value=value;select.append(o);}
export function initUI(api){
 document.querySelectorAll('[data-icon]').forEach(node=>node.replaceWith(icon(node.dataset.icon)));
 const bind={};
 for(const [kind,groupName] of [['floor','Floor'],['wall','Wall palette'],['wood','Timber']]){
  const list=arrayFor[kind],section=el('div','group'),title=titleGroup(groupName),value=el('span','value');
  title.append(value);section.append(title);
  const chips=el('div','swatches');chips.dataset.kind=kind;chips.setAttribute('role','group');chips.setAttribute('aria-label',groupName);
  for(const item of list){const b=btn('chip','',()=>api.change({[kind]:item.id}));b.setAttribute('aria-label',item.label);b.dataset.id=item.id;
   if(item.preview)b.style.backgroundImage='url("'+item.preview+'")';else b.style.background=item.swatch;b.title=item.label;chips.append(b);}
  const select=el('select','selectbox');select.id=kind;select.setAttribute('aria-label',groupName);
  for(const item of list)option(select,item.id,item.label);if(kind==='wall')option(select,'custom','Custom colours');
  select.onchange=()=>api.change({[kind]:select.value});section.append(chips,select);
  if(kind==='wall'){
   const row=el('div','custom-paints');
   for(const [prop,label] of [['customWall','Accent'],['customCompanion','Companion']]){
    const e=el('label','',label);
    const c=el('input');c.id=prop;c.type='color';c.title='Choose '+label.toLowerCase()+' paint colour';c.addEventListener('input',()=>api.change({wall:'custom',customWall:$('customWall').value,customCompanion:$('customCompanion').value}));e.prepend(c);row.append(e);
   }section.append(row);
  }
  $('finish-controls').append(section);bind[kind]={chips,select,value,list};
 }
 for(const mode of lightingOptions){const b=btn('',mode.label,()=>api.change({light:mode.id,kelvin:mode.kelvin}));b.dataset.id=mode.id;$('light-options').append(b);}
 for(const [id,name,min,max,step,unit] of ranges){
  const e=el('label','range'),title=el('span','rlabel',name),out=el('output');out.id=id+'-value';title.append(out);const input=el('input');input.type='range';input.id=id;input.min=min;input.max=max;input.step=step;input.name=id;input.setAttribute('aria-label',name);input.addEventListener('input',()=>api.change({[id]:Number(input.value)}));out.htmlFor=id; e.append(title,input);$('ranges').append(e);
 }
 $('reset-lights').onclick=()=>{const m=lightingOptions.find(x=>x.id===api.current().light);api.change({kelvin:m.kelvin,intensity:defaults.intensity,shelf:defaults.shelf,daylight:defaults.daylight});};
 const refs=JSON.parse($('referenceData').textContent);
 for(const [label,k,settings] of presets){const b=btn('look','',()=>{api.change({...defaults,...settings});toast(label+' applied');});const img=el('img');img.alt='';img.src='data:image/jpeg;base64,'+refs[k];b.append(img,el('span','',label));$('presets').append(b);}
 for(const [id,label,ic] of cameraViews){const b=btn('',label,()=>api.camera(id));b.id='camera-'+id;b.prepend(icon(ic));$('view-nav').append(b);}
 const detail=el('select','camera-details');detail.id='camera-details';detail.setAttribute('aria-label','Detail views');
 option(detail,'','Details');for(const [id,label] of [['display','Saree display'],['till','Cash counter'],['arch','Arch & transom']])option(detail,id,label);
 detail.addEventListener('change',()=>api.camera(detail.value||'cutaway'));$('view-nav').append(detail);
 function tab(key){for(const k of ['finishes','lighting','looks']){const active=key===k;$('tab-'+k).setAttribute('aria-selected',String(active));$('panel-'+k).hidden=!active;}}
 for(const k of ['finishes','lighting','looks'])$('tab-'+k).onclick=()=>tab(k);
 $('jump-save').onclick=()=>{tab('looks');$('design-name').focus();};
 let saved=[];try{const a=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(a))saved=a.filter(v=>v&&typeof v.name==='string'&&v.state).map(v=>({name:v.name.slice(0,52),state:validState(v.state)}));}catch{}
 function persist(){try{localStorage.setItem(key,JSON.stringify(saved));return true;}catch{return false;}}
 function listSaved(){$('saved').replaceChildren();saved.forEach((v,i)=>{const row=el('div','saved');const use=btn('use',v.name,()=>{api.change(v.state);toast('Applied '+v.name);});const remove=btn('delete','Remove',()=>{const prev=saved.slice();saved.splice(i,1);if(!persist()){saved=prev;toast('Browser storage is unavailable');}listSaved();});remove.setAttribute('aria-label','Remove '+v.name);row.append(use,remove);$('saved').append(row);});}
 $('save-form').onsubmit=e=>{e.preventDefault();const name=$('design-name').value.trim();if(!name)return;const prev=saved.slice();const idx=saved.findIndex(v=>v.name.toLowerCase()===name.toLowerCase());if(idx!==-1){toast('That name is already saved. Choose a new name.');return;}saved.push({name,state:{...api.current()}});if(!persist()){saved=prev;toast('This browser could not save the design');return;}$('design-name').value='';listSaved();toast('Design saved');};listSaved();
 $('export').onclick=api.exportPNG;$('live').onclick=()=>api.quality('live');$('trace').onclick=()=>api.quality('trace');
 $('zoom-in').onclick=()=>api.zoom(1.18);$('zoom-out').onclick=()=>api.zoom(1/1.18);$('reset').onclick=api.reset;
 return {
  sync(s){
   for(const kind of ['floor','wood','wall']){
    const b=bind[kind],v=b.list.find(x=>x.id===s[kind]);b.value.textContent=v?.label||'Custom colours';b.select.value=s[kind];
    for(const chip of b.chips.children)chip.setAttribute('aria-pressed',String(chip.dataset.id===s[kind]));
    if(kind==='wall'){$('customWall').value=v?.accent||s.customWall;$('customCompanion').value=v?.companion||s.customCompanion;}
   }
   for(const b of $('light-options').children)b.setAttribute('aria-pressed',String(b.dataset.id===s.light));
   for(const [id,,min,max,,unit] of ranges){$(id).value=s[id];$(id).style.setProperty('--pct',(s[id]-min)/(max-min)*100+'%');$(id+'-value').textContent=s[id].toLocaleString('en-IN')+unit;}
  },
  selectView(k){detail.value=['display','till','arch'].includes(k)?k:'';detail.classList.toggle('selected',!!detail.value);for(const [id] of cameraViews)$('camera-'+id).setAttribute('aria-pressed',String(id===k));},
  quality(k){$('trace').setAttribute('aria-pressed',String(k==='trace'));$('live').setAttribute('aria-pressed',String(k==='live'));$('sample').hidden=k!=='trace';}
 };
}
