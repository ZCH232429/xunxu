import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Text,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {MealMathSolver} from '../../lib/fridge/core';
import {VisionScannerService} from '../../lib/fridge/VisionScannerService';
import type {FoodItem,MealSolution,MealTarget} from '../../lib/fridge/models';
import {videoTargets} from '../../lib/nutrition-plan';
import {localDay} from '../../lib/health/calculations';
import {useFridge} from './FridgeContext';
import {Button,CalculatedPortionsCard,MacroSlotMachinePicker,Sheet,s} from './ui';

export function AIPlanDashboard(){
 const {workspace,fridgeInventory,consumeMeal,saving}=useFridge();
 const target=videoTargets(workspace.profile),today=localDay().date,logged=workspace.meals.filter((m:any)=>m.date===today);
 const [meal,setMeal]=useState('午餐'),[open,setOpen]=useState(false),[solution,setSolution]=useState<MealSolution|null>(null),[custom,setCustom]=useState(false),[recipe,setRecipe]=useState(''),[error,setError]=useState(''),[thinking,setThinking]=useState(false);
 const [cal,setCal]=useState('500'),[protein,setProtein]=useState('30'),[carbs,setCarbs]=useState(''),[fat,setFat]=useState('');const consumptionId=useRef(''),recipeRun=useRef(0);
 useEffect(()=>()=>{recipeRun.current++},[]);
 const plans=useMemo(()=>{
  const remaining={kcal:Math.max(0,(target.kcal||0)-logged.reduce((n:number,m:any)=>n+m.kcal,0)),p:Math.max(0,(target.p||0)-logged.reduce((n:number,m:any)=>n+m.p,0)),c:Math.max(0,(target.c||0)-logged.reduce((n:number,m:any)=>n+m.c,0)),f:Math.max(0,(target.f||0)-logged.reduce((n:number,m:any)=>n+m.f,0))};
  const slots=[['早餐',.25],['午餐',.4],['晚餐',.35]] as const;const active=slots.filter(([name])=>!logged.some((m:any)=>m.meal===name));const total=active.reduce((n,[,w])=>n+w,0);
  let available=fridgeInventory.map(f=>({...f}));
  return active.filter(()=>remaining.kcal>0).map(([name,w])=>{
   const t={targetCalories:Math.max(1,Math.round(remaining.kcal*w/total)),targetProtein:Math.round(remaining.p*w/total),targetCarbs:Math.round(remaining.c*w/total),targetFat:Math.round(remaining.f*w/total)};
   const selected=['CARB','PROTEIN','FAT','VEG'].flatMap(c=>available.filter(f=>f.category===c&&f.stockGrams>0).sort((a,b)=>b.stockGrams-a.stockGrams).slice(0,1));
   const plan=MealMathSolver.solve(selected,t);available=available.map(f=>({...f,stockGrams:f.stockGrams-(plan.portions.find(p=>p.foodId===f.id)?.grams||0)}));
   return {name,target:t,solution:plan};
  });
 },[JSON.stringify(fridgeInventory),JSON.stringify(logged),target.kcal,target.p,target.c,target.f]);
 function start(name:string,t:MealTarget,plan:MealSolution|null,isCustom:boolean){consumptionId.current=Crypto.randomUUID();recipeRun.current++;setMeal(name);setCal(String(t.targetCalories));setProtein(String(t.targetProtein));setCarbs(t.targetCarbs===undefined?'':String(t.targetCarbs));setFat(t.targetFat===undefined?'':String(t.targetFat));setSolution(plan);setCustom(isCustom);setRecipe('');setError('');setOpen(true)}
 const parsed:MealTarget={targetCalories:Number(cal),targetProtein:Number(protein),...(carbs.trim()?{targetCarbs:Number(carbs)}:{}),...(fat.trim()?{targetFat:Number(fat)}:{})},valid=cal.trim()!==''&&protein.trim()!==''&&parsed.targetCalories>0&&parsed.targetCalories<=5000&&parsed.targetProtein>=0&&parsed.targetProtein<=400&&(!carbs.trim()||(Number(carbs)>=0&&Number(carbs)<=600))&&(!fat.trim()||(Number(fat)>=0&&Number(fat)<=200));
 async function getRecipe(){if(!solution)return;const run=++recipeRun.current;setThinking(true);setError('');try{const answer=await new VisionScannerService().recipe(solution,fridgeInventory);if(run===recipeRun.current)setRecipe(answer)}catch(e){if(run===recipeRun.current)setError(e instanceof Error?e.message:'做法生成失败')}finally{if(run===recipeRun.current)setThinking(false)}}
 async function confirm(){if(!solution)return;try{await consumeMeal(consumptionId.current,meal,solution.portions);setOpen(false);recipeRun.current++}catch(e){setError(e instanceof Error?e.message:'保存失败，库存尚未扣减')}}
 function changed(next:MealSolution){setSolution(next);setRecipe('');recipeRun.current++;setThinking(false)}
 return <><View style={[s.card,{backgroundColor:'#d7ff7a'}]}><Text style={s.small}>PLAN FROM YOUR FRIDGE</Text><Text style={[s.title,{fontSize:25}]}>AI 推荐今日食谱</Text><Text style={s.copy}>先按库存与剩余营养目标计算份量，再让 AI 给出做法。下列餐次共用库存预算，不会重复分配同一份食材。</Text>{plans.map(p=><View key={p.name} style={{gap:6}}><Text style={[s.copy,{fontWeight:'800'}]}>{p.name} · 目标 {p.target.targetCalories} kcal / 蛋白 {p.target.targetProtein}g</Text><Text style={s.small}>{p.solution.portions.map(x=>`${x.name} ${x.grams}g`).join(' + ')||'暂无可用食材'}</Text><Button disabled={!p.solution.portions.length} label={`查看${p.name}方案与做法`} onPress={()=>start(p.name,p.target,p.solution,false)}/></View>)}{!plans.length&&<Text style={s.copy}>今日计划餐次已记录，或当前没有剩余热量目标。仍可按实际进食自定义记录。</Text>}</View>
 <Button light label="自定义本餐食材 · 滚轮配餐" onPress={()=>{const p=plans[0];start(p?.name||'加餐',p?.target||{targetCalories:500,targetProtein:30},null,true)}}/>
 {open&&<Sheet title={meal+' · 配餐'} onClose={()=>{setOpen(false);recipeRun.current++;setThinking(false)}}><View style={[s.card,{backgroundColor:'#f6c9dd'}]}><Text style={s.copy}>本餐目标可调整；建议克重不超过冰箱库存。</Text><View style={s.row}>{['早餐','午餐','晚餐','加餐'].map(name=><Button key={name} light={meal===name} label={name} onPress={()=>setMeal(name)}/>)}</View><Text style={s.small}>热量 kcal</Text><TextInput accessibilityLabel="本餐热量目标" keyboardType="decimal-pad" value={cal} onChangeText={v=>{setCal(v);setCustom(true)}} style={s.input}/><Text style={s.small}>蛋白质 g</Text><TextInput accessibilityLabel="本餐蛋白质目标" keyboardType="decimal-pad" value={protein} onChangeText={v=>{setProtein(v);setCustom(true)}} style={s.input}/><Text style={s.small}>碳水 g（可选）</Text><TextInput accessibilityLabel="本餐碳水目标" keyboardType="decimal-pad" value={carbs} onChangeText={v=>{setCarbs(v);setCustom(true)}} style={s.input}/><Text style={s.small}>脂肪 g（可选）</Text><TextInput accessibilityLabel="本餐脂肪目标" keyboardType="decimal-pad" value={fat} onChangeText={v=>{setFat(v);setCustom(true)}} style={s.input}/></View>
 {!valid?<Text style={s.white}>请填写有效的热量和蛋白质目标。</Text>:<>{custom&&<MacroSlotMachinePicker foods={fridgeInventory} target={parsed} onSolution={changed}/>}<Button light label={custom?'正在自选食材':'更换本餐食材'} disabled={custom} onPress={()=>setCustom(true)}/>{solution&&<CalculatedPortionsCard solution={solution} onRecipe={()=>void getRecipe()} onConsume={()=>void confirm()} busy={saving||thinking}/>}</>}
 {thinking&&<ActivityIndicator color="#d7ff7a"/>}{!!error&&<Text accessibilityLiveRegion="polite" style={s.white}>{error}</Text>}{!!recipe&&<View style={[s.card,{backgroundColor:'#f6c9dd'}]}><Text style={[s.title,{fontSize:22}]}>AI 做法建议</Text><Text selectable style={s.copy}>{recipe}</Text><Text style={s.small}>AI 生成内容，请按食品实际包装、生熟状态及过敏需求核对。尚未扣除库存，确认吃掉后才记录。</Text></View>}</Sheet>}</>;
}
