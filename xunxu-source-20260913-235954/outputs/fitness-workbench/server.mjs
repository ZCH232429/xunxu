import express from 'express';
import {resolveFood} from './food-resolver.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {empty} from './public/engine.js';
import {validState,healthRows} from './validation.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),data=process.env.FIT_WORKBENCH_DATA||path.join(root,'data');fs.mkdirSync(data,{recursive:true});
const app=express();app.disable('x-powered-by');app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','same-origin');const host=req.headers.host?.split(':')[0];if(!['127.0.0.1','localhost','::1','['].includes(host))return res.status(403).json({error:'仅接受本机访问；手机请使用私人在线工作台。'});if(req.headers.origin){try{const originHost=new URL(req.headers.origin).hostname;if(!['127.0.0.1','localhost','::1'].includes(originHost))return res.status(403).json({error:'不允许跨站请求'})}catch{return res.status(403).json({error:'不允许跨站请求'})}}next()});app.use(express.json({limit:'15mb'}));
const statePath=id=>path.join(data,id==='demo'?'demo.json':'personal.json');
app.post('/api/food/resolve',async(req,res)=>{try{const reply=await resolveFood(new Request('http://'+req.headers.host+'/api/food/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(req.body)}),process.env);res.status(reply.status).json(await reply.json())}catch{res.status(500).json({error:'食材服务暂不可用'})}});
function read(id){const p=statePath(id);return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{version:0,state:empty()}}
function write(id,obj){
  const p=statePath(id),tmp=p+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(obj));
  try{fs.renameSync(tmp,p)}catch(error){
    if(error.code!=='EXDEV')throw error;
    fs.copyFileSync(tmp,p);fs.unlinkSync(tmp);
  }
}
app.get('/api/state/:id',(req,res)=>res.json(read(req.params.id)));
app.put('/api/state/:id',(req,res)=>{try{const old=read(req.params.id);if(req.body.version!==old.version)return res.status(409).json({error:'另一页面已更新数据，请刷新后重试。'});const state=validState(req.body.state);write(req.params.id,{version:old.version+1,state});res.json({version:old.version+1})}catch(e){res.status(400).json({error:e.message})}});
app.get('/api/status',(req,res)=>res.json({portable:false,vision:!!(process.env.ARK_API_KEY&&process.env.ARK_MODEL),aiProvider:'doubao',searchProvider:'doubao',videoKeys:videos.map(x=>x.key)}));
app.get('/api/barcode/:code',async(req,res)=>{try{const reply=await resolveFood(new Request('http://'+req.headers.host+'/api/food/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'barcode',code:req.params.code})}),process.env);res.status(reply.status).json(await reply.json())}catch{res.status(500).json({error:'豆包条码检索暂不可用'})}});
app.post('/api/assistant',async(req,res)=>{try{
  if(!process.env.ARK_API_KEY||!process.env.ARK_MODEL)return res.status(503).json({error:'豆包 厨房助手尚未在服务端配置。'});
  const text=String(req.body?.text||'').trim();if(!text||text.length>1000)return res.status(400).json({error:'请输入不超过 1000 字的问题'});
  const context=JSON.stringify(req.body?.context||{}).slice(0,12000),needsWebSearch=/联网|搜索|来源|链接|做法|食谱|品牌|商品/.test(text);
  const r=await fetch('https://ark.cn-beijing.volces.com/api/v3/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.ARK_API_KEY}`},body:JSON.stringify({model:process.env.ARK_MODEL,store:false,...(needsWebSearch?{tools:[{type:'web_search'}]}:{}),input:[{role:'system',content:'你是循序的厨房助手，也是本应用唯一的 AI 与联网检索入口。使用简洁中文回答；依据库存和营养目标给出克重与做法，区分生重熟重，缺失资料如实说明。需要实时资料时使用豆包联网搜索并附来源。'},{role:'user',content:`问题：${text}\n\n工作台上下文：${context}`}]}),signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw Error('豆包 服务暂时不可用');const data=await r.json();res.json({answer:(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n')||'未获得可用回复'})
}catch(e){res.status(422).json({error:e.message})}});
app.post('/api/vision',async(req,res)=>{try{const reply=await resolveFood(new Request('http://'+req.headers.host+'/api/food/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'photo',image:req.body.image,strictServing:true})}),process.env);res.status(reply.status).json(await reply.json())}catch{res.status(500).json({error:'豆包图像识别暂不可用'})}});
let videos=[];try{videos=JSON.parse(fs.readFileSync(path.join(root,'video-sources.json'),'utf8'))}catch{}
app.get('/api/video/:key',(req,res)=>{const v=videos.find(x=>x.key===req.params.key);if(!v||!fs.existsSync(v.path))return res.status(404).send('原视频不在当前设备，请检查原始文件路径。');const size=fs.statSync(v.path).size,range=req.headers.range;res.set({'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'private, max-age=3600'});if(range){const m=/^bytes=(\d+)-(\d*)$/.exec(range);if(!m)return res.status(416).end();const start=Number(m[1]),end=m[2]?Math.min(Number(m[2]),size-1):Math.min(start+4*1024*1024-1,size-1);if(start>=size||end<start)return res.status(416).set('Content-Range',`bytes */${size}`).end();res.status(206).set({'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});fs.createReadStream(v.path,{start,end}).pipe(res)}else{res.set('Content-Length',size);fs.createReadStream(v.path).pipe(res)}});
app.get('/api/report/:key',(req,res)=>{const f={diet:'01_吃_饮食视频详细分析.md',training:'02_练_三分化视频详细分析.md',all:'减脂计划_吃与练_完整阅读版.html'}[req.params.key];if(!f)return res.sendStatus(404);res.sendFile(path.resolve(root,'..',f))});
app.get('/vendor/zxing.js',(req,res)=>res.sendFile(path.join(root,'node_modules/@zxing/browser/umd/zxing-browser.min.js')));
app.use(express.static(path.join(root,'public')));app.use((err,req,res,next)=>res.status(400).json({error:'请求格式或大小不正确'}));
export function start({port=Number(process.env.PORT)||4317,host='127.0.0.1'}={}){
  return app.listen(port,host,()=>console.log(`循序工作台 http://${host}:${port}`));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))start();
