import {targets,intake,plan,types,round} from './engine.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const value=(n,places=0)=>Number.isFinite(n)?Number(n).toFixed(places):'—';
const action=(label,key,cls='')=>`<button class="home-pill ${cls}" data-action="${key}">${label}</button>`;
const previousValues=new Map();
export function animateHome(){
 document.querySelectorAll('.home-ring strong,.home-tile strong,.home-sleep strong').forEach((el,index)=>{
  const text=el.textContent,target=Number(text),decimals=text.includes('.')?1:0;
  if(!Number.isFinite(target))return;
  const previous=previousValues.get(index);previousValues.set(index,target);
  if(previous===target||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const start=performance.now(),from=previous??0;
  const tick=now=>{if(!el.isConnected)return;const t=Math.min(1,(now-start)/1500);el.textContent=(from+(target-from)*(1-Math.pow(1-t,3))).toFixed(decimals);if(t<1)requestAnimationFrame(tick)};
  requestAnimationFrame(tick);
 });
}
function tile(label,n,unit,tone,note){return `<article class="home-tile ${tone}"><span>${label}</span><strong>${value(n)}</strong><small>${unit}</small><p>${esc(note)}</p></article>`}

export function homeView(state,today,mode){
 const target=targets(state),food=intake(state,today),saved=state.health.find(x=>x.date===today)||{};
 const health=mode==='personal'?window.__xunxuHealth:null,live=health?.status==='success'&&health.data.date===today?health.data:null;
 const remaining=target.kcal==null?null:target.kcal-food.kcal;
 const nativeEnergy=live?.available.activeEnergy;
 const deficit=nativeEnergy?live.baseEnergy+live.activeEnergy-food.kcal:null;
 const main=nativeEnergy?Math.round(deficit):remaining==null?null:Math.round(remaining);
 const progress=nativeEnergy?(live.targetDeficit>0?Math.max(0,Math.min(1,deficit/live.targetDeficit)):0):target.kcal>0?Math.max(0,Math.min(1,food.kcal/target.kcal)):0;
 const circumference=2*Math.PI*102;
 const day=plan(state,today,1)[0],week=plan(state,today,7);
 const source=live?'Apple 健康 · 本次读取':saved.source||'尚未记录';
 return `<div class="home-dashboard">
 <section class="home-energy"><span class="home-kicker">TODAY · ${today}</span><h2>${nativeEnergy?'今日估算热量缺口':'今日饮食预算'}</h2>
 <div class="home-ring"><svg viewBox="0 0 260 260" aria-hidden="true"><circle cx="130" cy="130" r="102" fill="none" stroke="#b0d367" stroke-width="17"/><circle class="home-ring-fill" cx="130" cy="130" r="102" fill="none" stroke="#111" stroke-width="17" stroke-linecap="round" stroke-dasharray="${circumference}" style="--ring-length:${circumference};--ring-offset:${circumference*(1-progress)}" transform="rotate(-90 130 130)"/></svg><div><strong>${value(main)}</strong><small>${nativeEnergy?'kcal · 负数表示盈余':'kcal · '+(main<0?'超出目标':'今日剩余额度')}</small></div></div>
 <div class="home-energy-facts"><div><span>已记录摄入</span><b>${value(food.kcal)} <small>kcal</small></b></div><div><span>目标摄入</span><b>${value(target.kcal)} <small>kcal</small></b></div></div>
 <div class="home-macros">${[['蛋白质','p'],['碳水','c'],['脂肪','f']].map(([name,k])=>`<div><span>${name}</span><b>${round(food[k])} <small>/ ${target[k]??'—'} g</small></b><progress max="${Math.max(1,target[k]||1)}" value="${food[k]}" aria-label="${name}摄入"></progress></div>`).join('')}</div>
 <p class="home-note">${nativeEnergy?`基础消耗 ${live.baseEnergy} + 活动 ${live.activeEnergy} − 已记录摄入 ${round(food.kcal)} kcal。基础消耗为全天静息代谢估算。`:'圆环表示目标摄入完成度，额度随饮食记录更新。'}${state.closedDays.includes(today)?' 今日饮食已确认完整。':' 饮食尚未记录完整，不将剩余额度当作真实缺口。'}</p>
 ${action('＋ 记录一餐','meal')}${action('调整饮食目标','macro','home-secondary')}</section>
 <section class="home-movement" aria-label="今日运动与健康"><div class="home-metric-grid">
 ${tile('燃脂心率区间',live?(live.available.heartRate?live.fatBurnZoneMinutes:null):saved.heartZoneMinutes,'分钟 · 样本估算','home-orange',live?`${live.zone[0]}–${live.zone[1]} 次 / 分`:'等待连续心率记录')}
 ${tile('活动消耗',live?(live.available.activeEnergy?live.activeEnergy:null):saved.activeKcal,'千卡 · 今日累计','home-mint',source)}
 ${tile('今日步数',live?live.steps:saved.steps,'步','home-pink',source)}
 ${tile('静息心率',live?live.restingHeartRate:saved.rhr,'次 / 分','home-blue',live?'今日静息样本均值':source)}</div>
 <article class="home-sleep"><span class="home-kicker">LAST NIGHT · 昨夜核心 + 深度睡眠</span><div><strong>${value(live?(live.available.sleep?live.sleepDuration:null):saved.coreDeepSleepHours,1)}</strong><span>小时</span></div><p>不含 REM、清醒和未分期睡眠，不等于总睡眠时长。${saved.sleep!=null?`另已记录总睡眠 ${value(saved.sleep,1)} 小时。`:''}</p></article>
 <div class="home-health-status" role="status">${healthStatus(health,mode)}${action('手动记录身体状态','manual-health','home-secondary')}</div></section>
 <section class="home-training"><span class="home-kicker">MOVE TODAY</span><h2>今天练什么</h2><strong class="home-session">${esc(types[day?.type]||'休息日')}</strong><p>${day?.actual?'今天的训练已记录，给身体留出恢复时间。':day?.type==='rest'?'今天以恢复为主，准备好再出发。':'跟随当天动作与指导，按实际状态完成训练。'}</p>${action(day?.type==='rest'?'查看训练安排 ↗':'查看今日训练与指导 ↗','goto-training')}<div class="home-week">${week.map(d=>`<button data-action="schedule:${d.date}" class="${d.date===today?'selected':''}"><small>${d.date.slice(5)}</small><b>${esc(types[d.type].split(' · ')[0])}</b></button>`).join('')}</div></section>
 <section class="home-meal"><span class="home-kicker">YOUR KITCHEN</span><h2>这一餐，从冰箱开始</h2><p>按现有食材与今日营养目标，规划这一餐的份量和做法。</p>${action('打开冰箱与饮食规划 ↗','goto-nutrition')}</section>
 </div>`;
}

function healthStatus(h,mode){
 if(mode==='demo')return '<p>当前为演示档案，不读取个人 Apple 健康。</p>';
 if(!h)return '<p>运动与睡眠显示已保存的记录；未记录的数据保持空白。</p>';
 if(h.status==='unavailable')return '<p>Apple 健康需在循序 iOS 开发版授权。当前可手动记录，已有记录仍在首页展示。</p>';
 if(h.status==='isLoading')return '<p>正在更新健康数据…</p>';
 if(h.status==='needsPermission')return '<p>允许读取 iPhone 与 Apple Watch 已同步的运动及睡眠数据。读取后先在本机展示。</p><button class="home-pill" data-home-health="request">连接 Apple 健康</button>';
 if(h.status==='success')return `<p>Apple 健康更新于 ${esc(new Date(h.data.updatedAt).toLocaleTimeString())}。心率区间是样本估算，不代表脂肪消耗量。</p>${h.data.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}<button class="home-pill" data-home-health="refresh">刷新健康数据</button><button class="home-pill home-secondary" data-home-health="save" ${h.saving?'disabled':''}>${h.saving?'正在保存…':'保存今日汇总到云端'}</button>${h.saveMessage?`<p>${esc(h.saveMessage)}</p>`:''}`;
 return `<p>${esc(h.message)}</p><button class="home-pill" data-home-health="refresh">重新读取</button><button class="home-pill home-secondary" data-home-health="request">检查授权流程</button>`;
}
