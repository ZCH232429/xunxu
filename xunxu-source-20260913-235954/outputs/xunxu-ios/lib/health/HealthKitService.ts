import {Platform} from 'react-native';
import Constants, {ExecutionEnvironment} from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {heartZone,localDay,sleepHours} from './calculations';

const readTypes = ['HKQuantityTypeIdentifierHeartRate','HKQuantityTypeIdentifierActiveEnergyBurned','HKCategoryTypeIdentifierSleepAnalysis','HKQuantityTypeIdentifierStepCount','HKQuantityTypeIdentifierRestingHeartRate'] as const;
const requestKey = 'xunxu-health-request-v1:';

export class HealthKitService {
  private module?: typeof import('@kingstinct/react-native-healthkit');
  unavailableReason(){
    if(Platform.OS!=='ios')return '请在 iPhone 的循序开发版中连接 Apple 健康。网页和 Android 不支持 HealthKit。';
    if(Constants.executionEnvironment===ExecutionEnvironment.StoreClient)return 'Expo Go 不包含 HealthKit。需要先安装循序 iOS 开发构建，再在此授权；无需单独安装 Watch App。';
    return null;
  }
  private async native(){
    const reason=this.unavailableReason();if(reason)throw Error(reason);
    // Never evaluate the Nitro module in Expo Go or on web.
    if(!this.module)this.module=await import('@kingstinct/react-native-healthkit');
    if(!this.module.isHealthDataAvailable())throw Error('此设备无法使用 Apple 健康');
    return this.module;
  }
  async needsRequest(userId:string){
    const hk=await this.native();
    return !await AsyncStorage.getItem(requestKey+userId)||(await hk.getRequestStatusForAuthorization({toRead:readTypes}))===1;
  }
  async requestPermissions(userId:string){
    const hk=await this.native();
    const finished=await hk.requestAuthorization({toRead:readTypes,toShare:[]});
    if(!finished)throw Error('健康授权流程未完成，请重试');
    // This records only that the dialog completed, never that read access was granted.
    await AsyncStorage.setItem(requestKey+userId,'requested');
  }
  async fetchTodayActiveEnergy(now=new Date()){
    const hk=await this.native(),day=localDay(now);
    const result=await hk.queryStatisticsForQuantity('HKQuantityTypeIdentifierActiveEnergyBurned',['cumulativeSum'],{unit:'kcal',filter:{date:{startDate:day.start,endDate:day.end,strictStartDate:true,strictEndDate:true}}});
    return {value:result.sumQuantity?.quantity??null,sources:result.sources.map(s=>s.name)};
  }
  async calculateFatBurnTime(age:number,now=new Date()){
    const hk=await this.native(),day=localDay(now);
    const samples=await hk.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate',{unit:'count/min',limit:0,ascending:true,filter:{date:{startDate:day.start,endDate:day.end,strictStartDate:true,strictEndDate:true}}});
    return heartZone(samples,age,day.start,day.end);
  }
  async fetchSleep(now=new Date()){
    const hk=await this.native(),day=localDay(now);
    const samples=await hk.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis',{limit:0,filter:{date:{startDate:day.sleepStart,endDate:day.sleepEnd}}});
    return {coreDeep:sleepHours(samples,day.sleepStart,day.sleepEnd),total:sleepHours(samples,day.sleepStart,day.sleepEnd,[1,3,4,5])};
  }
  private async metric(type:'HKQuantityTypeIdentifierStepCount'|'HKQuantityTypeIdentifierRestingHeartRate',now:Date){
    const hk=await this.native(),day=localDay(now);
    const result=await hk.queryStatisticsForQuantity(type,[type==='HKQuantityTypeIdentifierStepCount'?'cumulativeSum':'discreteAverage'],{unit:type==='HKQuantityTypeIdentifierStepCount'?'count':'count/min',filter:{date:{startDate:day.start,endDate:day.end,strictStartDate:true,strictEndDate:true}}});
    return result.sumQuantity?.quantity??result.averageQuantity?.quantity??null;
  }
  async fetchDashboard(age:number,now=new Date()){
    const results=await Promise.allSettled([this.fetchTodayActiveEnergy(now),this.calculateFatBurnTime(age,now),this.fetchSleep(now),this.metric('HKQuantityTypeIdentifierStepCount',now),this.metric('HKQuantityTypeIdentifierRestingHeartRate',now)] as const);
    const [energy,heart,sleep,steps,rhr]=results;
    const labels=['活动消耗','心率','睡眠','步数','静息心率'];
    const warnings=results.flatMap((r,i)=>r.status==='rejected'?[labels[i]+'读取失败，请解锁 iPhone 后刷新并检查健康权限。']:[]);
    if(results.every(r=>r.status==='rejected'))throw Error(warnings.join('\n'));
    return {energy:energy.status==='fulfilled'?energy.value:{value:null,sources:[]},heart:heart.status==='fulfilled'?heart.value:null,sleep:sleep.status==='fulfilled'?sleep.value:{coreDeep:null,total:null},steps:steps.status==='fulfilled'?steps.value:null,rhr:rhr.status==='fulfilled'?rhr.value:null,warnings};
  }
}
