const assert=require('node:assert/strict'),vm=require('vm'),fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const {PassThrough}=require('stream'),{EventEmitter}=require('events');
const bytes=Buffer.from('test installer bytes'),digest=crypto.createHash('sha256').update(bytes).digest('hex');
function fakeApi(body,status=200,location){
 const fake={get(url,options,callback){const req=new EventEmitter();req.setTimeout=()=>{};req.destroy=e=>req.emit('error',e);process.nextTick(()=>{const res=new PassThrough();res.statusCode=status;res.headers={location};res.setTimeout=()=>{};callback(res);res.end(body);});return req;}};
 const ctx={module:{exports:{}},require:n=>n==='https'?fake:require(n),URL,Buffer,process};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../updater.js'),'utf8'),ctx);return ctx.module.exports;
}
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'caption-update-test-'));
 const release={url:'https://github.com/owner/repo/releases/download/v1.0.0/setup.exe',size:bytes.length,sha256:digest};
 const api=fakeApi(bytes),result=await api.download(release,folder);
 assert.deepEqual(fs.readFileSync(result),bytes);
 await assert.rejects(()=>api.download({...release,sha256:'f'.repeat(64)},folder),/целостности/);
 await assert.rejects(()=>api.download({...release,size:bytes.length+1},folder),/целостности/);
 await assert.rejects(()=>api.download({...release,size:1},folder),/Размер/);
 await assert.rejects(()=>fakeApi('',302,'http://example.com/bad').download(release,folder),/адрес/);
 await assert.rejects(()=>fakeApi('',404).download(release,folder),/пока нет/);
 console.log('PASS: verified downloads; rejected digest, size, unsafe redirect and HTTP errors');
})().catch(e=>{console.error(e);process.exitCode=1;});
