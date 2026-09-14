const fs = require('node:fs');
const path = require('node:path');
const names = ['EXPO_PUBLIC_EP_VISION','EXPO_PUBLIC_EP_PRO','EXPO_PUBLIC_EP_PRO_128K','EXPO_PUBLIC_EP_LITE'];
function readRoutingConfig(env = process.env, file = path.join(env.APPDATA || '', '循序', 'ai-routing.json')) {
  let saved = {};
  if (fs.existsSync(file)) {
    try { saved = JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')); }
    catch { throw Error('AI路由配置文件无法读取，请重新配置'); }
  }
  const endpoints = Object.fromEntries(names.map(name => [name, String(env[name] || saved[name] || '').trim()]));
  const missing = names.filter(name => !endpoints[name]);
  const invalid = names.filter(name => endpoints[name] && !/^[A-Za-z0-9][A-Za-z0-9._-]{1,199}$/.test(endpoints[name]));
  // Speech credentials belong to its own service; Ark API keys are not reused.
  const speech = {
    asr: { configured: !!env.VOLC_ASR_API_KEY && !!env.VOLC_ASR_RESOURCE_ID, verified:false },
    tts: { configured: !!env.VOLC_TTS_API_KEY && !!env.VOLC_TTS_RESOURCE_ID && !!env.VOLC_TTS_VOICE, verified:false },
  };
  return {endpoints,missing,invalid,speech};
}
function routingStatus(config) {
  return { provider:'doubao', ready:false, endpointConfigurationComplete:config.missing.length===0 && config.invalid.length===0,
    verified:false, missing:config.missing, invalid:config.invalid,
    routes:Object.fromEntries(names.map(name=>[name,{configured:!!config.endpoints[name],verified:false}])),
    speech:config.speech, speechAdapterInstalled:false };
}
module.exports = {readRoutingConfig,routingStatus};
