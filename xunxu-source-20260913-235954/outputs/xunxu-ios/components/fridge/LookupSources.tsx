import {useState} from 'react';
import {Linking,Pressable,Text,View} from 'react-native';
const s={small:{fontFamily:'PingFang SC',fontSize:12,lineHeight:19,color:'#111'}};
export function LookupSources({sources}:{sources?:{title:string;url:string}[]}){
 const [error,setError]=useState('');
 const links=(sources||[]).filter(x=>/^https?:\/\//i.test(x.url)).slice(0,6);
 if(!links.length)return null;
 return <View style={{gap:8}}><Text style={s.small}>查询来源 · 请核对品牌和规格</Text>{links.map(x=><Pressable key={x.url} accessibilityRole="link" onPress={()=>{setError('');void Linking.openURL(x.url).catch(()=>setError('无法打开来源链接，请稍后重试'))}}><Text style={[s.small,{textDecorationLine:'underline'}]}>{x.title||'产品资料'} ↗</Text></Pressable>)}{!!error&&<Text style={s.small}>{error}</Text>}</View>;
}
