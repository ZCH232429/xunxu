import {Pressable,Text,View} from 'react-native';
const tabs=[['overview','今日','◈'],['body','趋势','⌁'],['training','训练','↗'],['nutrition','饮食','◉'],['review','复盘','◎'],['settings','设置','⚙']] as const;
export type TabKey=typeof tabs[number][0];
export function WorkbenchTabs({selected,onSelect,disabled=false}:{selected:TabKey;onSelect:(key:TabKey)=>void;disabled?:boolean}){
 return <View accessibilityRole="tablist" style={{flexDirection:'row',backgroundColor:'#111',paddingHorizontal:8,paddingVertical:8,gap:4}}>{tabs.map(([key,label,icon])=><Pressable key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{selected:selected===key,disabled}} disabled={disabled} onPress={()=>onSelect(key)} style={{flex:1,borderRadius:24,paddingVertical:10,alignItems:'center',gap:3,backgroundColor:selected===key?'#d7ff7a':'#242424'}}><Text style={{fontSize:21,color:selected===key?'#111':'#fff'}}>{icon}</Text><Text style={{fontFamily:'PingFang SC',fontSize:11,color:selected===key?'#111':'#fff'}}>{label}</Text></Pressable>)}</View>;
}
