import * as Crypto from 'expo-crypto';
import {fromLegacy} from './core';
import type {FoodItem,MealSolution,PlannedMeal,VerifiedMealResult} from './models';
import {supabase} from '../supabase';

export class VisionScannerService {
 constructor(private onProgress?:(message:string)=>void){}
 async request(path:string,body:unknown){
  // AI 完全走云端 Edge Function，无需本地配对
  if(!supabase)throw Error('Supabase 未初始化，请检查网络和配置');
  this.onProgress?.('正在连接循序云端 AI…');
  const {data,error}=await supabase.functions.invoke('xunxu-ai',{
   body:{path,body},
  });
  if(!error&&!data?.error)return data;
  throw Error(data?.error||error?.message||'循序云端 AI 暂时不可用');
 }
 async scan(input:{mode:'manual'|'photo'|'barcode';text?:string;image?:string;code?:string;barcodeType?:string}):Promise<{food:FoodItem;needsStock:boolean}>{
  const result=await this.request('food/resolve',{...input,strictServing:true});
  return {food:fromLegacy({...result,id:Crypto.randomUUID(),stockGrams:result.stockGrams??0}),needsStock:result.stockGrams==null};
 }
 async recipe(solution:MealSolution,foods:FoodItem[]){
  const result=await this.request('assistant',{text:'为这份已经算好克重的本餐提供一个简洁食谱：标题、准备步骤、烹调步骤。严格使用给定食材和克重，不增加未列出的油、糖或食材，不重算营养数字。说明生熟重量按食材原标签。',context:{portions:solution.portions.map(p=>({...p,weightState:foods.find(f=>f.id===p.foodId)?.weightState})),totals:solution.totals}});
  return String(result.answer||'未返回食谱，请重试');
 }
 async verifyMeal(plan:PlannedMeal,image:string,text:string,foods:FoodItem[]):Promise<VerifiedMealResult>{
  return this.request('meal/verify',{plan,image,text,foods:foods.filter(f=>plan.ingredients.some(x=>x.foodId===f.id)).map(f=>({id:f.id,name:f.name,macrosPer100g:f.macrosPer100g}))});
 }
 async enrichMealPlans(plans:PlannedMeal[]):Promise<Array<{mealType:string;dishName:string;cookingMethodUrl:string}>>{
  const result=await this.request('meal/plan',{plans:plans.map(p=>({mealType:p.mealType,ingredients:p.ingredients}))});return Array.isArray(result.plans)?result.plans:[];
 }
}
