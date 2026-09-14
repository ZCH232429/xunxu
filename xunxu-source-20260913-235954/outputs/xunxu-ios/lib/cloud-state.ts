import {supabase} from './supabase';
import {validState} from './validation';
import {hasBasics} from './nutrition-plan';

const CLOUD_TIMEOUT_MS=15000;
async function within<T>(promise:PromiseLike<T>,message:string):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([
  Promise.resolve(promise),
  new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),CLOUD_TIMEOUT_MS)}),
 ])}finally{if(timer)clearTimeout(timer)}
}

export async function cloudState(userId:string,data:any):Promise<{version:number;state?:any}>{
 if(!supabase)throw Error('云服务尚未配置');
 const {data:{session}}=await within(supabase.auth.getSession(),'登录状态读取超时，请检查网络后重试');
 if(session?.user.id!==userId)throw Error('登录状态已改变，请重新打开工作台');
 if(data.opt?.method==='PUT'){
  const value=JSON.parse(data.opt.body);validState(value.state);
  if(value.state.profile.onboardingVersion===1&&!hasBasics(value.state.profile))throw Error('基础信息或视频档位无效，请重新核对');
  const {data:version,error}=await within(supabase.rpc('save_workspace',{expected_version:value.version,new_state:value.state}),'云端保存超时，未确认保存成功，请刷新核对');
  if(error)throw Error(error.message.includes('version_conflict')?'其他设备已修改档案，请刷新后重试':'云端保存失败：'+error.message);
  return {version};
 }
 const {data:row,error}=await within(supabase.from('workspaces').select('version,state').eq('user_id',userId).maybeSingle(),'云端档案读取超时，请检查网络后重试');
 if(error)throw Error('无法读取云端档案：'+error.message);
 if(row)validState(row.state);
 return row||{version:0,state:data.empty};
}
