const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const C=require('../core.js');
const source=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
const between=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const code=between('function contextKey(', 'function sessionIndex(')+between('function normalizeOutput(', 'function syncWorkspace(')+between('function titleCaption(', 'function syncOutput(')+between('async function apply(', 'async function scanMogrts(');
function fixture({manual=false,stale=false,output='mogrt',playhead=47.5}={}){
 const current={sequenceID:'seq',projectPath:'C:/project.prproj',name:'Sequence',fingerprint:'current',audioFingerprint:'audio',playhead};
 const original={id:'speech',dir:'C:/speech',context:{...current,fingerprint:stale?'stale':'current'},captions:[{start:2,end:4,text:'Речь',words:[{text:'Речь',start:2,end:4}]}]};
 const nodes={'title-text':{value:'Мой титр!'},'title-duration':{value:'3'},'mogrt-field':{value:'0'},progress:{value:0}};
 const calls=[],errors=[],writes=[];
 const env={C,path,settings:{...C.defaults,output},context:null,mode:manual?'titles':'captions',job:original,captions:original.captions,busy:false,cancelled:false,mogrt:{path:'C:/title.mogrt',fields:[{name:'Text'}]},$:id=>nodes[id],setBusy:v=>env.busy=v,saveJob:()=>{},record:()=>{},status:(message,error)=>{if(error)errors.push(message);},newJob:ctx=>({id:'manual',dir:'C:/manual',context:ctx,revision:0}),fs:{writeFileSync:(...args)=>writes.push(args)},host:async(method,args)=>{calls.push({method,args});return method==='inspect'?{...current}:{count:1,track:2,fingerprint:'after-template'};}};
 vm.createContext(env);vm.runInContext(code,env);
 return {env,calls,errors,writes,original};
}
(async()=>{
 for(const output of ['animated','titles','unknown','captions','mogrt']){
  const f=fixture({output});f.env.settings.layout='word';f.env.normalizeOutput();
  assert.equal(f.env.settings.output,output==='mogrt'?'mogrt':'captions');assert.equal(f.env.settings.layout,'phrase');
 }
 for(const stale of [false,true]){
  const f=fixture({manual:true,stale});const text=JSON.stringify(f.original.captions);await f.env.apply();
  assert.deepEqual(f.errors,[]);const applied=f.calls.find(c=>c.method==='mogrts');
  assert.equal(applied.args.captions[0].start,47.5);assert.equal(applied.args.captions[0].end,50.5);assert.equal(applied.args.captions[0].text,'Мой титр!');
  assert.equal(f.env.job,f.original);assert.equal(JSON.stringify(f.original.captions),text);
  assert.equal(f.original.context.fingerprint,stale?'stale':'after-template','manual insertion must not bless already stale speech');
 }
 const speech=fixture();await speech.env.apply();assert.deepEqual(speech.errors,[]);assert.equal(speech.calls.find(c=>c.method==='mogrts').args.captions[0].start,2);
 const classic=fixture({output:'captions'});await classic.env.apply();assert.deepEqual(classic.errors,[]);assert(classic.calls.some(c=>c.method==='apply'));assert(classic.writes[0][1].includes('00:00:02,000 --> 00:00:04,000'));assert(!classic.calls.some(c=>c.method==='overlay'));
 const noTemplate=fixture({manual:true});noTemplate.env.mogrt=null;await noTemplate.env.apply();assert.equal(noTemplate.errors.length,1);assert(!noTemplate.calls.some(c=>c.method==='mogrts'));assert.equal(noTemplate.env.job,noTemplate.original);
 console.log('PASS: legacy output migration; native captions and MOGRT; manual playhead/duration; speech preservation; stale-context guard; missing template.');
})().catch(e=>{console.error(e);process.exitCode=1;});
