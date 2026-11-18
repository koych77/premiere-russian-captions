const assert=require('node:assert/strict');
const C=require('../core.js');
const fixture=()=>C.groupWords(Array.from({length:7},(_,i)=>({text:'слово'+i,start:i*.5,end:i*.5+.4})),{words:3,width:60});
const signature=c=>c.flatMap(x=>x.words).map(w=>[w.text,w.start,w.end]);
for(const direction of [-1,1]){
 const captions=fixture(),before=signature(captions);
 C.moveBoundaryWord(captions,1,direction===-1?0:2,direction);
 assert.deepEqual(signature(captions),before,'word order and exact timings must survive');
 captions.forEach(c=>{assert.equal(c.start,c.words[0].start);assert.equal(c.end,c.words.at(-1).end);});
 assert.equal(captions[1].words.length,2);
}
const single=fixture(),before=signature(single);
assert.equal(C.moveBoundaryWord(single,2,0,-1),1);
assert.equal(single.length,2);assert.deepEqual(signature(single),before);
const forwards=fixture();C.moveBoundaryWord(forwards,1,2,1);C.moveBoundaryWord(forwards,1,1,1);
assert.equal(C.moveBoundaryWord(forwards,1,0,1),1);assert.equal(forwards.length,2);assert.deepEqual(signature(forwards),before);
for(const args of [[0,0,-1],[2,0,1],[1,1,-1],[1,0,1],[1,0,0]]){
 const captions=fixture(),original=JSON.stringify(captions);
 assert.throws(()=>C.moveBoundaryWord(captions,...args));assert.equal(JSON.stringify(captions),original);
}
console.log('PASS: boundary-word transfers retain order, exact timings and text; single-word removal; invalid transfers are atomic.');
