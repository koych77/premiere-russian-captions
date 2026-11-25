const assert=require('node:assert/strict');
const C=require('../core.js'),E=require('../editor-state.js');
const words=Array.from({length:10},(_,i)=>({text:'слово'+i,start:i*.7,end:i*.7+.4,speaker:0}));
const signature=cs=>cs.flatMap(c=>c.words).map(w=>[w.text,w.start,w.end,w.speaker]);
const settings={...C.defaults,words:5,splitPauses:false};
assert.equal(C.groupWords(words,{...settings,width:1}).length,2,'character width must not override word limit');
assert.equal(C.groupWords(words.map(w=>({...w,start:w.start*5,end:w.end*5})),settings).length,2,'no hidden duration limit');
const dialogue=words.map((w,i)=>({...w,speaker:i<3?0:1}));
const grouped=C.groupWords(dialogue,settings);assert.equal(grouped[0].words.length,3);
const uncertain=dialogue.map((w,i)=>({...w,speaker:i===2?undefined:w.speaker}));
assert.equal(C.groupWords(uncertain,settings)[0].words.length,3,'unknown word must not bridge two known speakers');
assert.equal(C.groupWords(words,{...settings,splitPauses:true,pause:.2}).length,10);
for(const lines of [1,2]){
 const output=C.formatCaptions(C.groupWords(words,settings),{...settings,lines});
 assert(output.every(c=>c.text.split('\n').length<=lines));
 assert.deepEqual(output.flatMap(c=>c.words).map(w=>[w.start,w.end]),words.map(w=>[w.start,w.end]));
}
const cs=C.groupWords(words,{...settings,words:3}),before=signature(cs);
C.moveWords(cs,1,0,1,-1);assert.deepEqual(signature(cs),before);assert.equal(cs[0].words.length,5);
const invalid=JSON.stringify(cs);assert.throws(()=>C.moveWords(cs,0,1,2,-1));assert.equal(JSON.stringify(cs),invalid);
const speakers=C.groupWords(dialogue,settings),saved=JSON.stringify(speakers);assert.throws(()=>C.moveWords(speakers,1,0,0,-1),/говорящих/);assert.equal(JSON.stringify(speakers),saved);
C.splitCaption(cs,0,2);assert.deepEqual(signature(cs),before);assert.equal(cs[0].end,words[1].end);assert.equal(cs[1].start,words[2].start);
const h=E.createHistory(3);h.push({cs},'typing',100);const original=E.clone(cs);cs[0].words[0].text='изменено';h.push({cs},'typing',200);cs[0].words[0].text='ещё';const restored=h.undo({cs});assert.deepEqual(restored.cs,original);assert.equal(h.redo(restored).cs[0].words[0].text,'ещё');
h.push({a:1});h.push({a:2});assert.equal(h.undo({a:3}).a,2);h.push({a:4});assert.equal(h.canRedo,false);h.clear();assert.equal(h.canUndo,false);
const edited=C.groupWords(words,settings)[0];C.editCaption(edited,'слово0 новое слово1 слово2 слово3 слово4');assert.equal(edited.words[2].start,words[1].start);assert.equal(edited.words[2].end,words[1].end);assert.equal(edited.words[1].estimated,true);
assert.deepEqual(E.selectionWords('Первое второе третье',7,20),{first:1,last:2});assert.equal(E.splitIndex('Первое второе',3),-1);assert.equal(E.splitIndex('Первое второе',7),1);
assert.equal(E.projectKey({projectPath:'D:\\Видео\\A.prproj'}),E.projectKey({projectPath:'d:/видео/a.prproj'}));assert.equal(E.orientation({width:1080,height:1920}),'vertical');assert.equal(E.orientation({width:1920,height:1080}),'horizontal');
assert.deepEqual(Object.keys(E.textSettings(C.defaults)).sort(),['letterCase','lines','pause','punctuation','splitPauses','words']);
console.log('PASS: word-only limits, pause/speaker boundaries, 1/2 lines, multi-word moves, split timing, undo/redo, unchanged-word timing, project presets.');

const manual=C.groupWords(words,settings)[0];C.editCaption(manual,'слово0\nслово1 слово2 слово3 слово4');assert.equal(C.formatCaptions([manual],{...settings,lines:2})[0].text,'слово0\nслово1 слово2 слово3 слово4');assert.equal(C.formatCaptions([manual],{...settings,lines:1})[0].text,'слово0 слово1 слово2 слово3 слово4');assert.equal(C.rawText(manual),'слово0\nслово1 слово2 слово3 слово4');
