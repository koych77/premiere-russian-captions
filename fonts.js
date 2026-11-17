(function(){'use strict';
const native=typeof window.__adobe_cep__!=='undefined',select=document.getElementById('font'),search=document.getElementById('font-search'),info=document.getElementById('fonts-info'),button=document.getElementById('fonts-refresh');
let catalog=[],scanning=null,lastScan=0,serial=0;
const loaded=new Map(),pending=new Map();
const fs=native?require('fs'):null,path=native?require('path'):null;
function current(){return window.RussianCaptionsPanel.getState().settings.font;}
function render(){const chosen=current(),query=search.value.trim().toLocaleLowerCase();select.textContent='';const names=catalog.filter(f=>f.name===chosen||f.name.toLocaleLowerCase().includes(query)).map(f=>f.name);if(!names.includes(chosen))names.unshift(chosen);names.forEach(name=>{const option=document.createElement('option');option.value=name;option.textContent=name+(catalog.length&&!catalog.some(f=>f.name===name)?' — не найден':'');select.appendChild(option);});select.value=chosen;}
function pick(name){const entry=catalog.find(f=>f.name===name);return entry&&entry.faces.slice().sort((a,b)=>(a.italic?1000:0)+Math.abs(a.weight-700)-(b.italic?1000:0)-Math.abs(b.weight-700))[0];}
async function ensure(name){
 if(!native)return name;
 if(scanning)await scanning;
 const face=pick(name);if(!face)throw new Error('Шрифт «'+name+'» не найден. Обнови список или выбери установленный шрифт.');
 const key=face.path+'|'+face.modified+'|'+face.fullName;
 if(loaded.has(name)&&loaded.get(name).key===key)return loaded.get(name).family;
 if(pending.has(key))return pending.get(key);
 const operation=(async()=>{const alias='RussianCaptionsFont'+(++serial);let font;
 try{if(face.collection)throw new Error('Use exact collection face');const bytes=fs.readFileSync(face.path);font=new FontFace(alias,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),{weight:'700',style:'normal'});await font.load();}
 catch(e){font=new FontFace(alias,'local('+JSON.stringify(face.fullName)+')',{weight:'700',style:'normal'});await font.load();}
 document.fonts.add(font);const old=loaded.get(name);if(old)document.fonts.delete(old.face);loaded.set(name,{key,family:alias,face:font});return alias;
 })();pending.set(key,operation);try{return await operation;}catch(e){throw new Error('Не удалось загрузить «'+name+'». Для этого шрифта может потребоваться перезапуск Premiere.');}finally{pending.delete(key);}
}
async function refresh(){if(window.RussianCaptionsPanel.getState().busy)return;if(!native){info.textContent='Системные шрифты доступны внутри Premiere.';return;}if(scanning)return scanning;button.disabled=true;info.textContent='Обновляю системные и пользовательские шрифты…';
 scanning=new Promise((resolve,reject)=>{const root=new CSInterface().getSystemPath(SystemPath.EXTENSION),python=window.CaptionRuntime.python;require('child_process').execFile(python,[path.join(root,'font_catalog.py')],{windowsHide:true,encoding:'utf8',maxBuffer:8*1024*1024,timeout:30000,env:Object.assign({},process.env,{PYTHONUTF8:'1'})},(error,stdout)=>{if(error){reject(error);return;}try{const result=JSON.parse(stdout);catalog=result.families;render();lastScan=Date.now();info.textContent=catalog.length+' семейств · автообновление раз в минуту и при возврате в панель';resolve(catalog.length);}catch(e){reject(e);}});});
 try{await scanning;}catch(e){info.textContent='Не удалось прочитать шрифты Windows. Нажми «Обновить шрифты».';}finally{scanning=null;button.disabled=false;}try{await ensure(current());}catch(e){info.textContent=e.message;}
}
window.CaptionFonts={ensure,refresh,family:name=>loaded.has(name)?loaded.get(name).family:name,getCatalog:()=>catalog};
select.addEventListener('change',()=>ensure(current()).then(()=>{info.textContent=catalog.length+' семейств · выбранный шрифт загружен';}).catch(e=>{info.textContent=e.message;}));
search.addEventListener('input',render);button.onclick=refresh;
window.addEventListener('focus',()=>{if(Date.now()-lastScan>10000&&!window.RussianCaptionsPanel.getState().busy)refresh();});
setInterval(()=>{if(!window.RussianCaptionsPanel.getState().busy)refresh();},60000);
refresh();
}());
