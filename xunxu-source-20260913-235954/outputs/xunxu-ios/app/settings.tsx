import { ScrollView, Text, View } from 'react-native';

export default function SettingsScreen() {
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{padding:20,gap:12,paddingBottom:40}}>
    <View style={{padding:26,gap:12,borderRadius:32,borderCurve:'continuous',backgroundColor:'#baf3dd'}}>
      <Text style={{fontSize:24,fontWeight:'700',color:'#111'}}>循序 · 手机应用</Text>
      <Text selectable style={{fontSize:16,color:'#111'}}>初始版本 1.0.0</Text>
      <Text style={{fontSize:15,lineHeight:24,color:'#111'}}>在 iPhone 开发版连接 Apple 健康，查看手机与 Apple Watch 同步后的运动和睡眠记录。</Text>
    </View>
  </ScrollView>;
}