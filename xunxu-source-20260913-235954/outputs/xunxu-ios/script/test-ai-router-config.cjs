const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {readRoutingConfig,routingStatus}=require('../server/ai-router-config.cjs');
const {handleRouter}=require('../server/ai-router.cjs');
(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'xunxu-router-config-'));
 const file=path.join(folder,'ai-routing.json');
 try {
  const empty=readRoutingConfig({},file);assert.equal(empty.missing.length,4);assert.equal(routingStatus(empty).ready,false);
  const ids={EXPO_PUBLIC_EP_VISION:'ep-test-vision',EXPO_PUBLIC_EP_PRO:'ep-test-pro',EXPO_PUBLIC_EP_PRO_128K:'ep-test-long',EXPO_PUBLIC_EP_LITE:'ep-test-lite'};
  fs.writeFileSync(file,JSON.stringify(ids));
  const full=readRoutingConfig({EXPO_PUBLIC_EP_LITE:'ep-env-lite',VOLC_ASR_API_KEY:'test-secret',VOLC_ASR_RESOURCE_ID:'test-resource'},file);
  assert.equal(full.endpoints.EXPO_PUBLIC_EP_LITE,'ep-env-lite');assert.equal(full.missing.length,0);
  assert.equal(routingStatus(full).endpointConfigurationComplete,true);assert.equal(routingStatus(full).ready,false);
  assert(!JSON.stringify(routingStatus(full)).includes('test-secret'));
  assert.equal(readRoutingConfig({EXPO_PUBLIC_EP_LITE:'https://bad.example'},file).invalid.length,1);
  fs.writeFileSync(file,'broken');assert.throws(()=>readRoutingConfig({},file));
  const status=await handleRouter('/api/ai/status','',()=>{throw Error('status must not decrypt credentials')});
  assert.equal(status.status,200);assert.equal(status.data.verified,false);
  if(status.data.missing.length===4){const blocked=await handleRouter('/api/ai/route','{}',()=>{throw Error('missing config must not access credentials')});assert.equal(blocked.status,503);assert.equal(blocked.data.code,'CONFIG');}
  console.log('PASS: configuration precedence, four endpoint validation, missing config, unverified readiness, secret-free status.');
 }finally{if(fs.existsSync(file))fs.unlinkSync(file);fs.rmdirSync(folder);}
})().catch(e=>{console.error(e);process.exitCode=1});
