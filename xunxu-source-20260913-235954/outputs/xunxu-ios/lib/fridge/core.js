const keys=['calories','protein','carbs','fat'];
export function validateFood(food){
 if(!food.id||!String(food.name||'').trim()||food.name.length>120)throw Error('请填写食材名称');
 if(!['CARB','PROTEIN','FAT','VEG'].includes(food.category))throw Error('食材分类无效');
 if(!Number.isInteger(food.stockGrams)||food.stockGrams<0||food.stockGrams>100000)throw Error('库存须为 0–100000 的整数克数');
 if(!keys.every(k=>typeof food.macrosPer100g?.[k]==='number'&&Number.isFinite(food.macrosPer100g[k])&&food.macrosPer100g[k]>=0))throw Error('请核对每 100g 的完整营养成分');
 const m=food.macrosPer100g;if(m.calories>950||m.protein+m.carbs+m.fat>105)throw Error('每 100g 的营养数值异常，请核对单位');
 return food;
}
export class CategorizationEngine {
 static categorize(name,m){
  const naturalVeg=/菠菜|生菜|白菜|西兰花|花椰菜|油麦菜|芹菜|黄瓜|番茄|西红柿|羽衣甘蓝|卷心菜|甘蓝|青江菜|小油菜|蘑菇|香菇|broccoli|spinach|lettuce|cucumber|cabbage|시금치|상추|브로콜리|오이|배추/i;
  if(naturalVeg.test(name)&&!/(面包|饼|粉|汁|酱|油|bread|cookie|powder|sauce|빵)/i.test(name))return 'VEG';
  const ranked=[['CARB',m.carbs*4],['PROTEIN',m.protein*4],['FAT',m.fat*9]].sort((a,b)=>b[1]-a[1]);return ranked[0][0];
 }
}
export function fromLegacy(row){
 const basis=Number(row.basis);if(!(basis>0))throw Error('原有食材缺少标签基准克数');
 const m={calories:row.kcal*100/basis,protein:row.p*100/basis,carbs:row.c*100/basis,fat:row.f*100/basis};
 return validateFood({id:row.id,name:row.name,category:row.category||CategorizationEngine.categorize(row.name,m),macrosPer100g:m,stockGrams:Math.floor(row.stockGrams??0),source:row.source,weightState:row.state,note:row.note,kind:row.kind,lookup:row.lookup,sources:row.sources});
}
export function toLegacy(food){validateFood(food);const m=food.macrosPer100g;return {id:food.id,name:food.name,category:food.category,basis:100,kcal:m.calories,p:m.protein,c:m.carbs,f:m.fat,stockGrams:food.stockGrams,state:food.weightState||'按包装确认',source:food.source||'用户确认',note:food.note||'',kind:food.kind||'estimate',sources:food.sources||[],lookup:food.lookup};}
export function totalsFor(foods,portions){const total={calories:0,protein:0,carbs:0,fat:0};for(const p of portions){const f=foods.find(f=>f.id===p.foodId);if(!f)throw Error('食材已移除，请重新配餐');for(const k of keys)total[k]+=f.macrosPer100g[k]*p.grams/100;}return total;}
export class MealMathSolver {
 static solve(input,target){
  const foods=[...new Map(input.map(f=>[f.id,validateFood(f)])).values()].filter(f=>f.stockGrams>0);
  if(!Number.isFinite(target.targetCalories)||target.targetCalories<=0||target.targetCalories>5000||!Number.isFinite(target.targetProtein)||target.targetProtein<0||target.targetProtein>400)throw Error('请填写有效的本餐热量和蛋白质目标');
  const dims=[['calories','targetCalories',1],['protein','targetProtein',1.5],['carbs','targetCarbs',1],['fat','targetFat',1]].filter(([,t])=>target[t]!==undefined);
  for(const [,t] of dims)if(!Number.isFinite(target[t])||target[t]<0)throw Error('配餐目标不能为负数或空值');
  if(!foods.length)return {portions:[],totals:{calories:0,protein:0,carbs:0,fat:0},closeToTarget:false,warnings:['冰箱没有可用库存，请先放入食材。']};
  const a=dims.map(([k,t,w])=>foods.map(f=>f.macrosPer100g[k]/100/Math.max(target[t],k==='calories'?100:10)*w));
  const b=dims.map(([k,t,w])=>target[t]/Math.max(target[t],k==='calories'?100:10)*w);
  const grams=foods.map(f=>Math.min(f.stockGrams,({CARB:50,PROTEIN:100,FAT:10,VEG:150})[f.category]));
  // Bounded coordinate descent for weighted least squares; all recommendations respect actual stock.
  for(let step=0;step<250;step++){
   let change=0;
   for(let j=0;j<foods.length;j++){
    let gradient=0,curvature=0;
    for(let d=0;d<a.length;d++){const prediction=a[d].reduce((sum,v,i)=>sum+v*grams[i],0);gradient+=a[d][j]*(b[d]-prediction);curvature+=a[d][j]**2;}
    if(!curvature)continue;
    const next=Math.max(0,Math.min(foods[j].stockGrams,grams[j]+gradient/curvature));change+=Math.abs(next-grams[j]);grams[j]=next;
   }
   if(change<.001)break;
  }
  const portions=foods.map((f,i)=>({foodId:f.id,name:f.name,grams:Math.round(grams[i])})).filter(p=>p.grams>0);
  const totals=totalsFor(foods,portions),closeToTarget=dims.every(([k,t])=>Math.abs(totals[k]-target[t])<=Math.max(k==='calories'?25:3,target[t]*.12));
  return {portions,totals,closeToTarget,warnings:closeToTarget?[]:['现有食材与库存无法同时贴近全部目标。可更换食材或调整本餐目标；不会凭空增加库存。']};
 }
}
export function consumeMeal(state,{id,date,meal,portions}){
 if(state.meals.some(m=>m.id===id))return state;
 if(!id||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!portions.length||new Set(portions.map(p=>p.foodId)).size!==portions.length)throw Error('配餐记录无效');
 const foods=state.foods.map(fromLegacy);
 for(const p of portions){const f=foods.find(f=>f.id===p.foodId);if(!f||!Number.isInteger(p.grams)||p.grams<=0||p.grams>f.stockGrams)throw Error('食材库存已变化或不足，请重新配餐');}
 const totals=totalsFor(foods,portions);
 return {...state,foods:state.foods.map(f=>{const p=portions.find(p=>p.foodId===f.id);return p?{...f,stockGrams:f.stockGrams-p.grams}:f}),meals:[...state.meals,{id,date,meal,name:portions.map(p=>foods.find(f=>f.id===p.foodId).name).join(' + ').slice(0,200),grams:portions.reduce((n,p)=>n+p.grams,0),kcal:totals.calories,p:totals.protein,c:totals.carbs,f:totals.fat,ingredients:portions.map(p=>({...p,macrosPer100g:foods.find(f=>f.id===p.foodId).macrosPer100g}))}],closedDays:state.closedDays.filter(d=>d!==date)};
}
export function savePlannedMeals(state,date,plans){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(plans))throw Error('今日规划格式无效');
 const allowed=new Set(['BREAKFAST','LUNCH','DINNER','SNACK']),ids=new Set();
 for(const p of plans){if(!p.id||ids.has(p.id)||!allowed.has(p.mealType)||!String(p.dishName||'').trim()||!Array.isArray(p.ingredients)||!p.ingredients.length)throw Error('今日规划包含无效餐次');ids.add(p.id);for(const x of p.ingredients)if(!x.foodId||!x.name||!Number.isInteger(x.targetGrams)||x.targetGrams<=0)throw Error('今日规划克重无效');}
 const replacing=new Set(plans.map(p=>p.mealType));
 const old=(state.dailyPlans||[]).filter(p=>p.date!==date||p.status==='VERIFIED'||!replacing.has(p.mealType));
 return {...state,dailyPlans:[...old,...plans.map(p=>({...p,date,status:'PLANNED'}))]};
}
export function verifyPlannedMeal(state,planId,result,mealId){
 const plan=(state.dailyPlans||[]).find(p=>p.id===planId);if(!plan||plan.status==='VERIFIED')throw Error('该餐次已核销或不存在');
 if(!result||!result.macros||!['calories','protein','carbs','fat'].every(k=>Number.isFinite(result.macros[k])&&result.macros[k]>=0)||!Array.isArray(result.ingredients))throw Error('核销营养数据无效');
 const portions=result.ingredients.map(x=>({foodId:x.foodId,name:x.name,grams:Math.max(0,Math.round(x.actualGrams))})).filter(x=>x.grams>0);
 const foods=state.foods.map(fromLegacy);for(const p of portions){const food=foods.find(f=>f.id===p.foodId);if(!food)throw Error('核销食材已从冰箱移除');}
 const nextFoods=state.foods.map(row=>{const p=portions.find(x=>x.foodId===row.id);return p?{...row,stockGrams:Math.max(0,(row.stockGrams||0)-p.grams)}:row});
 const typeName={BREAKFAST:'早餐',LUNCH:'午餐',DINNER:'晚餐',SNACK:'加餐'}[plan.mealType];
 const m=result.macros,meal={id:mealId,date:plan.date,meal:typeName,name:result.dishName||plan.dishName,grams:portions.reduce((n,p)=>n+p.grams,0),kcal:m.calories,p:m.protein,c:m.carbs,f:m.fat,ingredients:portions,verification:{confidence:result.confidence,notes:result.notes||[],plannedMealId:plan.id}};
 return {...state,foods:nextFoods,meals:[...state.meals,meal],dailyPlans:(state.dailyPlans||[]).map(p=>p.id===planId?{...p,status:'VERIFIED',verifiedMealId:mealId}:p),closedDays:state.closedDays.filter(d=>d!==plan.date)};
}
