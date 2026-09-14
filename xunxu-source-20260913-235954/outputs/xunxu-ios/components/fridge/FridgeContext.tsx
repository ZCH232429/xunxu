import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {cloudState} from '../../lib/cloud-state';
import {fromLegacy,toLegacy,consumeMeal as reduceConsume,savePlannedMeals as reducePlans,verifyPlannedMeal as reduceVerify} from '../../lib/fridge/core';
import type {FoodItem,MealPortion,PlannedMeal,VerifiedMealResult} from '../../lib/fridge/models';
import {useAccount} from '../auth-gate';
import {localDay} from '../../lib/health/calculations';
import {saveSupplement as reduceSupplement,SupplementLog} from '../../lib/fridge/supplements';

type Store={workspace:any;fridgeInventory:FoodItem[];loading:boolean;saving:boolean;error:string;reload:()=>Promise<void>;saveFood:(f:FoodItem)=>Promise<void>;saveSupplement:(entry:SupplementLog)=>Promise<void>;deleteSupplement:(id:string)=>Promise<void>;markSupplementTaken:(id:string,date:Date,eventId:string)=>Promise<void>;toggleDay:()=>Promise<void>;consumeMeal:(id:string,meal:string,portions:MealPortion[])=>Promise<void>;savePlannedMeals:(plans:PlannedMeal[])=>Promise<void>;verifyMeal:(planId:string,result:VerifiedMealResult,mealId:string)=>Promise<void>};
const Context=createContext<Store|null>(null);
export function useFridge(){const value=useContext(Context);if(!value)throw Error('FridgeProvider missing');return value;}
export function FridgeProvider({children,onWorkspaceChange,sharedRecord,managed=false}:{children:React.ReactNode;onWorkspaceChange?:(record:any)=>void;sharedRecord?:any;managed?:boolean}){
 const account=useAccount(),[record,setRecord]=useState<any>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const current=useRef<any>(null),lock=useRef(false),alive=useRef(true);
 async function reload(){setLoading(true);setError('');try{const r=await cloudState(account!.user.id,{});if(!r.state)throw Error('请先完成基础档案');r.state.foods.forEach(fromLegacy);current.current=r;onWorkspaceChange?.(r);if(alive.current)setRecord(r)}catch(e){if(alive.current)setError(e instanceof Error?e.message:'冰箱读取失败')}finally{if(alive.current)setLoading(false)}}
 // Native Today/Diet screens must be able to bootstrap themselves. Waiting only
 // for the hidden WebView to publish sharedRecord can leave the first screen on
 // an endless spinner when that WebView is slow or fails to load.
 useEffect(()=>{alive.current=true;if(!managed||!sharedRecord?.state)void reload();return()=>{alive.current=false;current.current=null}},[account?.user.id]);
 useEffect(()=>{if(sharedRecord?.state&&!lock.current&&(!current.current||sharedRecord.version>current.current.version)){current.current=sharedRecord;setRecord(sharedRecord);setLoading(false);setError('')}},[sharedRecord]);
 async function commit(transform:(s:any)=>any){
  if(lock.current)throw Error('正在保存，请稍候');if(!current.current)throw Error('冰箱尚未加载');
  lock.current=true;setSaving(true);
  try{const old=current.current,state=transform(old.state);if(state===old.state)return;const r=await cloudState(account!.user.id,{opt:{method:'PUT',body:JSON.stringify({version:old.version,state})}});current.current={version:r.version,state};onWorkspaceChange?.(current.current);if(alive.current){setRecord(current.current);setError('')}}
  finally{lock.current=false;if(alive.current)setSaving(false)}
 }
 const value:Store={workspace:record?.state,fridgeInventory:record?.state.foods.map(fromLegacy)||[],loading,saving,error,reload,
  markSupplementTaken:(id,date,eventId)=>commit(s=>{
   const logs:SupplementLog[]=s.supplementLogs||[];
   if(logs.some(x=>x.eventId===eventId))return s;
   const item=logs.find(x=>x.id===id);if(!item)return s;
   const day=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
   if(logs.some(x=>x.supplementId===id&&x.date===day))return s;
   return reduceSupplement(s,{...item,id:'taken-'+id+'-'+date.getTime(),recordKind:'intake',supplementId:id,eventId,date:day,time:String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0')});
  }),
  saveSupplement:entry=>commit(s=>reduceSupplement(s,entry)),
  deleteSupplement:id=>commit(s=>({...s,supplementLogs:(s.supplementLogs||[]).filter((x:SupplementLog)=>x.id!==id)})),
  toggleDay:()=>commit(s=>{const today=localDay().date;return {...s,closedDays:s.closedDays.includes(today)?s.closedDays.filter((x:string)=>x!==today):[...s.closedDays,today]}}),
  saveFood:f=>commit(s=>({...s,foods:s.foods.some((x:any)=>x.id===f.id)?s.foods.map((x:any)=>x.id===f.id?{...x,...toLegacy(f)}:x):[...s.foods,toLegacy(f)]})),
  savePlannedMeals:plans=>commit(s=>reducePlans(s,localDay().date,plans)),
  verifyMeal:(planId,result,mealId)=>commit(s=>reduceVerify(s,planId,result,mealId)),
  consumeMeal:(id,meal,portions)=>commit(s=>reduceConsume(s,{id,date:localDay().date,meal,portions}))};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
