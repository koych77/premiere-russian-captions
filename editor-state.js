(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CaptionEditorState=api;}(typeof window!=='undefined'?window:global,function(){
'use strict';
const fields=['words','lines','splitPauses','pause','punctuation','letterCase'];
function clone(value){return JSON.parse(JSON.stringify(value));}
function textSettings(settings){const result={};fields.forEach(k=>{if(settings[k]!==undefined)result[k]=settings[k];});return result;}
function projectKey(context){return context?String(context.projectPath||'').replace(/\\/g,'/').toLowerCase():'';}
function orientation(context){return context&&context.height>context.width?'vertical':'horizontal';}
function createHistory(limit){let past=[],future=[],group=null,time=0;return {
 push(value,key,now){now=now==null?Date.now():now;if(!key||key!==group||now-time>800){past.push(clone(value));if(past.length>(limit||80))past.shift();}future=[];group=key||null;time=now;},
 undo(current){if(!past.length)return null;future.push(clone(current));group=null;return past.pop();},
 redo(current){if(!future.length)return null;past.push(clone(current));group=null;return future.pop();},
 clear(){past=[];future=[];group=null;},
 get canUndo(){return !!past.length;},get canRedo(){return !!future.length;}
};}
function selectionWords(text,start,end){const matches=Array.from(text.matchAll(/\S+/g));if(start===end){const i=matches.findIndex(m=>start>=m.index&&start<=m.index+m[0].length);return i<0?null:{first:i,last:i};}const selected=matches.map((m,i)=>({m,i})).filter(x=>x.m.index<end&&x.m.index+x.m[0].length>start);return selected.length?{first:selected[0].i,last:selected[selected.length-1].i}:null;}
function splitIndex(text,position){if(position>0&&position<text.length&&!/\s/.test(text[position-1])&&!/\s/.test(text[position]))return -1;return text.slice(0,position).trim().split(/\s+/).filter(Boolean).length;}
return{clone,textSettings,projectKey,orientation,createHistory,selectionWords,splitIndex};
}));
