import {defaults,validState,groups,catalog,ranges} from './choices.js';
import {initDesigns,historyControls} from './design-tools.js';
export {defaults,validState};
import {lightingOptions} from './lighting.js';
export const $=id=>document.getElementById(id);
const icons={
 undo:'M4 10h9a6 6 0 0 1 0 12M4 10l5-5m-5 5 5 5',redo:'M20 10h-9a6 6 0 0 0 0 12m9-12-5-5m5 5-5 5',
 plus:'M12 5v14m-7-7h14',minus:'M5 12h14',reset:'M4 11a8 8 0 1 1 2 6M4 5v6h6',
 download:'M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4',bookmark:'M6 3h12v18l-6-4-6 4z',
 cut:'M3 9l9-5 9 5-9 5zm0 0v8l9 5 9-5V9m-9 5v8',shop:'M3 7h18l-2-4H5zm1 1v12h16V8M7 12h4v8m3-8h3v4h-3z',
 aisle:'M3 4l6 5v7l-6 4zm18 0-6 5v7l6 4zm-12 5h6m-6 7h6',rear:'M4 7h12a4 4 0 0 1 0 8H9m-5-8 4-4m-4 4 4 4',
 plan:'M3 3h8v5h10v13H3zm8 5v6m0 3v4M3 14h5', check:'m4 12 5 5L20 6'
};
function icon(key){const NS='http://www.w3.org/2000/svg';const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.classList.add('ico');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(NS,'path');p.setAttribute('d',icons[key]);svg.append(p);return svg;}
const cameraViews=[['cutaway','Cutaway','cut'],['front','Entrance','shop'],['aisle','Inside','aisle'],['rear','Reverse','rear'],['plan','Plan','plan']];
let toastTimer;
export function toast(message){const e=$('toast');e.textContent=message;e.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.hidden=true,3400);}
function el(tag,cls,txt){const a=document.createElement(tag);if(cls)a.className=cls;if(txt)a.textContent=txt;return a;}
function btn(cls,txt,fn){const b=el('button',cls,txt);b.type='button';b.addEventListener('click',fn);return b;}
function option(select,value,label){const o=el('option','',label);o.value=value;select.append(o);}
const detailsViews=[['display','Saree display'],['till','Cash counter'],['arch','Arch & transom'],['mezzanine','Mezzanine doorway'],['showcase','Window mannequins']];
function bindTabs(){
  const ids=['finishes','display','lighting','looks'];
  function active(key){
    for(const id of ids){
      const show=id===key,b=$('tab-'+id);b.setAttribute('aria-selected',String(show));b.tabIndex=show?0:-1;$('panel-'+id).hidden=!show;
    }
  }
  ids.forEach((id,i)=>{
    const tab=$('tab-'+id);tab.onclick=()=>active(id);
    tab.onkeydown=e=>{
      const direction={ArrowRight:1,ArrowLeft:-1}[e.key];
      if(!direction&&e.key!=='Home'&&e.key!=='End')return;
      e.preventDefault();const next=e.key==='Home'?ids[0]:e.key==='End'?ids.at(-1):ids[(i+ids.length+direction)%ids.length];
      active(next);$('tab-'+next).focus();
    };
  });
  active('finishes');return active;
}
export function initUI(api){
  document.querySelectorAll('[data-icon]').forEach(node=>node.replaceWith(icon(node.dataset.icon)));
  const {change,endGesture}=historyControls(api),tab=bindTabs(),bound={};
  for(const [kind,label,panel,list,open] of groups){
    const section=el('details','material-group');section.open=open;section.dataset.group=kind;
    const summary=el('summary'),value=el('span','value');summary.append(el('span','category-name',label),value);section.append(summary);
    const chips=el('div','swatches'),nodes=new Map();chips.dataset.kind=kind;chips.setAttribute('role','group');chips.setAttribute('aria-label',label);
    const select=el('select','selectbox');select.id=kind;select.setAttribute('aria-label',label);
    for(const item of list){
      const chip=btn('chip','',()=>change({[kind]:item.id}));chip.dataset.id=item.id;chip.title=item.label;chip.setAttribute('aria-label',item.label);
      chip.setAttribute('aria-pressed','false');
      if(item.preview)chip.style.backgroundImage='url("'+item.preview+'")';else chip.style.background=item.swatch;
      chips.append(chip);nodes.set(item.id,chip);option(select,item.id,item.label);
    }
    if(kind==='wall')option(select,'custom','Custom colours');
    select.onchange=()=>change({[kind]:select.value});section.append(chips,select);
    if(kind==='wall'){
      const row=el('div','custom-paints');
      for(const [prop,name] of [['customWall','Accent'],['customCompanion','Companion']]){
        const l=el('label','',name),c=el('input');c.type='color';c.id=prop;c.title=name+' paint colour';
        c.oninput=()=>change({wall:'custom',customWall:$('customWall').value,customCompanion:$('customCompanion').value},prop);
        c.onchange=endGesture;c.onblur=endGesture;l.prepend(c);row.append(l);
      }section.append(row);
    }
    $(panel==='display'?'display-controls':'finish-controls').append(section);
    bound[kind]={nodes,select,section,value,items:new Map(list.map(x=>[x.id,x])),open,label};
  }
  let savedOpen=null;
  $('find-finish').oninput=e=>{
    const query=e.target.value.trim().toLowerCase(),rows=groups.filter(x=>x[2]==='finishes');
    if(query&&!savedOpen)savedOpen=new Map(rows.map(([k])=>[k,bound[k].section.open]));
    let matches=0;
    for(const [k] of rows){
      const b=bound[k],groupMatch=b.label.toLowerCase().includes(query);let any=false;
      for(const [id,chip] of b.nodes){const match=groupMatch||b.items.get(id).label.toLowerCase().includes(query);chip.hidden=!match;any||=match;}
      b.section.hidden=!any;
      if(query&&any)b.section.open=true;else if(!query&&savedOpen)b.section.open=savedOpen.get(k);
      if(any)matches++;
    }
    $('no-finish').hidden=!!matches;if(!query)savedOpen=null;
  };
  const lampButtons=new Map(),rangeControls=new Map();
  for(const mode of lightingOptions){
    const b=btn('',mode.label,()=>change({light:mode.id,kelvin:mode.kelvin}));b.dataset.id=mode.id;b.setAttribute('aria-pressed','false');
    $('light-options').append(b);lampButtons.set(mode.id,b);
  }
  for(const [id,name,min,max,step,unit] of ranges){
    if(id==='shelf')$('ranges').append(el('h3','range-heading','Individual circuits'));
    if(id==='beamSpread')$('ranges').append(el('h3','range-heading','Beam adjustment'));
    const wrap=el('label','range'),head=el('span','rlabel',name),out=el('output');out.id=id+'-value';head.append(out);
    const input=el('input');Object.assign(input,{type:'range',id,min,max,step,name:id});input.setAttribute('aria-label',name);
    input.oninput=()=>change({[id]:Number(input.value)},id);
    input.onchange=endGesture;input.onblur=endGesture;input.onpointerdown=endGesture;
    out.htmlFor=id;wrap.append(head,input);$('ranges').append(wrap);rangeControls.set(id,{input,out,min,max,unit});
  }
  $('reset-lights').onclick=()=>{
    const reset=Object.fromEntries(ranges.map(([id])=>[id,defaults[id]]));reset.kelvin=catalog.light.find(x=>x.id===api.current().light).kelvin;change(reset);
  };
  $('jump-save').onclick=()=>{tab('looks');$('design-name').focus();};
  initDesigns(api,change,toast);
  for(const [id,label,ic] of cameraViews){const b=btn('',label,()=>api.camera(id));b.id='camera-'+id;b.prepend(icon(ic));$('view-nav').append(b);}
  const detail=el('select','camera-details');detail.id='camera-details';detail.setAttribute('aria-label','Detail views');
  option(detail,'','Details');for(const [id,label] of detailsViews)option(detail,id,label);
  detail.onchange=()=>api.camera(detail.value||'cutaway');$('view-nav').append(detail);
  $('export').onclick=api.exportPNG;$('live').onclick=()=>api.quality('live');$('trace').onclick=()=>api.quality('trace');
  const preference='boutique-studio-live-quality';
  try{
    const saved=localStorage.getItem(preference);
    if(['auto','fast','fine'].includes(saved)){$('performance').value=saved;api.performance(saved);}
  }catch{}
  $('performance').onchange=e=>{
    const mode=e.target.value;api.performance(mode);
    try{localStorage.setItem(preference,mode);}catch{}
  };
  $('zoom-in').onclick=()=>api.zoom(1.18);$('zoom-out').onclick=()=>api.zoom(1/1.18);$('reset').onclick=api.reset;
  let prev={},busyTimer;
  return {
    sync(state){
      for(const [k,b] of Object.entries(bound)){
        if(prev[k]===state[k])continue;
        b.nodes.get(prev[k])?.setAttribute('aria-pressed','false');b.nodes.get(state[k])?.setAttribute('aria-pressed','true');
        b.value.textContent=b.items.get(state[k])?.label||'Custom colours';b.select.value=state[k];
      }
      if(prev.wall!==state.wall||prev.customWall!==state.customWall||prev.customCompanion!==state.customCompanion){
        const pair=bound.wall.items.get(state.wall);$('customWall').value=pair?.accent||state.customWall;$('customCompanion').value=pair?.companion||state.customCompanion;
      }
      if(prev.light!==state.light){lampButtons.get(prev.light)?.setAttribute('aria-pressed','false');lampButtons.get(state.light)?.setAttribute('aria-pressed','true');}
      for(const [k,r] of rangeControls){
        if(prev[k]===state[k])continue;
        r.input.value=state[k];r.input.style.setProperty('--pct',(state[k]-r.min)/(r.max-r.min)*100+'%');
        r.out.textContent=state[k].toLocaleString('en-IN')+r.unit;
      }
      prev=state;
    },
    selectView(k){detail.value=detailsViews.some(x=>x[0]===k)?k:'';detail.classList.toggle('selected',!!detail.value);for(const [id] of cameraViews)$('camera-'+id).setAttribute('aria-pressed',String(id===k));},
    quality(k){$('trace').setAttribute('aria-pressed',String(k==='trace'));$('live').setAttribute('aria-pressed',String(k==='live'));$('sample').hidden=k!=='trace';$('performance').disabled=k==='trace';},
    busy(on){clearTimeout(busyTimer);if(!on){$('fixture-status').hidden=true;return;}busyTimer=setTimeout(()=>$('fixture-status').hidden=false,180);}
  };
}
