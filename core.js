(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CaptionCore=api;}(typeof window!=='undefined'?window:global,function(){
'use strict';
const defaults={punctuation:'keep',letterCase:'original',width:32,words:5,lines:2,splitPauses:true,pause:.65,language:'ru',speakers:true,layout:'phrase',font:'Arial',size:64,color:'#ffffff',accent:'#a9ff5b',background:'#17191f',position:78,stroke:3,preset:'clean',animation:'fade',speed:180,output:'captions',scope:'all',device:'auto',reduced:false};
const presets=[
{id:'clean',name:'Чистый',category:'Спокойные',sample:'Слова имеют значение',animation:'fade',color:'#ffffff',accent:'#a9ff5b',font:'Arial',size:64,stroke:3},
{id:'cinema',name:'Кино',category:'Спокойные',sample:'Всё начинается с идеи',animation:'fade',color:'#fff3db',accent:'#fff3db',font:'Georgia',size:60,stroke:2},
{id:'pop',name:'Мягкий pop',category:'Динамичные',sample:'Твоя история начинается',animation:'pop',color:'#ffffff',accent:'#a9ff5b',font:'Arial',size:76,stroke:4},
{id:'slide',name:'В движении',category:'Динамичные',sample:'Двигайся в своём ритме',animation:'slide',color:'#ffffff',accent:'#74c9ff',font:'Arial',size:70,stroke:3},
{id:'karaoke',name:'Караоке',category:'По словам',sample:'Каждое слово в ритме',animation:'none',color:'#a0a5af',accent:'#a9ff5b',font:'Arial',size:72,stroke:3},
{id:'box',name:'Подсветка',category:'По словам',sample:'Выдели самое важное',animation:'pop',color:'#ffffff',accent:'#c5a6ff',font:'Arial',size:68,stroke:0},
{id:'word',name:'Одно слово',category:'По словам',sample:'Скажи это громче',animation:'pop',color:'#ffffff',accent:'#ffe16b',font:'Impact',size:100,stroke:3,layout:'word'},
{id:'marker',name:'Маркер',category:'По словам',sample:'Запомни этот момент',animation:'slide',color:'#ffffff',accent:'#ffe16b',font:'Arial',size:70,stroke:2},
{id:'title',name:'Большой акцент',category:'Титры',sample:'ВОТ ЭТО МОМЕНТ',animation:'pop',color:'#a9ff5b',accent:'#ffffff',font:'Impact',size:112,stroke:3},
{id:'card',name:'Карточка',category:'Титры',sample:'Новая глава',animation:'slide',color:'#ffffff',accent:'#74c9ff',font:'Arial',size:78,stroke:0}];
function stripPunctuation(text){return Array.from(text).filter((c,i,a)=>{if(/[.,:]/.test(c)&&/\d/.test(a[i-1]||'')&&/\d/.test(a[i+1]||''))return true;if(/[-'’]/.test(c)&&/[\p{L}\p{N}]/u.test(a[i-1]||'')&&/[\p{L}\p{N}]/u.test(a[i+1]||''))return true;return !/\p{P}/u.test(c);}).join('').replace(/[^\S\n]+/g,' ').trim();}
function formatWords(words,s){let beginning=true;return words.map(w=>{const original=w.text;let text=original;if(s.letterCase==='lower')text=text.toLocaleLowerCase('ru');if(s.letterCase==='upper')text=text.toLocaleUpperCase('ru');if(s.letterCase==='sentence'&&beginning)text=text.replace(/\p{L}/u,c=>c.toLocaleUpperCase('ru'));if(/\p{L}/u.test(original))beginning=false;if(/[.!?…][»”"')\]]*$/.test(original))beginning=true;if(s.punctuation==='remove')text=stripPunctuation(text);return Object.assign({},w,{text});});}
function wrap(text,width){const lines=[''];text.split(/\s+/).filter(Boolean).forEach(w=>{const n=lines.length-1;if(lines[n]&&lines[n].length+w.length+1>width)lines.push(w);else lines[n]+=(lines[n]?' ':'')+w;});return lines.join('\n');}
function fromSegments(segments,offset){const words=[];offset=offset||0;(segments||[]).forEach(s=>{const list=s.words&&s.words.length?s.words:String(s.text).trim().split(/\s+/).map((word,i,a)=>({word,start:s.start+(s.end-s.start)*i/a.length,end:s.start+(s.end-s.start)*(i+1)/a.length}));list.forEach(w=>{if(String(w.word).trim())words.push({text:String(w.word).trim(),start:Number(w.start)+offset,end:Number(w.end)+offset,speaker:w.speaker==null?s.speaker:w.speaker,probability:w.probability});});});return words;}
function speakerChange(a,b){return a&&b&&a.speaker!=null&&b.speaker!=null&&a.speaker!==b.speaker;}
function groupWords(words,s){const result=[];let group=[];const maxWords=s.layout==='word'?1:Math.max(1,Math.min(30,Number(s.words)||5));const pause=Number.isFinite(Number(s.pause))?Math.max(.1,Number(s.pause)):.65;function flush(){if(!group.length)return;result.push({id:'c'+result.length,start:group[0].start,end:group[group.length-1].end,words:group.map(w=>Object.assign({},w)),text:group.map(w=>w.text).join(' '),selected:true});group=[];}words.forEach(w=>{const previous=group[group.length-1];if(group.length&&(group.length>=maxWords||group.some(x=>speakerChange(x,w))||(s.splitPauses!==false&&w.start-previous.end>pause)))flush();group.push(w);if(/[.!?…][»”"')\]]*$/.test(w.text))flush();});flush();return result;}
function editCaption(c,text){
 const tokens=text.trim().split(/\s+/).filter(Boolean),old=c.words,approximate=tokens.length!==old.length;
 const newline=text.indexOf('\n'),lineBreak=newline<0?0:text.slice(0,newline).trim().split(/\s+/).filter(Boolean).length;
 if(lineBreak>0&&lineBreak<tokens.length)c.lineBreak=lineBreak;else delete c.lineBreak;
 if(!approximate)c.words=tokens.map((text,i)=>Object.assign({},old[i],{text}));
 else{
  // Preserve timing of unchanged words when inserting/deleting text. Only new
  // words receive estimated intervals; never redistribute the entire phrase.
  const n=old.length,m=tokens.length,dp=Array.from({length:n+1},()=>Array(m+1).fill(0)),matches=new Map();
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=old[i].text===tokens[j]?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
  for(let i=0,j=0;i<n&&j<m;){if(old[i].text===tokens[j]){matches.set(j,old[i]);i++;j++;}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++;}
  c.words=tokens.map((text,i)=>matches.has(i)?Object.assign({},matches.get(i),{text}):{text,estimated:true});
  for(let i=0;i<m;){if(matches.has(i)){i++;continue;}let end=i;while(end<m&&!matches.has(end))end++;const startTime=i?c.words[i-1].end:c.start,endTime=end<m?c.words[end].start:c.end;for(let k=i;k<end;k++){c.words[k].start=startTime+Math.max(0,endTime-startTime)*(k-i)/(end-i);c.words[k].end=startTime+Math.max(0,endTime-startTime)*(k-i+1)/(end-i);const neighbor=i?c.words[i-1]:c.words[end];if(neighbor)c.words[k].speaker=neighbor.speaker;}i=end;}
 }
 c.text=tokens.join(' ');c.approximate=!!c.approximate||approximate;return c;
}
function balancedLines(words,lines){const tokens=words.map(w=>w.text).filter(Boolean);if(Number(lines)!==2||tokens.length<4)return tokens.join(' ');let best=1,score=Infinity;for(let i=1;i<tokens.length;i++){const left=tokens.slice(0,i).join(' '),right=tokens.slice(i).join(' ');const value=Math.abs(left.length-right.length)+(/[,:;.!?…]$/.test(tokens[i-1])?-2:0);if(value<score){score=value;best=i;}}return tokens.slice(0,best).join(' ')+'\n'+tokens.slice(best).join(' ');}
function rawText(c){const words=c.words.map(w=>w.text);return c.lineBreak>0&&c.lineBreak<words.length?words.slice(0,c.lineBreak).join(' ')+'\n'+words.slice(c.lineBreak).join(' '):words.join(' ');}
function formatCaptions(captions,s){const formatted=formatWords(captions.reduce((a,c)=>a.concat(c.words),[]),s);let at=0;return captions.map(c=>{const words=formatted.slice(at,at+c.words.length);at+=c.words.length;const text=Number(s.lines)===2&&c.lineBreak?rawText(Object.assign({},c,{words})):s.lines==null?wrap(words.map(w=>w.text).join(' '),Number(s.width)):balancedLines(words,s.lines);return Object.assign({},c,{words,text});});}
function stamp(seconds){const m=Math.max(0,Math.round(seconds*1000));return String(Math.floor(m/3600000)).padStart(2,'0')+':'+String(Math.floor(m/60000)%60).padStart(2,'0')+':'+String(Math.floor(m/1000)%60).padStart(2,'0')+','+String(m%1000).padStart(3,'0');}
function srt(captions){let last=0;return captions.filter(c=>c.text.trim()).map((c,i)=>{const start=Math.max(last,c.start),end=Math.max(start+.04,c.end);last=end;return(i+1)+'\n'+stamp(start)+' --> '+stamp(end)+'\n'+c.text+'\n';}).join('\n');}
function moveBoundaryWord(captions,index,wordIndex,direction){
 const source=captions[index],targetIndex=index+direction,target=captions[targetIndex];
 if(!source||!target||(direction!==-1&&direction!==1))throw new Error('Нет соседней фразы.');
 if(!source.words.length||wordIndex!==(direction===-1?0:source.words.length-1))throw new Error('К предыдущей фразе переносится первое слово, к следующей — последнее.');
 const word=source.words[wordIndex];
 source.words.splice(wordIndex,1);
 if(direction===-1)target.words.push(word);else target.words.unshift(word);
 [source,target].forEach(c=>{c.text=c.words.map(w=>w.text).join(' ');if(c.words.length){c.start=c.words[0].start;c.end=c.words[c.words.length-1].end;}});
 if(!source.words.length){captions.splice(index,1);return direction===-1?index-1:index;}
 return index;
}
function moveWords(captions,index,first,last,direction){const source=captions[index],target=captions[index+direction];if(!source||!target||![-1,1].includes(direction))throw new Error('Нет соседней фразы.');if(first<0||last<first||last>=source.words.length||(direction===-1?first!==0:last!==source.words.length-1))throw new Error('Выдели первые слова для переноса назад или последние — для переноса вперёд.');const moved=source.words.slice(first,last+1);const combined=direction===-1?target.words.concat(moved):moved.concat(target.words);if(combined.some(w=>speakerChange(combined.find(x=>x.speaker!=null),w)))throw new Error('Речь разных говорящих должна оставаться в отдельных субтитрах.');source.words.splice(first,last-first+1);delete source.lineBreak;delete target.lineBreak;target.words=combined;[source,target].forEach(c=>{c.text=c.words.map(w=>w.text).join(' ');if(c.words.length){c.start=c.words[0].start;c.end=c.words[c.words.length-1].end;}});if(!source.words.length){captions.splice(index,1);return direction===-1?index-1:index;}return index;}
function splitCaption(captions,index,at){const cap=captions[index];if(!cap||at<=0||at>=cap.words.length)throw new Error('Поставь курсор между словами внутри фразы.');const left=cap.words.slice(0,at),right=cap.words.slice(at);captions.splice(index,1,Object.assign({},cap,{lineBreak:null,words:left,text:left.map(w=>w.text).join(' '),end:left[left.length-1].end}),Object.assign({},cap,{lineBreak:null,id:cap.id+'s',words:right,text:right.map(w=>w.text).join(' '),start:right[0].start}));}
return{defaults,presets,stripPunctuation,formatWords,fromSegments,groupWords,formatCaptions,editCaption,moveBoundaryWord,moveWords,splitCaption,speakerChange,balancedLines,rawText,wrap,stamp,srt};}));
