const assert=require('node:assert/strict');
const C=require('../core.js');
const words=C.fromSegments([{start:0,end:6,words:[{word:'привет,',start:0,end:.7},{word:'мир!',start:.8,end:1.5},{word:'это',start:2,end:2.5},{word:'из-за',start:2.5,end:3},{word:'3,5',start:3,end:3.5},{word:'рублей.',start:3.5,end:4},{word:'Ёж',start:4.5,end:5},{word:'здесь.',start:5,end:6}]}]);
const before=JSON.stringify(words);
const expected={original:['привет, мир! это из-за 3,5 рублей. Ёж здесь.','привет мир это из-за 3,5 рублей Ёж здесь'],sentence:['Привет, мир! Это из-за 3,5 рублей. Ёж здесь.','Привет мир Это из-за 3,5 рублей Ёж здесь'],lower:['привет, мир! это из-за 3,5 рублей. ёж здесь.','привет мир это из-за 3,5 рублей ёж здесь'],upper:['ПРИВЕТ, МИР! ЭТО ИЗ-ЗА 3,5 РУБЛЕЙ. ЁЖ ЗДЕСЬ.','ПРИВЕТ МИР ЭТО ИЗ-ЗА 3,5 РУБЛЕЙ ЁЖ ЗДЕСЬ']};
for(const [letterCase,variants]of Object.entries(expected))for(const [i,punctuation]of ['keep','remove'].entries()){const formatted=C.formatWords(words,{letterCase,punctuation});assert.equal(formatted.map(w=>w.text).join(' '),variants[i]);assert.deepEqual(formatted.map(w=>[w.start,w.end]),words.map(w=>[w.start,w.end]));}
assert.equal(JSON.stringify(words),before);
assert.equal(C.stripPunctuation('«Привет!» — из-за дождя в 12:30.'),'Привет из-за дождя в 12:30');
const grouped=C.groupWords(words,{...C.defaults,words:1});assert.equal(grouped.length,words.length);
const formatted=C.formatCaptions(grouped,{...C.defaults,letterCase:'sentence',punctuation:'remove'});assert.equal(formatted[1].text,'мир');assert.equal(formatted[2].text,'Это');
const edited=C.editCaption(JSON.parse(JSON.stringify(grouped[0])),'Совсем новая фраза');assert.equal(edited.approximate,true);assert.equal(edited.words[0].start,0);assert.ok(Math.abs(edited.words[2].end-.7)<1e-9);
assert.match(C.srt(formatted),/00:00:00,000 --> 00:00:00,700/);
console.log('PASS: 8 punctuation/case combinations, original preservation, timings, sentence boundaries, lexical punctuation, regroup and edits.');

