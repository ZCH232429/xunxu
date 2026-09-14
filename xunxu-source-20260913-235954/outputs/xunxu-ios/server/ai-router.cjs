// Expo development gateway only. Production Node deploys should compile TS ahead of time.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const {readRoutingConfig,routingStatus} = require('./ai-router-config.cjs');
let AILogicRouter;
function loadRouter() {
  if (AILogicRouter) return AILogicRouter;
  const ts = require('typescript');
  const filename = path.resolve(__dirname,'../services/aiRouter.ts');
  const compiled = new Module(filename,module);
  compiled.filename=filename;compiled.paths=module.paths;
  compiled._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
  }).outputText,filename);
  AILogicRouter=compiled.exports.AILogicRouter;
  return AILogicRouter;
}
async function handleRouter(endpoint, raw, getCredentials, signal) {
  try {
    const config = readRoutingConfig();
    if (endpoint === '/api/ai/status') return {status:200,data:routingStatus(config)};
    if (config.missing.length === 4 || config.invalid.length) return {status:503,data:{error:'AI专用接入点尚未配置或配置无效',code:'CONFIG',missing:config.missing,invalid:config.invalid}};
    let input;try {input=JSON.parse(raw);} catch {return {status:400,data:{error:'请求JSON无效',code:'INPUT'}};}
    const credentials = getCredentials();
    const Router = loadRouter();
    const router = Router.fromEnv({...config.endpoints,ARK_API_KEY:credentials.ARK_API_KEY,...require('./ai-router-secrets.cjs').getRouteSecrets()});
    const data = await router.processInput(input,signal);
    return {status:200,data};
  } catch(error) {
    const known = error.name === 'AIRouterError';
    const status = error.code === 'CANCELLED' ? 499 : error.code === 'TIMEOUT' ? 504
      : ['INPUT','NEEDS_CONTEXT'].includes(error.code) ? 400 : error.code === 'CONFIG' ? 503 : 502;
    return {status,data:{code:known?error.code:'ROUTER_UNAVAILABLE',error:known?error.message:'AI路由暂不可用，请检查服务端配置'}};
  }
}
module.exports = {handleRouter};
