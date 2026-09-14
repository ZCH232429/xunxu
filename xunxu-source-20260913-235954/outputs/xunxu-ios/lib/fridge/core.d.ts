import type {FoodItem,FoodCategory,Macros,MealTarget,MealSolution,MealPortion,PlannedMeal,VerifiedMealResult} from './models';
export function validateFood(food:FoodItem):FoodItem;
export class CategorizationEngine{static categorize(name:string,macros:Macros):FoodCategory}
export function fromLegacy(row:any):FoodItem;
export function toLegacy(food:FoodItem):any;
export function totalsFor(foods:FoodItem[],portions:MealPortion[]):Macros;
export class MealMathSolver{static solve(foods:FoodItem[],target:MealTarget):MealSolution}
export function consumeMeal(state:any,meal:{id:string;date:string;meal:string;portions:MealPortion[]}):any;
export function savePlannedMeals(state:any,date:string,plans:PlannedMeal[]):any;
export function verifyPlannedMeal(state:any,planId:string,result:VerifiedMealResult,mealId:string):any;
