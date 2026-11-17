(function(){
'use strict';
const button=document.getElementById('check-updates'),note=document.getElementById('update-status'),auto=document.getElementById('auto-updates');
if(typeof window.__adobe_cep__==='undefined'){button.disabled=true;note.textContent='Обновления доступны внутри Premiere.';return;}
const fs=require('fs'),path=require('path'),root=new CSInterface().getSystemPath(SystemPath.EXTENSION),api=require(path.join(root,'updater.js'));
const config=JSON.parse(fs.readFileSync(path.join(root,'release.json'),'utf8')),stateDir=path.join(window.CaptionRuntime.engine,'premiere-panel'),prefsFile=path.join(stateDir,'updates.json');
let prefs={automatic:true,lastCheck:0},release=null,downloaded=null,working=false;
try{Object.assign(prefs,JSON.parse(fs.readFileSync(prefsFile,'utf8')));}catch(e){}
auto.checked=prefs.automatic;document.querySelector('.version').textContent=config.version;
function save(){fs.writeFileSync(prefsFile,JSON.stringify(prefs));}
auto.onchange=()=>{prefs.automatic=auto.checked;save();};
async function check(){release=await api.check(config);prefs.lastCheck=Date.now();save();note.textContent=release?'Доступна версия '+release.version+'. Настройки и тексты сохранятся.':'Установлена актуальная версия '+config.version+'.';button.textContent=release?'Скачать обновление':'Проверить обновления';}
button.onclick=async()=>{if(working)return;if(window.RussianCaptionsPanel.getState().busy){note.textContent='Дождись завершения обработки.';return;}working=true;button.disabled=true;try{
 if(downloaded){require('child_process').spawn(downloaded,[],{detached:true,stdio:'ignore',windowsHide:false}).unref();note.textContent='Установщик открыт. Сохрани проекты и закрой Premiere для обновления.';}
 else if(release){downloaded=await api.download(release,path.join(stateDir,'updates'),percent=>{note.textContent='Загрузка обновления: '+percent+'%';});note.textContent='Файл проверен. Сохрани проекты: для установки нужно закрыть Premiere.';button.textContent='Открыть установщик';}
 else await check();
 }catch(e){note.textContent=e.message;}finally{working=false;button.disabled=false;}};
note.textContent='Версия '+config.version+' · GitHub Releases';
if(prefs.automatic&&Date.now()-prefs.lastCheck>24*3600*1000)setTimeout(()=>{if(!working){working=true;button.disabled=true;check().catch(()=>{note.textContent='Не удалось проверить обновления. Можно повторить вручную.';}).finally(()=>{working=false;button.disabled=false;});}},6000);
}());
