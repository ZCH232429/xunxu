export function localDay(now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const date = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
  const sleepStart = new Date(start); sleepStart.setDate(sleepStart.getDate()-1); sleepStart.setHours(18);
  const noon = new Date(start); noon.setHours(12);
  return {start, end: now, date, sleepStart, sleepEnd: new Date(Math.min(+now,+noon))};
}

export function unionMilliseconds(intervals) {
  const sorted = intervals.filter(([a,b]) => Number.isFinite(a) && Number.isFinite(b) && b>a).sort((a,b)=>a[0]-b[0]);
  let total=0, end=-Infinity;
  for(const [a,b] of sorted){total+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}
  return total;
}

// Interpolate only close, same-source point samples. Do not extrapolate across recording gaps.
export function heartZone(samples, age, start, end) {
  if(!Number.isFinite(age)||age<18||age>100)throw Error('请先填写有效年龄');
  const low=(220-age)*.6, high=(220-age)*.7, groups=new Map(), intervals=[], coverage=[];
  for(const s of samples){
    const t=+new Date(s.startDate);
    if(!Number.isFinite(t)||t<+start||t>+end||!Number.isFinite(s.quantity)||s.quantity<=0)continue;
    const key=s.sourceRevision?.source?.bundleIdentifier||s.source||'unknown';
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push({t,v:s.quantity});
  }
  for(const values of groups.values()){
    values.sort((a,b)=>a.t-b.t);
    for(let i=1;i<values.length;i++){
      const a=values[i-1],b=values[i],dt=b.t-a.t;
      if(dt<=0||dt>60000)continue;
      coverage.push([a.t,b.t]);
      if(a.v===b.v){if(a.v>=low&&a.v<=high)intervals.push([a.t,b.t]);continue;}
      const u=(low-a.v)/(b.v-a.v),v=(high-a.v)/(b.v-a.v);
      const from=Math.max(0,Math.min(u,v)),to=Math.min(1,Math.max(u,v));
      if(to>from)intervals.push([a.t+dt*from,a.t+dt*to]);
    }
  }
  return {minutes:Math.floor(unionMilliseconds(intervals)/60000),coverageMinutes:Math.floor(unionMilliseconds(coverage)/60000),zone:[Math.round(low),Math.round(high)],hasData:samples.length>0};
}

export function sleepHours(samples,start,end,stages=[3,4]){
  const rows=samples.filter(s=>stages.includes(s.value));
  const intervals=rows.map(s=>[Math.max(+start,+new Date(s.startDate)),Math.min(+end,+new Date(s.endDate))]);
  const duration=unionMilliseconds(intervals)/3600000;
  return duration>0?duration:null;
}

export function energyBalance(baseEnergy,activeEnergy,intake,targetDeficit){
  if(![baseEnergy,activeEnergy,intake,targetDeficit].every(Number.isFinite))throw Error('热量参数无效');
  const calorieDeficit=Math.round(baseEnergy+activeEnergy-intake);
  return {calorieDeficit,ringProgress:targetDeficit>0?Math.max(0,Math.min(1,calorieDeficit/targetDeficit)):0};
}
