import {defaults,catalog,validState,looks,sameDesign} from './choices.js';
const storageKey='boutique-studio-designs-v2';
const $=id=>document.getElementById(id);
function button(text,cls,handler){const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;b.onclick=handler;return b;}
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function store(key,obj){try{localStorage.setItem(key,JSON.stringify(obj));return true;}catch{return false;}}

export function initDesigns(api,change,toast) {
  const refs=JSON.parse($('referenceData').textContent);
  for(const [label,photo,recipe] of looks){
    const state=validState({...defaults,...recipe});
    const b=button('','look',()=>{change(state);toast(label+' applied');});
    if(photo){
      const img=document.createElement('img');img.alt='';img.loading='lazy';img.src='data:image/jpeg;base64,'+refs[photo];b.append(img);
    }else{
      const samples=document.createElement('div');samples.className='recipe-colours';samples.setAttribute('aria-hidden','true');
      const swatches=[catalog.wall.find(w=>w.id===state.wall).accent,...catalog.collection.find(c=>c.id===state.collection).colours.slice(0,3)];
      for(const colour of swatches){const dot=document.createElement('i');dot.style.background=colour;samples.append(dot);}b.append(samples);
    }
    const title=document.createElement('span');title.textContent=label;b.append(title);
    if(!photo){const meta=document.createElement('span');meta.className='recipe-meta';meta.textContent=catalog.wood.find(x=>x.id===state.wood).label;b.append(meta);}
    $('presets').append(b);
  }
  $('restore-design').onclick=()=>{change({...defaults});toast('Original design restored');};
  let saved=read(storageKey,[]);
  saved=Array.isArray(saved)?saved.filter(v=>typeof v?.name==='string'&&v.state).map(v=>({name:v.name.slice(0,52),state:validState(v.state)})):[];
  function updateSaved(list){
    if(!store(storageKey,list)){toast('This browser could not save the change');return false;}
    saved=list;listSaved();return true;
  }
  function listSaved(){
    $('saved').replaceChildren();
    for(const [i,v] of saved.entries()){
      const row=document.createElement('div');row.className='saved';
      const use=button(v.name,'use',()=>{change(v.state);toast('Applied '+v.name);});
      const remove=button('Remove','delete',()=>updateSaved(saved.filter((_,j)=>j!==i)));
      remove.setAttribute('aria-label','Remove '+v.name);row.append(use,remove);$('saved').append(row);
    }
  }
  listSaved();$('save-form').onsubmit=e=>{
    e.preventDefault();const name=$('design-name').value.trim();if(!name)return;
    if(saved.some(v=>v.name.toLowerCase()===name.toLowerCase())){toast('That name is already saved. Choose a new name.');return;}
    if(updateSaved([...saved,{name,state:{...api.current()}}])){$('design-name').value='';toast('Design saved');}
  };
  const compareKey='boutique-studio-compare-v1',stored=read(compareKey,{}),slots={};
  for(const id of ['A','B']){
    if(stored?.[id])slots[id]=validState(stored[id]);
    const wrap=document.createElement('div');
    const show=button('View '+id,'action load',()=>{change(slots[id]);toast('Showing '+id);});
    show.id='compare-view-'+id;show.disabled=!slots[id];
    const keep=button('Capture '+id,'action',()=>{slots[id]={...api.current()};show.disabled=false;const persisted=store(compareKey,slots);toast(id+' captured'+(persisted?'':' for this session'));});
    keep.id='compare-capture-'+id;wrap.append(keep,show);$('comparison').append(wrap);
  }

  $('download-design').onclick=()=>{
    const state=api.current(),data=JSON.stringify({format:'boutique-studio',version:1,settings:state},null,2);
    const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),link=document.createElement('a');
    link.href=url;link.download='Boutique-'+state.wall+'-'+state.collection+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),45000);
  };
  $('import-design').onclick=()=>$('design-file').click();
  $('design-file').onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try {
      if(file.size>65536)throw new Error();
      const data=JSON.parse(await file.text());
      if(data?.format!=='boutique-studio'||data.version!==1||!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings))throw new Error();
      if(!Object.keys(defaults).some(k=>Object.hasOwn(data.settings,k)))throw new Error();
      change(validState(data.settings));toast('Design opened');
    }catch{toast('Choose a design JSON downloaded from Boutique studio');}finally{e.target.value='';}
  };
}

export function historyControls(api) {
  const past=[],future=[];let gesture=null;
  function refresh(){$('undo').disabled=!past.length;$('redo').disabled=!future.length;}
  function endGesture(){gesture=null;}
  function change(part,field=null){
    const before=api.current(),after=validState({...before,...part});
    if(sameDesign(after,before))return;
    if(field===null||field!==gesture){past.push({...before});if(past.length>60)past.shift();}
    gesture=field;future.length=0;refresh();api.change(after);
  }
  function travel(from,to){
    if(!from.length)return;gesture=null;to.push({...api.current()});api.change(from.pop());refresh();
  }
  $('undo').onclick=()=>travel(past,future);$('redo').onclick=()=>travel(future,past);
  window.addEventListener('keydown',e=>{
    if((!e.ctrlKey&&!e.metaKey)||e.altKey||e.target.closest('input,textarea,select,[contenteditable=true]'))return;
    const key=e.key.toLowerCase();if(key!=='z'&&key!=='y')return;
    e.preventDefault();if(key==='y'||e.shiftKey)travel(future,past);else travel(past,future);
  });
  return {change,endGesture};
}
