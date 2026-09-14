import {validState} from './validation.js';
const open=indexedDB.open('xunxu-workbench',1);open.onupgradeneeded=()=>open.result.createObjectStore('profiles');
const db=()=>new Promise((resolve,reject)=>{open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error)});
export async function localRequest(url,options={},empty){
 if(url==='/api/status')return {portable:true,vision:false,aiProvider:'doubao',searchProvider:'doubao',videoKeys:[]};
 if(url.startsWith('/api/state/')){const id=url.endsWith('/demo')?'demo':'personal',database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('profiles',options.method==='PUT'?'readwrite':'readonly'),store=tx.objectStore('profiles'),request=store.get(id);let result;request.onsuccess=()=>{const old=request.result||{version:0,state:empty()};if(options.method==='PUT'){let next;try{next=JSON.parse(options.body);validState(next.state)}catch(error){tx.abort();reject(error);return}if(next.version!==old.version){tx.abort();reject(Error('此档案已在其他页面更新，请刷新后重试'));return}result={version:old.version+1};store.put({version:result.version,state:next.state},id)}else result=old};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||Error('本机存储失败，请检查可用空间'));tx.onabort=()=>reject(Error('保存被取消，请重新打开档案'))})}
 throw Error('AI 与联网检索仅通过豆包后台提供，请连接循序服务后重试');
}
