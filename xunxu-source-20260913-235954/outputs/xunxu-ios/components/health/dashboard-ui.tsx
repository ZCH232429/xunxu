import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated as RNAnimated,Easing as RNEasing,Pressable,StyleSheet,Text,View} from 'react-native';
import Svg,{Circle,G} from 'react-native-svg';
import Animated,{useSharedValue,useAnimatedProps,withSpring,ReduceMotion} from 'react-native-reanimated';
import type {HealthDashboardModel} from '../../lib/health/model';

const AnimatedCircle=Animated.createAnimatedComponent(Circle);
export const styles=StyleSheet.create({
  page:{padding:16,gap:12,paddingBottom:48,backgroundColor:'#111',flexGrow:1},
  card:{padding:24,borderRadius:32,gap:12},
  title:{fontFamily:'PingFang SC',fontSize:30,fontWeight:'800',color:'#fff'},
  black:{fontFamily:'PingFang SC',color:'#111'},
  copy:{fontFamily:'PingFang SC',fontSize:14,lineHeight:22,color:'#111'},
  white:{fontFamily:'PingFang SC',fontSize:14,lineHeight:22,color:'#fff'},
  pill:{backgroundColor:'#111',padding:17,borderRadius:999,alignItems:'center',minHeight:48},
  small:{fontFamily:'PingFang SC',fontSize:12,color:'#111'},
});

export function Action({label,onPress,disabled=false}:{label:string;onPress:()=>void;disabled?:boolean}){
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[styles.pill,{opacity:disabled?.5:1}]}><Text style={[styles.white,{fontWeight:'700'}]}>{label}</Text></Pressable>;
}
function NumberValue({value,decimals=0,color='#111',size=46}:{value:number|null;decimals?:number;color?:string;size?:number}){
  const animation=useRef(new RNAnimated.Value(0)).current,[shown,setShown]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    const listener=animation.addListener(({value:v})=>setShown(v));
    void AccessibilityInfo.isReduceMotionEnabled().then(reduced=>{
      if(cancelled)return;animation.setValue(0);
      RNAnimated.timing(animation,{toValue:value??0,duration:reduced?0:1500,easing:RNEasing.out(RNEasing.cubic),useNativeDriver:false}).start();
    });
    return()=>{cancelled=true;animation.stopAnimation();animation.removeListener(listener)};
  },[value,animation]);
  return <Text accessibilityLabel={value===null?'暂无数据':value.toFixed(decimals)} style={{fontFamily:'PingFang SC',fontSize:size,fontWeight:'800',color,fontVariant:['tabular-nums']}}>{value===null?'—':shown.toFixed(decimals)}</Text>;
}

export function PermissionRequestCard({onRequest}:{onRequest:()=>void}){
  return <View style={[styles.card,{backgroundColor:'#baf3dd'}]}><Text style={[styles.black,{fontSize:26,fontWeight:'800'}]}>让每一步都有记录</Text><Text style={styles.copy}>读取 Apple 健康中的活动消耗、心率、静息心率、步数与睡眠。Apple Watch 的记录同步至 iPhone 后会一并读取。</Text><Text style={styles.copy}>仅申请读取，不写入 Apple 健康。数据先在本机展示；你可另行选择将每日汇总保存到当前账号的云端档案。</Text><Action label="连接 Apple 健康" onPress={onRequest}/></View>;
}

export function CalorieDeficitRing({data}:{data:HealthDashboardModel}){
  const progress=useSharedValue(0),circumference=2*Math.PI*102;
  useEffect(()=>{progress.value=0;progress.value=withSpring(data.ringProgress,{duration:1500,dampingRatio:.85,overshootClamping:true,reduceMotion:ReduceMotion.System})},[data.ringProgress,progress]);
  const animatedProps=useAnimatedProps(()=>({strokeDashoffset:circumference*(1-progress.value)}));
  return <View style={[styles.card,{backgroundColor:'#d7ff7a'}]}>
    <Text style={styles.small}>ENERGY BALANCE · {data.date}</Text>
    <Text style={[styles.black,{fontSize:24,fontWeight:'800'}]}>今日估算热量缺口</Text>
    <View style={{width:'100%',maxWidth:280,aspectRatio:1,alignSelf:'center',alignItems:'center',justifyContent:'center'}}>
      <Svg width="100%" height="100%" viewBox="0 0 260 260" style={{position:'absolute'}}><Circle cx="130" cy="130" r="102" stroke="#b0d367" strokeWidth="17" fill="none"/><G transform="rotate(-90 130 130)"><AnimatedCircle cx="130" cy="130" r="102" stroke="#111" strokeWidth="17" fill="none" strokeLinecap="round" strokeDasharray={[circumference,circumference]} animatedProps={animatedProps}/></G></Svg>
      <NumberValue value={data.available.activeEnergy?data.calorieDeficit:null} size={48}/><Text style={styles.small}>kcal · 负数表示盈余</Text><Text style={[styles.small,{marginTop:8}]}>{data.targetDeficit>0?`计划缺口 ${data.targetDeficit} kcal`:'当前计划未设正缺口'}</Text>
    </View>
    <Text style={styles.copy}>基础消耗 {data.baseEnergy} − 已记录摄入 {data.intake} + 活动 {data.available.activeEnergy?data.activeEnergy:'—'} kcal</Text>
    <Text style={styles.small}>基础消耗为全天静息代谢估算，不是含活动的 TDEE。活动仅累计至当前；这不是全天最终缺口。</Text>
    <Text style={[styles.copy,{fontWeight:'700'}]}>{data.intakeComplete?'今日饮食已标记完整':'饮食尚未记录完整，缺口可能偏高。不要据此追加节食。'}</Text>
  </View>;
}

export function MetricCardGrid({data}:{data:HealthDashboardModel}){
  const metrics=[
    {label:'燃脂心率区间',value:data.available.heartRate?data.fatBurnZoneMinutes:null,unit:'分钟 · 样本估算',color:'#ff8a47',detail:`${data.zone[0]}–${data.zone[1]} 次 / 分`},
    {label:'活动消耗',value:data.available.activeEnergy?data.activeEnergy:null,unit:'千卡 · 今日累计',color:'#baf3dd',detail:'Apple 健康汇总'},
    {label:'今日步数',value:data.steps,unit:'步',color:'#f6c9dd',detail:'手机与手表的数据'},
    {label:'静息心率',value:data.restingHeartRate,unit:'次 / 分',color:'#3155e7',detail:'今日静息样本均值'},
  ];
  return <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{metrics.map(m=><View key={m.label} style={[styles.card,{backgroundColor:m.color,width:'48%',flexGrow:1,padding:18,gap:8}]}><Text style={[styles.small,{color:m.color==='#3155e7'?'#fff':'#111'}]}>{m.label}</Text><NumberValue value={m.value} size={38} color={m.color==='#3155e7'?'#fff':'#111'}/><Text style={[styles.small,{color:m.color==='#3155e7'?'#fff':'#111'}]}>{m.unit}</Text><Text style={[styles.small,{color:m.color==='#3155e7'?'#fff':'#111'}]}>{m.value===null?'暂无可用数据':m.detail}</Text></View>)}</View>;
}

export function SleepCard({data}:{data:HealthDashboardModel}){
  return <View style={[styles.card,{backgroundColor:'#f6c9dd'}]}><Text style={styles.small}>LAST NIGHT · 昨夜核心 + 深度睡眠</Text><View style={{flexDirection:'row',alignItems:'baseline',gap:10}}><NumberValue value={data.available.sleep?data.sleepDuration:null} decimals={1}/><Text style={styles.copy}>小时</Text></View><Text style={styles.copy}>不含 REM、清醒或未分期睡眠；这不是总睡眠时长。读取昨晚 18:00 至今日中午（不超过当前时刻）的分期记录。</Text></View>;
}
