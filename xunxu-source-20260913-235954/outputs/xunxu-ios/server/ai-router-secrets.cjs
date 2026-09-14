const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
let cached,modified;
function getRouteSecrets(){
 if(process.env.ARK_LITE_API_KEY)return {ARK_LITE_API_KEY:process.env.ARK_LITE_API_KEY};
 const file=path.join(process.env.APPDATA||'','循序','ai-route-keys.json');
 if(!fs.existsSync(file))return {};
 const stamp=fs.statSync(file).mtimeMs;
 if(cached&&stamp===modified)return cached;
 const command="$env:PSModulePath=Join-Path $PSHOME 'Modules'; $c=Get-Content -LiteralPath $env:XUNXU_ROUTE_KEYS -Raw|ConvertFrom-Json; if($c.encryptedLiteKey){$s=ConvertTo-SecureString $c.encryptedLiteKey; $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}}";
 const secret=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,XUNXU_ROUTE_KEYS:file}}).trim();
 modified=stamp;cached=secret?{ARK_LITE_API_KEY:secret}:{};return cached;
}
module.exports={getRouteSecrets};
