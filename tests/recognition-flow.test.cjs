const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),C=require('../core.js');
const source=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
const code=source.slice(source.indexOf('async function transcribe(){'),source.indexOf('async function loadLast()'));
function fixture(output='captions',fail=false){
 const ctx={projectPath:'C:/test.prproj',sequenceID:'test',duration:12,inPoint:2,outPoint:10},old={id:'old'},args=[],events=[],errors=[];
 const env={C,path,root:'C:/panel',engine:'C:/engine',python:'python',busy:false,cancelled:false,job:old,captions:[],context:ctx,settings:{...C.defaults,output},history:{clear:()=>{}},contextKey:c=>c.projectPath+'|'+c.sequenceID,readJSON:()=>({segments:[{words:[{word:'Привет',start:.2,end:.7,speaker:0},{word:'всем',start:.8,end:1.1,speaker:0},{word:'Здравствуйте',start:1.2,end:1.8,speaker:1}]}]}),newJob:context=>({id:'new',dir:'C:/new',context}),setBusy:value=>env.busy=value,$:()=>({value:0}),status:(text,error)=>{if(error)errors.push(text);},log:()=>{},saveJob:()=>{},renderEditor:()=>{},host:async method=>{events.push(method);return ctx;},fs:{existsSync:()=>true,unlinkSync:()=>{}},runProcess:async(exe,a,event)=>{args.push(a);if(fail)throw new Error('Recognition failed');event({type:'done',srt:'C:/new/speech.srt'});},apply:async()=>{assert.equal(env.busy,false);events.push('apply');}};
 vm.createContext(env);vm.runInContext(code,env);return {env,args,events,errors,old};
}
(async()=>{
 const success=fixture();await success.env.transcribe();assert.deepEqual(success.events,['inspect','export','apply']);assert.equal(success.env.captions.length,2,'speaker change must split phrases');assert(success.args[0].includes('--speakers'));assert(success.args[0].includes('--language'));assert.equal(success.env.captions[0].end,1.1);
 const mogrt=fixture('mogrt');await mogrt.env.transcribe();assert(!mogrt.events.includes('apply'),'MOGRT still requires choosing a template');
 const failure=fixture('captions',true);await failure.env.transcribe();assert(!failure.events.includes('apply'));assert.equal(failure.env.job,failure.old);assert.equal(failure.env.busy,false);assert.equal(failure.errors.length,1);
 const inout=fixture();inout.env.settings.scope='inout';await inout.env.transcribe();assert.equal(inout.env.captions[0].start,2.2);
 console.log('PASS: recognition auto-creates native captions, respects speaker boundaries/In-Out, does not auto-create MOGRT, preserves session after failure.');
})().catch(error=>{console.error(error);process.exitCode=1;});
