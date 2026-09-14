import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),source=path.resolve(root,'../fitness-workbench/public'),target=path.join(root,'public/workbench');
fs.mkdirSync(target,{recursive:true});fs.cpSync(source,target,{recursive:true,filter:p=>!p.endsWith('sw.js')});
const portablePath=path.join(target,'portable-store.js');fs.writeFileSync(portablePath,fs.readFileSync(portablePath,'utf8').replace("export const portable=!['localhost','127.0.0.1'].includes(location.hostname);",'export const portable=true;'));
for(const file of ['index.html','app.js','human-viewer.js','style.css','bento.css','analysis.html']){const p=path.join(target,file);if(!fs.existsSync(p))continue;let text=fs.readFileSync(p,'utf8');text=text.replace(/(["'`])\/(?!\/|api\/)/g,'$1/workbench/');if(file==='index.html')text=text.replace('</head>','<link rel="stylesheet" href="/workbench/ios.css"><script src="/workbench/native-bridge.js"></script></head>');if(file==='app.js'){
 text="import {homeView,animateHome} from './home.js';\n"+text;
 text=text.replace('function enhance(){','function enhance(){animateHome();');
 text=text.replace("if(page==='overview')$('header').insertAdjacentHTML('afterend',todaySummary());",'');
 // The desktop source may be formatted by Prettier (with a space before `{`).
 // Replace the complete overview function by structure instead of exact whitespace.
 const overviewPattern=/function overview\(\)\s*\{[\s\S]*?(?=\nfunction bodyPage\(\)\s*\{)/;
 if(!overviewPattern.test(text))throw Error('Homepage source changed; review native home integration');
 text=text.replace(overviewPattern,"function overview(){return homeView(state,today,mode)}\n");
 text+="\nwindow.addEventListener('xunxu-health',()=>{if(state&&page==='overview')render()});\n";
 // Apply the already-saved native workspace without reloading HTML or losing a training draft.
 text+=`
window.__xunxuApplyWorkspace=record=>{if(mode!=='personal'||!record?.state||!Number.isInteger(record.version)||record.version<version)return false;state=record.state;version=record.version;today=dateKey();return true;};
 window.__xunxuReloadData=()=>load().catch(e=>toast('同步失败：'+e.message));
`;
 text=text.replace("if('serviceWorker' in navigator)","if(false && 'serviceWorker' in navigator)");
 text=text.replace('async function api(url,opt={}){','async function api(url,opt={}){if(window.nativeRpc)return window.nativeRpc(url.startsWith("/api/state/")?"state":"api",{url,opt,empty:empty()});');
 text=text.replace('function download(name,text,type=','function download(name,text,type=');
 text=text.replace("{let u=URL.createObjectURL(new Blob([text],{type}))",'{if(window.nativeRpc){window.nativeRpc("export",{name,text}).catch(e=>toast(e.message));return}let u=URL.createObjectURL(new Blob([text],{type}))');
 text=text.replace("if(key==='camera'){", "if(key==='camera'&&window.nativeRpc){const code=await window.nativeRpc('barcode',{});if(code)$('#dialogform [name=\"code\"]').value=code;return}if(key==='camera'){");
 text=text.replace("if(key==='restore'){", "if(key==='restore'&&window.nativeRpc){const text=await window.nativeRpc('import',{});if(!text)return;const j=JSON.parse(text);if(j.format!=='fit-workbench-v1'||!j.state?.profile)throw Error('不是有效的工作台备份');if(!confirm('用此备份替换当前手机档案？建议先导出备份。'))return;state=j.state;await save();return}if(key==='restore'){");
 // The native tab owns nutrition; do not ship a second visible diet dashboard.
 text=text.replace(/function nutritionPage\(\)\{[\s\S]*?(?=\nfunction )/, `function nutritionPage(){return '<section class="card"><button data-page="nutrition">打开饮食与冰箱</button></section>'}\n`);
 // Native image picker retains the existing HTML form and nutrition preview.
 text=text.replace("payload.image=await imageData(file,1400)","payload.image=await imageData(file,1400)");
 text=text.replace("if(!file?.size)throw Error('请先拍摄或选择照片');payload.image=await imageData(file,1400)","if(node.dataset.nativeImage)payload.image=node.dataset.nativeImage;else{if(!file?.size)throw Error('请先拍摄或选择照片');payload.image=await imageData(file,1400)}");
 text=text.replace("document.querySelector('#voice-provider')?.value||''", "document.querySelector('#voice-provider')?.value||''");
 text=text.replace("<h2>识别服务与来源</h2>","<h2>iOS 测试版 · 0.2.0</h2><p>真实档案保存到登录账号的云端空间；演示数据独立保存在本机。</p><button type=\"button\" data-native-settings>连接厨房 AI / 测试设置</button>");
 text=text.replaceAll('本设备档案 · 点击体验演示','账号档案 · 点击体验演示').replaceAll('● 本地保存','● 云端档案').replaceAll('本地档案 · 体验演示','云端档案 · 体验演示').replaceAll('本设备存储 / 首尔时区 / v2.0','账号云端存储 / 首尔时区 / iOS 0.2.0');
 // Route body and macro editing to the same native calculator to prevent divergent targets.
 text=text.replace("if(key==='macro')return macroDialog();","if(key==='macro'&&mode==='personal'&&window.nativeRpc){await window.nativeRpc('basics',{});return}if(key==='macro')return macroDialog();");
 text=text.replace('function enhance(){',`function enhance(){if(mode==='personal'&&window.nativeRpc){const f=document.getElementById('profile-form');if(f){for(const key of ['name','sex','weight','height','age','activity','manualTdee','frequency'])f.querySelector('[name="'+key+'"]')?.closest('label')?.remove();f.querySelector('.fine')?.remove();f.insertAdjacentHTML('afterbegin','<div class="form-wide"><p>基础信息与视频饮食目标在同一处计算和确认。</p><button type="button" id="edit-native-basics">查看 / 修改基础信息与饮食目标</button></div>');f.querySelector('#edit-native-basics').onclick=()=>window.nativeRpc('basics',{});}}`);
 text=text.replace("if(key==='adjust-calorie'){","if(key==='adjust-calorie'&&state.profile.nutritionMethod==='video'&&window.nativeRpc){await window.nativeRpc('basics',{});return}if(key==='adjust-calorie'){");
 text=text.replaceAll('各设备本地保存自己的档案。换设备时导出再导入；不会自动把体态照片或记录上传到服务器。','登录同一账号读取云端档案；记录及已保存的体态照片随档案保存到云端。');
 }
 fs.writeFileSync(p,text);
}
fs.mkdirSync(path.join(root,'lib'),{recursive:true});fs.copyFileSync(path.join(source,'validation.js'),path.join(root,'lib/validation.js'));
 for(const file of [path.join(root,'lib/validation.js'),path.join(target,'validation.js')])fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace("['frequency',1,6]","['frequency',0,7]"));
 fs.copyFileSync(path.join(root,'lib/nutrition-plan.js'),path.join(target,'nutrition-plan.js'));
 const enginePath=path.join(target,'engine.js');let engine=fs.readFileSync(enginePath,'utf8');
 engine="import {videoTargets} from './nutrition-plan.js';\n"+engine;
 // Mobile HealthKit and meals must use the same device-local calendar day.
 engine=engine.replace("timeZone:'Asia/Seoul',",'');
 engine=engine.replace("const d=new Date(s+'T12:00:00+09:00');d.setUTCDate(d.getUTCDate()+n)","const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n)");
 const mobileApp=path.join(target,'app.js');fs.writeFileSync(mobileApp,fs.readFileSync(mobileApp,'utf8').replaceAll('首尔时区','设备当地时区').replaceAll('T12:00:00+09:00','T12:00:00'));
 engine=engine.replace('export function targets(s,date=dateKey()){','export function targets(s,date=dateKey()){if(s.profile.nutritionMethod===\'video\')return videoTargets(s.profile);');
 engine=engine.replace('({1:[1],2:[1,4]','({0:[],7:[0,1,2,3,4,5,6],1:[1],2:[1,4]');
 fs.writeFileSync(enginePath,engine);
for(const file of ['native-bridge.js','ios.css','home.js','home.css'])fs.copyFileSync(path.join(root,'workbench-overrides',file),path.join(target,file));
// Keep the validated UI/interaction baseline captured when the Today screen was restored.
// Native account, cloud and timeout fixes live outside these web assets.
const todayStage=path.join(root,'workbench-overrides','today-restored');
for(const file of ['app.js','portable-store.js'])fs.copyFileSync(path.join(todayStage,file),path.join(target,file));
const htmlPath=path.join(target,'index.html');fs.writeFileSync(htmlPath,fs.readFileSync(htmlPath,'utf8').replace('</head>','<link rel="stylesheet" href="/workbench/home.css"></head>'));
console.log('Synced six workbench pages, models, clips and native bridge.');

fs.cpSync(path.join(root,'workbench-overrides/exercise-gifs'),path.join(target,'exercise-gifs'),{recursive:true,filter:p=>!['onepull.gif'].includes(path.basename(p))});
