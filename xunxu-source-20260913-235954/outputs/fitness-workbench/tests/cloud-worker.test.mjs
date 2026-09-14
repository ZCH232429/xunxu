import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cloud-worker.mjs';
const request=(body={text:'推荐做法'},origin='https://xunxu.test')=>new Request('https://xunxu.test/api/assistant',{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)});
test('cloud assistant serves static assets and rejects foreign-origin requests before calling provider',async()=>{
 const env={ASSETS:{fetch:async()=>new Response('page')}};
 assert.equal(await (await worker.fetch(new Request('https://xunxu.test/'),env)).text(),'page');
 assert.equal((await worker.fetch(request({},'https://other.test'),env)).status,403);
 assert.equal((await worker.fetch(request(),env)).status,503);
});
test('cloud assistant parses actual Responses structure and reports provider failure',async()=>{
 const original=globalThis.fetch;
 const env={ARK_API_KEY:'test-only',ARK_MODEL:'test-model'};
 try{
  globalThis.fetch=async(url,opt)=>{
   assert.equal(url,'https://ark.cn-beijing.volces.com/api/v3/responses');
   assert.equal(JSON.parse(opt.body).model,'test-model');
   return Response.json({output:[{type:'reasoning',summary:[]},{type:'message',content:[{type:'output_text',text:'模拟厨房建议'}]}]});
  };
  assert.equal((await (await worker.fetch(request(),env)).json()).answer,'模拟厨房建议');
  globalThis.fetch=async()=>Response.json({error:{code:'ModelNotOpen'}},{status:404});
  const error=await worker.fetch(request(),env);
  assert.equal(error.status,502);
  assert.match((await error.json()).error,/尚未开通/);
 }finally{globalThis.fetch=original}
});
test('meal verification accepts an image, restricts food ids and returns estimated intake JSON',async()=>{
 const original=globalThis.fetch,env={ARK_API_KEY:'test-only',ARK_MODEL:'test-model'};
 try{
  globalThis.fetch=async(url,opt)=>{
   const sent=JSON.parse(opt.body);assert.equal(sent.store,false);assert.equal(sent.input[1].content[0].type,'input_image');assert.match(sent.input[1].content[1].text,/照片无法判断消化吸收率/);
   return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({dishName:'牛肉饭',ingredients:[{foodId:'rice',name:'不可信名称',actualGrams:150},{foodId:'unknown',name:'额外食材',actualGrams:99}],macros:{calories:390,protein:33,carbs:42,fat:9},confidence:'MEDIUM',notes:['餐盘估算']})}]}]});
  };
  const req=new Request('https://xunxu.test/api/meal/verify',{method:'POST',body:JSON.stringify({image:'data:image/jpeg;base64,AA==',text:'剩了一点饭',plan:{id:'p1',dishName:'牛肉饭',ingredients:[{foodId:'rice',name:'米饭',targetGrams:200}]},foods:[{id:'rice',name:'米饭',macrosPer100g:{calories:130,protein:2.5,carbs:28,fat:.3}}]})});
  const result=await (await worker.fetch(req,env)).json();assert.equal(result.ingredients.length,1);assert.equal(result.ingredients[0].name,'米饭');assert.equal(result.confidence,'MEDIUM');
 }finally{globalThis.fetch=original}
});
test('meal plan enrichment uses web search and only returns https recipe sources',async()=>{
 const original=globalThis.fetch,env={ARK_API_KEY:'test-only',ARK_MODEL:'test-model'};
 try{globalThis.fetch=async(url,opt)=>{const sent=JSON.parse(opt.body);assert.deepEqual(sent.tools,[{type:'web_search'}]);return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({plans:[{mealType:'DINNER',dishName:'洋葱炒牛肉',cookingMethodUrl:'https://example.com/recipe'},{mealType:'LUNCH',dishName:'无效',cookingMethodUrl:'javascript:alert(1)'}]})}]}]})};
  const req=new Request('https://xunxu.test/api/meal/plan',{method:'POST',body:JSON.stringify({plans:[{mealType:'DINNER',ingredients:[{foodId:'beef',name:'牛肉',targetGrams:150}]}]})});const result=await (await worker.fetch(req,env)).json();assert.equal(result.plans.length,1);assert.equal(result.plans[0].dishName,'洋葱炒牛肉');
 }finally{globalThis.fetch=original}
});
