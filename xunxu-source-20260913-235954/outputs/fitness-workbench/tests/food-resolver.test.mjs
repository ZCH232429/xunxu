import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveFood,checkedFood} from '../food-resolver.mjs';
const food={name:'测试牛肉',basis:100,kcal:120,p:22,c:0,f:3,stockGrams:300,kind:'estimate'};
const env={ARK_API_KEY:'test',ARK_MODEL:'test'};
const req=body=>new Request('https://xunxu.test/api/food/resolve',{method:'POST',body:JSON.stringify(body)});
test('missing nutrients are not converted to zero; impossible macros rejected',()=>{
 assert.throws(()=>checkedFood({...food,p:null}));assert.throws(()=>checkedFood({...food,p:110}));assert.equal(checkedFood(food).sodium,null);
});
test('manual lookup requires actual search evidence and tool errors stay visible',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>Response.json({error:{code:'ToolNotOpen'}},{status:404});
  assert.match((await (await resolveFood(req({mode:'manual',text:'生牛后腿肉300g'}),env)).json()).error,/联网搜索尚未开通/);
  globalThis.fetch=async()=>Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(food)}]}]});
  assert.match((await (await resolveFood(req({mode:'manual',text:'生牛后腿肉300g'}),env)).json()).error,/可追溯/);
  globalThis.fetch=async(url,options)=>{assert.equal(JSON.parse(options.body).tools[0].type,'web_search');return Response.json({output:[{type:'web_search_call',results:[{url:'https://fdc.nal.usda.gov/food/1',title:'测试来源'}]},{type:'message',content:[{type:'output_text',text:JSON.stringify(food)}]}]})};
  const result=await (await resolveFood(req({mode:'manual',text:'生牛后腿肉300g'}),env)).json();assert.equal(result.stockGrams,300);assert.equal(result.sources.length,1);assert.equal(result.searched,true);
 }finally{globalThis.fetch=original}
});
test('photo reaches multimodal API without legacy vision configuration',async()=>{
 const original=globalThis.fetch;try{globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.input[1].content[1].type,'input_image');return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...food,kind:'label'})}]}]})};assert.equal((await resolveFood(req({mode:'photo',image:'data:image/png;base64,AAAA'}),env)).status,200)}finally{globalThis.fetch=original}
});
test('unknown Korean barcode uses exact search and rejects unconfirmed matching',async()=>{
 const original=globalThis.fetch;let calls=0;try{globalThis.fetch=async(url)=>{calls++;return url.includes('openfoodfacts')?Response.json({status:0}):Response.json({output:[{type:'web_search_call',results:[{url:'https://example.com/product'}]},{type:'message',content:[{type:'output_text',text:JSON.stringify({...food,barcodeMatch:false})}]}]})};assert.match((await (await resolveFood(req({mode:'barcode',code:'8801234567893'}),env)).json()).error,/条码/);assert.equal(calls,2)}finally{globalThis.fetch=original}
});
