// Only available aggregates replace a same-day record; missing permissions never erase manual values.
export function mergeHealthSummary(rows,d){
  const patch={date:d.date,source:'Apple 健康',healthKitUpdatedAt:d.updatedAt,energyComplete:false};
  if(d.available.activeEnergy)patch.activeKcal=d.activeEnergy;
  if(d.steps!==null)patch.steps=d.steps;
  if(d.restingHeartRate!==null)patch.rhr=d.restingHeartRate;
  if(d.totalSleepDuration!==null)patch.sleep=d.totalSleepDuration;
  if(d.available.sleep)patch.coreDeepSleepHours=d.sleepDuration;
  if(d.available.heartRate)patch.heartZoneMinutes=d.fatBurnZoneMinutes;
  if(!['activeKcal','steps','rhr','sleep'].some(k=>k in patch))throw Error('当前只有零散心率样本，暂没有可保存的日报指标');
  const old=rows.find(r=>r.date===d.date)||{};
  return [...rows.filter(r=>r.date!==d.date),{...old,...patch}];
}
