(function(){
'use strict';
if(typeof window.__adobe_cep__==='undefined')return;
const path=require('path'),fs=require('fs');
const engine=path.join(process.env.LOCALAPPDATA||path.join(require('os').homedir(),'AppData','Local'),'Programs','RussianSubtitles');
const portable=path.join(engine,'runtime','python.exe');
window.CaptionRuntime={engine,python:fs.existsSync(portable)?portable:path.join(engine,'venv','Scripts','python.exe')};
}());
