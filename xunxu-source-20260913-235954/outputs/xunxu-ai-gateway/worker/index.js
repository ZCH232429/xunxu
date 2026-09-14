const origin = 'https://xunxu-fitness-workbench.mousaavigael659.chatgpt.site';
const headers = {'content-type':'application/json; charset=utf-8','access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type','vary':'Origin'};
export default {async fetch(request, env) {
  if (request.method === 'OPTIONS') return new Response(null,{headers});
  const url = new URL(request.url);
  if (url.pathname !== '/api/assistant' || request.method !== 'POST') return new Response(JSON.stringify({error:'Not found'}),{status:404,headers});
  if (!env.ARK_API_KEY || !env.ARK_MODEL) return new Response(JSON.stringify({error:'豆包尚未配置火山方舟 API Key 和模型 ID，请在服务端完成配置。'}),{status:503,headers});
  try {
    const body = await request.json(), text = String(body.text || '').trim();
    if (!text || text.length > 1000) throw Error('请输入不超过 1000 字的问题');
    const context = JSON.stringify(body.context || {}).slice(0,12000);
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/responses',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${env.ARK_API_KEY}`},body:JSON.stringify({model:env.ARK_MODEL,store:false,input:[{role:'system',content:'You are a nutrition cooking assistant. Reply concisely in Chinese. Use only the supplied inventory and macro context. State weights in grams, distinguish raw/cooked weights, and flag missing nutrition data. Do not diagnose medical conditions.'},{role:'user',content:`问题：${text}\n\n工作台上下文：${context}`} ]}) ,signal:AbortSignal.timeout(60000)});
    const data = await response.json();
    if (!response.ok) {
      const code=String(data.error?.code || data.error?.type || 'upstream_error');
      const message=code==='insufficient_quota'?'豆包 API 额度不足，请检查 API 账户余额及项目预算。':response.status===401?'服务端 API 密钥无效或已撤销。':response.status===429?'豆包 请求受到限制，请稍后重试。':response.status===403?'豆包 拒绝访问，请检查项目权限和服务地区。':`豆包 服务返回错误（${response.status}，${code}）。`;
      console.error(JSON.stringify({upstreamStatus:response.status,code,requestId:response.headers.get('x-request-id')}));
      return new Response(JSON.stringify({error:message,code}),{status:502,headers});
    }
    const answer=(data.output || []).filter(item=>item.type==='message').flatMap(item=>item.content || []).filter(item=>item.type==='output_text').map(item=>item.text).join('\n').trim();
    if (!answer) throw Error('豆包 未返回文字回复，请重试。');
    return new Response(JSON.stringify({answer}),{headers});
  } catch (error) { return new Response(JSON.stringify({error:error.message || '请求失败'}),{status:422,headers}); }
}};
