import {useRef,useState} from 'react';
import {Text,TextInput,View,Pressable} from 'react-native';
import type {FoodItem} from '../../lib/fridge/models';
import {useFridge} from './FridgeContext';
import {Button,colors,s} from './ui';
export function EditableFoodCard({food,onDetails}:{food:FoodItem;onDetails:()=>void}){
 const {saveFood,saving}=useFridge();
 const [editing,setEditing]=useState(false),[name,setName]=useState(food.name),[grams,setGrams]=useState(String(food.stockGrams)),[error,setError]=useState('');
 const lock=useRef(false);const [submitting,setSubmitting]=useState(false);
 async function save(){if(lock.current||saving)return;lock.current=true;setSubmitting(true);setError('');try{if(!name.trim()||!/^\d+$/.test(grams))throw Error('请输入名称和整数克重');await saveFood({...food,name:name.trim(),stockGrams:Number(grams)});setEditing(false);setError('')}catch(e){setError(e instanceof Error?e.message:'保存失败')}finally{lock.current=false;setSubmitting(false)}}
 return <View style={[s.card,{backgroundColor:colors[food.category],width:'47%',flexGrow:1,padding:18}]}>{editing?<><TextInput accessibilityLabel="修改食材名称" value={name} onChangeText={setName} style={s.input}/><TextInput accessibilityLabel="修改库存克重" value={grams} onChangeText={setGrams} keyboardType="number-pad" style={s.input}/><Button disabled={saving||submitting} label={saving||submitting?"正在保存…":"保存"} onPress={()=>void save()}/><Button disabled={saving||submitting} label="取消" onPress={()=>setEditing(false)}/></>:<Pressable accessibilityRole="button" accessibilityLabel={'修改 '+food.name+' 的名称和克重'} onPress={()=>{setName(food.name);setGrams(String(food.stockGrams));setError('');setEditing(true)}}><Text style={[s.copy,{fontSize:18,fontWeight:'800'}]}>{food.name}</Text><Text style={s.title}>{food.stockGrams}<Text style={s.small}> g</Text></Text></Pressable>}<Text style={s.small}>{food.stockGrams===0?'已用完':food.stockGrams<100?'库存偏少':'库存充足'}</Text><Text style={s.small}>{Math.round(food.macrosPer100g.calories)} kcal / 100g</Text>{!editing&&<Pressable accessibilityRole="button" onPress={onDetails}><Text style={[s.small,{fontWeight:'700'}]}>编辑详细信息 ↗</Text></Pressable>}{!!error&&<Text style={s.copy}>{error}</Text>}</View>
}
