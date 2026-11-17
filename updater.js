'use strict';
const https=require('https'),fs=require('fs'),path=require('path'),crypto=require('crypto');
function version(value){const m=/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);if(!m)throw new Error('Некорректная версия релиза.');return m.slice(1).map(Number);}
function newer(candidate,current){const a=version(candidate),b=version(current);for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;}
function trusted(url){const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!['api.github.com','github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(u.hostname))throw new Error('Недопустимый адрес обновления.');return u;}
function response(url,redirects=0){return new Promise((resolve,reject)=>{let req;try{trusted(url);req=https.get(url,{headers:{'User-Agent':'RussianCaptions-Updater','Accept':'application/vnd.github+json'}},res=>{res.setTimeout(60000,()=>res.destroy(new Error('Сервер не отвечает.')));if([301,302,303,307,308].includes(res.statusCode)){res.resume();if(redirects>=5)return reject(new Error('Слишком много перенаправлений.'));let next;try{next=new URL(res.headers.location,url).href;}catch(e){return reject(e);}response(next,redirects+1).then(resolve,reject);return;}if(res.statusCode!==200){res.resume();return reject(new Error(res.statusCode===404?'Опубликованных обновлений пока нет.':'GitHub ответил '+res.statusCode+'. Повтори позже.'));}resolve(res);});req.setTimeout(60000,()=>req.destroy(new Error('Нет ответа от GitHub.')));req.on('error',reject);}catch(e){reject(e);}});}
async function small(url){const res=await response(url);return new Promise((resolve,reject)=>{const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024){res.destroy(new Error('Слишком большой ответ.'));return;}chunks.push(chunk);});res.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));res.on('error',reject);});}
function selectRelease(release,config){
 if(release.draft||release.prerelease||!newer(release.tag_name,config.version))return null;
 const asset=(release.assets||[]).find(x=>x.name===config.asset);
 if(!asset||!Number.isSafeInteger(asset.size)||asset.size<1||asset.size>2147483648)throw new Error('В релизе нет подходящего установщика.');
 const expected='https://github.com/'+config.repository+'/releases/download/'+release.tag_name+'/'+config.asset;
 if(asset.browser_download_url!==expected)throw new Error('Установщик относится к другому репозиторию.');
 if(!/^sha256:[a-f0-9]{64}$/i.test(asset.digest||''))throw new Error('GitHub не предоставил контрольную сумму установщика.');
 return{version:release.tag_name.replace(/^v/,''),url:expected,size:asset.size,sha256:asset.digest.slice(7).toLowerCase()};
}
async function check(config){if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository))throw new Error('Не задан репозиторий обновлений.');return selectRelease(JSON.parse(await small('https://api.github.com/repos/'+config.repository+'/releases/latest')),config);}
async function download(release,directory,onProgress){
 fs.mkdirSync(directory,{recursive:true});const folder=fs.mkdtempSync(path.join(directory,'update-')),part=path.join(folder,'setup.part'),target=path.join(folder,'RussianCaptions-Setup.exe');
 try{const res=await response(release.url);await new Promise((resolve,reject)=>{const out=fs.createWriteStream(part,{flags:'wx'}),hash=crypto.createHash('sha256');let size=0,failed=false;function fail(e){if(failed)return;failed=true;res.destroy();out.destroy();reject(e);}res.on('data',chunk=>{size+=chunk.length;if(size>release.size)return fail(new Error('Размер обновления не совпадает.'));hash.update(chunk);if(onProgress)onProgress(Math.round(size/release.size*100));});res.on('error',fail);res.on('aborted',()=>fail(new Error('Загрузка прервана.')));out.on('error',fail);out.on('finish',()=>{if(failed)return;if(size!==release.size||hash.digest('hex')!==release.sha256)return fail(new Error('Проверка целостности не пройдена. Установщик не запущен.'));resolve();});res.pipe(out);});fs.renameSync(part,target);return target;}catch(e){try{fs.unlinkSync(part);}catch(_){}throw e;}
}
module.exports={version,newer,trusted,selectRelease,check,download};
