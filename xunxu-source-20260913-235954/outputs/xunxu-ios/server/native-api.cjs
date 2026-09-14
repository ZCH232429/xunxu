const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),configFile=path.join(root,'.expo','native-pairing.json');
fs.mkdirSync(path.dirname(configFile),{recursive:true});
let pairing;try{pairing=JSON.parse(fs.readFileSync(configFile)).code}catch{pairing=crypto.randomBytes(6).toString('hex');fs.writeFileSync(configFile,JSON.stringify({code:pairing}))}
let credentials;function getCredentials(){if(process.env.ARK_API_KEY)return {ARK_API_KEY:process.env.ARK_API_KEY,ARK_MODEL:process.env.ARK_MODEL};if(credentials)return credentials;const command="$env:PSModulePath=Join-Path $PSHOME 'Modules'; $c=Get-Content -LiteralPath $env:XUNXU_CONFIG_FILE -Raw|ConvertFrom-Json; $s=ConvertTo-SecureString $c.encryptedKey; $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { @{key=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p);model=$c.model}|ConvertTo-Json -Compress } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }";const c=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,XUNXU_CONFIG_FILE:path.join(process.env.APPDATA,'循序','doubao-config.json')}}));return credentials={ARK_API_KEY:c.key,ARK_MODEL:c.model}}
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function run(endpoint,raw){const started=Date.now();const env=getCredentials();const {default:worker}=await import(pathToFileURL(path.resolve(root,'../fitness-workbench/cloud-worker.mjs')).href);const response=await worker.fetch(new Request('http://localhost'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:raw}),env);const data=await response.json();console.info('[kitchen-ai]',endpoint,response.status,Date.now()-started+'ms');return {status:response.status,data};}
const jobs=require('./ai-jobs.cjs').createJobs({run});
module.exports=async function nativeApi(req,res,next){
 const pathname=new URL(req.url,'http://localhost').pathname;if(!pathname.startsWith('/native-api/'))return next();
 const supplied=String(req.headers.authorization||'').replace(/^Bearer /,'');if(supplied.length!==pairing.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(pairing)))return reply(res,401,{error:'请在测试设置中输入电脑端的配对码，连接厨房 AI。'});
 if(['/native-api/ai/route','/native-api/ai/status'].includes(pathname)){
  const statusOnly=pathname.endsWith('/status');
  if(req.method!==(statusOnly?'GET':'POST'))return reply(res,405,{error:statusOnly?'请使用 GET':'请使用 POST'});
  const controller=new AbortController();const onClose=()=>{if(!res.writableEnded)controller.abort()};res.once('close',onClose);
  try{let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>6000000)return reply(res,413,{error:'请求内容过大'})}
   const result=await require('./ai-router.cjs').handleRouter(pathname.replace('/native-api/','/api/'),raw,getCredentials,controller.signal);
   if(!res.destroyed)reply(res,result.status,result.data);
  }catch{if(!res.destroyed)reply(res,503,{error:'AI路由请求无法完成'})}finally{res.removeListener('close',onClose)}
  return;
 }
 if(pathname.startsWith('/native-api/jobs/')){if(req.method!=='GET')return reply(res,405,{error:'请使用 GET'});const result=jobs.read(pathname.slice('/native-api/jobs/'.length));return reply(res,result.status,result.data);}
 const endpoint=pathname.replace('/native-api/','/api/');if(!['/api/food/resolve','/api/meal/verify','/api/meal/plan','/api/assistant','/api/assistant/status'].includes(endpoint))return reply(res,404,{error:'接口不存在'});
 try{if(endpoint==='/api/assistant/status'){getCredentials();return reply(res,200,{configured:true,provider:'doubao'})}if(req.method!=='POST')return reply(res,405,{error:'请使用 POST'});let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4500000)return reply(res,413,{error:'图片过大'})}if(req.headers.prefer==='respond-async'){const jobId=jobs.start(endpoint,raw);return reply(res,202,{jobId,pending:true})}const result=await run(endpoint,raw);reply(res,result.status,result.data)}catch{reply(res,503,{error:'电脑端 AI 服务暂时不可用或忙碌，请稍后重试并检查本机豆包配置'})}
};
