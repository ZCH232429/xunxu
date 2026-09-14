// Video table: diet video 01:40–05:40, final whiteboard at 05:00.
// All coefficients are grams per kg of reference body weight per day.
export const videoBands=[
 {id:'2-3',min:2,max:3,cMale:2.2,cFemale:2,p:1.4,fMale:.8,fFemale:1},
 {id:'4-5',min:4,max:5,cMale:2.5,cFemale:2.2,p:1.6,fMale:.9,fFemale:1.1},
 {id:'6-7',min:6,max:7,cMale:3,cFemale:2.5,p:1.7,fMale:1,fFemale:1.1},
 {id:'8-9',min:8,max:9,cMale:3.5,cFemale:3,p:1.8,fMale:1,fFemale:1.2},
];
export const activityLevels=[
 {value:1.2,label:'久坐为主',detail:'大部分时间坐着，整体活动很少'},
 {value:1.4,label:'轻活动',detail:'有一些步行、家务和运动'},
 {value:1.6,label:'中等活动',detail:'经常走动，整体活动较多'},
 {value:1.8,label:'高活动',detail:'体力工作或全天活动量较大'},
];
export function bmi(weight,height){return Number.isFinite(weight)&&weight>0&&Number.isFinite(height)&&height>0?weight/(height/100)**2:null}
export function validateBasics(p){
 for(const [key,min,max] of [['weight',30,300],['height',100,230],['age',18,100],['frequency',0,7],['sessionMinutes',0,240]]){
  if(typeof p[key]!=='number'||!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw Error('请检查'+({weight:'体重（30–300 kg）',height:'身高（100–230 cm）',age:'年龄（本功能适用于 18–100 岁成年人）',frequency:'每周次数（0–7）',sessionMinutes:'每次运动时长（最多 240 分钟）'})[key]);
 }
 if(!Number.isInteger(p.age)||!Number.isInteger(p.frequency))throw Error('年龄和每周次数请填整数');
 if(p.frequency>0&&p.sessionMinutes<=0)throw Error('有运动安排时，请填写每次时长');
 if(!['male','female'].includes(p.sex))throw Error('请选择公式生理性别参数');
 if(!activityLevels.some(x=>x.value===p.activity))throw Error('请选择整体日常活动量');
}
export function calculateBasics(p){
 validateBasics(p);
 const hours=p.frequency*p.sessionMinutes/60;
 const automatic=videoBands.find(x=>hours>=x.min&&hours<=x.max);
 // Never silently interpolate or extrapolate missing ranges from the video.
 const chosen=automatic||videoBands.find(x=>x.id===p.videoBand);
 const rmr=10*p.weight+6.25*p.height-5*p.age+(p.sex==='male'?5:-161);
 const tdee=rmr*p.activity;
 const coefficients=chosen?{c:p.sex==='male'?chosen.cMale:chosen.cFemale,p:chosen.p,f:p.sex==='male'?chosen.fMale:chosen.fFemale}:null;
 const macros=coefficients?{c:p.weight*coefficients.c,p:p.weight*coefficients.p,f:p.weight*coefficients.f}:null;
 const kcal=macros?4*macros.c+4*macros.p+9*macros.f:null;
 return {bmi:bmi(p.weight,p.height),rmr,tdee,hours,band:chosen?.id||null,manualBand:!!chosen&&!automatic,needsBand:!chosen,coefficients,macros,kcal,deficit:kcal===null?null:tdee-kcal};
}
export function videoTargets(p){
 try{const r=calculateBasics(p);if(!r.macros)return {tdee:Math.round(r.tdee),kcal:null,p:null,c:null,f:null,source:'视频时长未覆盖，请选择参考档位',error:'请在基础信息中确认参考档位'};
  const rnd=n=>Math.round(n*10)/10;
  return {tdee:Math.round(r.tdee),kcal:Math.round(r.kcal),p:rnd(r.macros.p),c:rnd(r.macros.c),f:rnd(r.macros.f),source:`视频起始方案 · ${r.band} 小时档${r.manualBand?'（手动参考）':''} · 参考体重 ${p.weight} kg`,error:r.deficit<=0?'视频目标未形成估计热量缺口，请结合趋势复盘。':r.kcal<r.rmr?'视频摄入低于估计静息消耗，请复核方案与恢复状态。':null};
 }catch(e){return {tdee:null,kcal:null,p:null,c:null,f:null,source:'请完善基础信息',error:e.message}}
}
export function hasBasics(p){try{return p.onboardingVersion===1&&!!calculateBasics(p).macros}catch{return false}}
