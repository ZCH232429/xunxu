import {app,BrowserWindow,dialog} from 'electron';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

app.setName('循序');
const here=path.dirname(fileURLToPath(import.meta.url));
let server,mainWindow;
const dataDir=path.join(app.getPath('userData'),'data');
function loadUserSecret(name){
  if(process.env[name])return;
  try{const text=execFileSync('reg',['query','HKCU\\Environment','/v',name],{windowsHide:true,encoding:'utf8'});const value=text.trim().split(/\s{2,}/).at(-1);if(value&&value!==name)process.env[name]=value}catch{}
}
function loadEncryptedDoubao(){
  try{
    const configPath=path.join(app.getPath('userData'),'doubao-config.json');
    const command="$env:PSModulePath=Join-Path $PSHOME 'Modules'; $c=Get-Content -LiteralPath $env:XUNXU_CONFIG_FILE -Raw|ConvertFrom-Json; $s=ConvertTo-SecureString $c.encryptedKey; $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { @{key=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p);model=$c.model}|ConvertTo-Json -Compress } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }";
    const config=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,XUNXU_CONFIG_FILE:configPath}}));
    if(config.key&&config.model){process.env.ARK_API_KEY=config.key;process.env.ARK_MODEL=config.model;}
  }catch{/* User environment remains available if no encrypted configuration exists. */}
}

function openWindow(port){
  mainWindow=new BrowserWindow({
    width:1440,height:920,minWidth:1024,minHeight:700,
    title:'循序 · 减脂健身工作台',
    autoHideMenuBar:true,
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}
  });
  mainWindow.loadURL(`http://127.0.0.1:${port}`);
  mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
}

if(!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus()}});
  app.whenReady().then(async()=>{
    process.env.FIT_WORKBENCH_DATA=dataDir;
    loadEncryptedDoubao();
    loadUserSecret('ARK_API_KEY');
    loadUserSecret('ARK_MODEL');
    const {start}=await import('./server.mjs');
    server=start({port:0});
    server.once('listening',()=>openWindow(server.address().port));
    server.once('error',error=>dialog.showErrorBox('循序无法启动',error.message));
  });
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',()=>server?.close());
}

