import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {SupplementLog} from './supplements';
const category='xunxu-supplement',action='taken';
const notifications=()=>import('expo-notifications');
const key=(user:string,id:string)=>`xunxu-reminder:${user}:${id}`;
export async function configureReminder(user:string,item:SupplementLog,enabled:boolean){
 if(Platform.OS==='web')throw Error('请在 iPhone App 中设置通知提醒');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time))throw Error('请填写 HH:mm 格式的时间');
 const n=await notifications(),storeKey=key(user,item.id),old=await AsyncStorage.getItem(storeKey);
 if(!enabled){if(old)await n.cancelScheduledNotificationAsync(old);await AsyncStorage.removeItem(storeKey);return}
 const permission=await n.requestPermissionsAsync({ios:{allowAlert:true,allowSound:true,allowBadge:false}});
 if(!permission.granted&&permission.ios?.status!==n.IosAuthorizationStatus.PROVISIONAL)throw Error('通知权限未开启，请在 iPhone 设置中允许通知');
 await n.setNotificationCategoryAsync(category,[{identifier:action,buttonTitle:'已服用',options:{opensAppToForeground:true}}]);
 const [hour,minute]=item.time.split(':').map(Number);
 const id=await n.scheduleNotificationAsync({content:{title:'循序 · 补剂提醒',body:`${item.name} · ${item.amount} ${item.unit}`,sound:'default',categoryIdentifier:category,data:{userId:user,supplementId:item.id}},trigger:{type:n.SchedulableTriggerInputTypes.DAILY,hour,minute}});
 if(old)await n.cancelScheduledNotificationAsync(old);
 await AsyncStorage.setItem(storeKey,id);
}
export async function reminderEnabled(user:string,id:string){return !!await AsyncStorage.getItem(key(user,id))}
export async function cancelUserReminders(user:string){
 if(Platform.OS==='web')return;
 const n=await notifications(),keys=(await AsyncStorage.getAllKeys()).filter(x=>x.startsWith(`xunxu-reminder:${user}:`));
 for(const k of keys){const id=await AsyncStorage.getItem(k);if(id)await n.cancelScheduledNotificationAsync(id);await AsyncStorage.removeItem(k)}
}
export async function listenForTaken(user:string,onTaken:(id:string,date:Date,eventId:string)=>Promise<void>,onError:(message:string)=>void){
 if(Platform.OS==='web')return ()=>{};
 const n=await notifications();
 n.setNotificationHandler({handleNotification:async()=>({shouldPlaySound:true,shouldSetBadge:false,shouldShowBanner:true,shouldShowList:true})});
 let working=false;
 let serial=Promise.resolve();
 const pendingKey=`xunxu-taken-pending:${user}`;
 async function flush(){if(working)return;working=true;try{const events=JSON.parse(await AsyncStorage.getItem(pendingKey)||'[]');while(events.length){const e=events[0];await onTaken(e.id,new Date(e.at),e.eventId);events.shift();await AsyncStorage.setItem(pendingKey,JSON.stringify(events))}}catch(e){onError(e instanceof Error?e.message:'服用记录待同步')}finally{working=false}}

 async function handle(r:import('expo-notifications').NotificationResponse){
  const d=r.notification.request.content.data;
  if(r.actionIdentifier!==action||!d||d.userId!==user||typeof d.supplementId!=='string')return;
  const eventId=r.notification.request.identifier+':'+r.notification.date;
  const events=JSON.parse(await AsyncStorage.getItem(pendingKey)||'[]');if(!events.some((e:any)=>e.eventId===eventId))events.push({id:d.supplementId,at:Date.now(),eventId});await AsyncStorage.setItem(pendingKey,JSON.stringify(events));await flush();
 }
 await flush();const last=await n.getLastNotificationResponseAsync();if(last)await handle(last);
 const sub=n.addNotificationResponseReceivedListener(r=>{serial=serial.then(()=>handle(r)).catch(e=>onError(e.message))});
 return ()=>sub.remove();
}
