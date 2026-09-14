import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {cloudState} from '../cloud-state';
import {calculateBasics} from '../nutrition-plan';
import {HealthKitService} from './HealthKitService';
import {energyBalance,localDay} from './calculations';
import {mergeHealthSummary} from './records';
import type {HealthDashboardModel,HealthDashboardState} from './model';

function timeout<T>(promise:Promise<T>):Promise<T>{
  let timer:ReturnType<typeof setTimeout>;
  return Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('读取超时，请检查网络并解锁 iPhone 后重试')),25000)})]).finally(()=>clearTimeout(timer));
}

export function useHealthDashboard(userId:string){
  const service=useRef(new HealthKitService()).current;
  const [state,setState]=useState<HealthDashboardState>({status:'isLoading'});
  const [saveMessage,setSaveMessage]=useState(''),[saving,setSaving]=useState(false);
  const generation=useRef(0),busy=useRef(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++}},[userId]);
  const refresh=useCallback(async(request=false)=>{
    if(busy.current)return;
    busy.current=true;const id=++generation.current;
    const update=(s:HealthDashboardState)=>{if(alive.current&&id===generation.current)setState(s)};
    setSaveMessage('');update({status:'isLoading'});
    try{
      const reason=service.unavailableReason();if(reason){update({status:'unavailable',message:reason});return;}
      if(request)await service.requestPermissions(userId);
      else if(await timeout(service.needsRequest(userId))){update({status:'needsPermission'});return;}
      const workspace=await timeout(cloudState(userId,{}));
      if(!workspace.state)throw Error('请先完成基础信息');
      const profile=workspace.state.profile,plan=calculateBasics(profile),now=new Date(),day=localDay(now);
      const raw=await timeout(service.fetchDashboard(profile.age,now));
      if(raw.energy.value===null&&!raw.heart?.hasData&&raw.sleep.total===null&&raw.steps===null&&raw.rhr===null){
        update(raw.warnings.length?{status:'error',message:raw.warnings.join('\n')}:{status:'noData',message:'未读到今日运动或昨夜睡眠数据。可能尚未同步，也可能未允许读取。请在 Apple 健康中检查循序的访问权限。'});return;
      }
      const intake=workspace.state.meals.filter((m:any)=>m.date===day.date).reduce((sum:number,m:any)=>sum+m.kcal,0);
      const activeEnergy=Math.round(raw.energy.value??0),targetDeficit=Math.round(Math.max(0,plan.deficit??0));
      // The activity coefficient in plan.tdee ALREADY includes activity. Use RMR as the activity-free baseline.
      const baseEnergy=Math.round(plan.rmr);
      const data:HealthDashboardModel={date:day.date,updatedAt:now.toISOString(),activeEnergy,...energyBalance(baseEnergy,activeEnergy,intake,targetDeficit),baseEnergy,intake:Math.round(intake),targetDeficit,
        fatBurnZoneMinutes:raw.heart?.minutes??0,coverageMinutes:raw.heart?.coverageMinutes??0,zone:raw.heart?.zone??[Math.round((220-profile.age)*.6),Math.round((220-profile.age)*.7)],
        sleepDuration:raw.sleep.coreDeep??0,totalSleepDuration:raw.sleep.total,steps:raw.steps===null?null:Math.round(raw.steps),restingHeartRate:raw.rhr===null?null:Math.round(raw.rhr),
        intakeComplete:workspace.state.closedDays.includes(day.date),available:{activeEnergy:raw.energy.value!==null,heartRate:(raw.heart?.coverageMinutes??0)>0,sleep:raw.sleep.coreDeep!==null},sources:raw.energy.sources,warnings:raw.warnings};
      if(!data.available.activeEnergy)data.ringProgress=0;
      update({status:'success',data});
    }catch(e){update({status:'error',message:e instanceof Error?e.message:'读取健康数据失败'});}
    finally{busy.current=false;}
  },[service,userId]);
  useFocusEffect(useCallback(()=>{void refresh();const sub=AppState.addEventListener('change',s=>{if(s==='active')void refresh()});return()=>sub.remove()},[refresh]));

  async function save(){
    if(state.status!=='success'||saving)return;
    setSaving(true);setSaveMessage('');
    try{
      const d=state.data;
      // Re-read the current version. The existing RPC rejects concurrent writes instead of overwriting another device.
      const row=await timeout(cloudState(userId,{}));if(!row.state)throw Error('云端档案不存在');
      const stateToSave={...row.state,health:mergeHealthSummary(row.state.health,d)};
      await timeout(cloudState(userId,{opt:{method:'PUT',body:JSON.stringify({version:row.version,state:stateToSave})}}));
      if(alive.current)setSaveMessage('今日汇总已保存到你的云端健康记录。');
      return true;
    }catch(e){if(alive.current)setSaveMessage(e instanceof Error?e.message:'保存失败');return false;}
    finally{if(alive.current)setSaving(false)}
  }
  return {state,refresh,save,saving,saveMessage};
}
