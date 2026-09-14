export type FoodCategory='CARB'|'PROTEIN'|'FAT'|'VEG';
export interface Macros {calories:number;protein:number;carbs:number;fat:number}
export interface FoodItem {id:string;name:string;category:FoodCategory;macrosPer100g:Macros;stockGrams:number;lookup?:{method:string;brand?:string;productName?:string;variant?:string;packageSize?:string;barcode?:string};source?:string;weightState?:string;note?:string;kind?:'label'|'estimate';sources?:{title:string;url:string}[]}
export interface MealTarget {targetCalories:number;targetProtein:number;targetCarbs?:number;targetFat?:number}
export interface MealPortion {foodId:string;name:string;grams:number}
export interface MealSolution {portions:MealPortion[];totals:Macros;closeToTarget:boolean;warnings:string[]}
export type MealType='BREAKFAST'|'LUNCH'|'DINNER'|'SNACK';
export interface PlannedMealIngredient {foodId:string;name:string;targetGrams:number}
export interface PlannedMeal {id:string;date:string;mealType:MealType;dishName:string;ingredients:PlannedMealIngredient[];isSelected:boolean;cookingMethodUrl?:string;status?:'PLANNED'|'VERIFIED';verifiedMealId?:string}
export interface DraftFoodItem {target:'food'|'supplement';status:'PARSING'|'READY'|'ERROR';message?:string;food?:FoodItem}
export interface DailyFoodLogState {fridgeInventory:FoodItem[];aiRecommendations:PlannedMeal[];currentCustomPlan:PlannedMeal|null;stagedInputItem:DraftFoodItem|null}
export interface VerifiedMealResult {dishName:string;ingredients:Array<{foodId:string;name:string;actualGrams:number}>;macros:Macros;confidence:'LOW'|'MEDIUM'|'HIGH';notes:string[]}
