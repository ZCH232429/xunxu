import {LookupSources} from './LookupSources';
import {useRef,useState} from 'react';
import {Text,TextInput,View,Pressable} from 'react-native';
import * as Crypto from 'expo-crypto';
import {SupplementLabel,SupplementLog} from '../../lib/fridge/supplements';
import {localDay} from '../../lib/health/calculations';
import {Button,s} from './ui';
export function ConfirmSupplementScan({label,onSave,onClose,saving}:{label:SupplementLabel;onSave:(log:SupplementLog)=>Promise<void>;onClose:()=>void;saving:boolean}){
 const [name,setName]=useState(label.name),[amount,setAmount]=useState(''),[unit,setUnit]=useState<SupplementLog['unit']>('粒'),[category,setCategory]=useState<SupplementLog['category']>('health'),[error,setError]=useState('');
 const [id]=useState(()=>Crypto.randomUUID());
 const lock=useRef(false);const [submitting,setSubmitting]=useState(false);
 async function save(){if(lock.current||saving)return;lock.current=true;setSubmitting(true);setError('');try{if(!name.trim())throw Error('请填写补剂名称');if(!Number.isFinite(Number(amount))||Number(amount)<=0)throw Error('每次用量需大于 0');if(!amount.trim())throw Error('请填写每次用量');const now=new Date();await onSave({id,recordKind:'library',name:name.trim(),amount:Number(amount),unit,category,date:localDay().date,time:`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,note:'通过标签 / 条码录入',label});onClose()}catch(e){setError(e instanceof Error?e.message:'保存失败')}finally{lock.current=false;setSubmitting(false)}}
 return <View style={[s.card,{backgroundColor:'#f6c9dd'}]}><Text style={s.title}>核对补剂标签</Text><TextInput accessibilityLabel="识别补剂名称" value={name} onChangeText={setName} style={s.input}/><Text style={s.copy}>标签份量：{label.servingText}</Text>{label.ingredients.map((x,i)=><Text key={i} style={s.copy}>{x.name} · {x.amount} {x.unit}</Text>)}<Text style={s.small}>{label.source} {label.note}</Text><LookupSources sources={label.sources}/><Text style={s.copy}>每次用量（不会自动套用标签份量）</Text><TextInput accessibilityLabel="每次补剂用量" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={s.input}/><View style={s.row}>{(['g','mg','μg','ml','粒','片','份','IU'] as const).map(u=><Pressable key={u} accessibilityRole="button" onPress={()=>setUnit(u)} style={[s.pill,{padding:12,backgroundColor:unit===u?'#111':'#fff'}]}><Text style={{color:unit===u?'#fff':'#111'}}>{u}</Text></Pressable>)}</View><View style={s.row}>{(['sport','health'] as const).map(c=><Button key={c} light={category!==c} label={c==='sport'?'运动补剂':'健康补剂'} onPress={()=>setCategory(c)}/>)}</View>{!!error&&<Text style={s.copy}>{error}</Text>}<Button disabled={saving||submitting} label={saving||submitting?"正在保存…":"确认存入补剂"} onPress={()=>void save()}/></View>;
}
