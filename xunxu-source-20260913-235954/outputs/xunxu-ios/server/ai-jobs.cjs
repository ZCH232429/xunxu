const crypto = require('node:crypto');

// Memory only: no uploaded photos or credentials are written to disk.
function createJobs({run, now = Date.now, ttl = 10 * 60 * 1000, limit = 64, concurrency = 4}) {
 const jobs = new Map();
 function prune() { for (const [id, job] of jobs) if (job.finished && now() - job.finished >= ttl) jobs.delete(id); }
 function start(endpoint, body) {
  prune();
  const hash = crypto.createHash('sha256').update(endpoint + '\n' + body).digest('hex');
  for (const job of jobs.values()) if (job.hash === hash && (!job.finished || job.status === 200)) return job.id;
  if ([...jobs.values()].filter(j => !j.finished).length >= concurrency) throw Error('厨房 AI 正在处理其他请求，请稍后重试。');
  if (jobs.size >= limit) { const oldest = [...jobs.values()].find(j => j.finished); if (oldest) jobs.delete(oldest.id); else throw Error('请求过多，请稍后重试。'); }
  const job = {id: crypto.randomUUID(), hash, started: now(), finished: 0, status: 202, data: null};
  jobs.set(job.id, job);
  Promise.resolve().then(() => run(endpoint, body)).then(result => {
   job.status = result.status; job.data = result.data;
  }).catch(() => {
   job.status = 503; job.data = {error: '后台连接失败，请稍后重试。'};
  }).finally(() => { job.finished = now(); });
  return job.id;
 }
 function read(id) {
  prune(); const job = jobs.get(id);
  if (!job) return {status: 404, data: {error: '识别任务已过期或后台已重启，请重新提交。'}};
  if (!job.finished) return {status: 202, data: {jobId: id, pending: true, elapsedSeconds: Math.floor((now() - job.started) / 1000)}};
  return {status: job.status, data: job.data};
 }
 return {start, read};
}
module.exports = {createJobs};
