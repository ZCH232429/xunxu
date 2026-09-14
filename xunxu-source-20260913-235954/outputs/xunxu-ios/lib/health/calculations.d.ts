export function localDay(now?:Date):{start:Date;end:Date;date:string;sleepStart:Date;sleepEnd:Date};
export function unionMilliseconds(intervals:number[][]):number;
export function heartZone(samples:readonly any[],age:number,start:Date,end:Date):{minutes:number;coverageMinutes:number;zone:[number,number];hasData:boolean};
export function sleepHours(samples:readonly any[],start:Date,end:Date,stages?:number[]):number|null;
export function energyBalance(baseEnergy:number,activeEnergy:number,intake:number,targetDeficit:number):{calorieDeficit:number;ringProgress:number};
