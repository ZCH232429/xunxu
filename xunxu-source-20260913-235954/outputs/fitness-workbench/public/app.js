import { portable, localRequest } from "./portable-store.js";
import { guideDetails } from "./guide-data.js";
import { trainingAnalytics, weeklyEnergy } from "./analytics.js";
import {
  empty,
  demo,
  dateKey,
  shift,
  round,
  mean,
  types,
  exercises,
  trends,
  targets,
  intake,
  plan,
  volume,
  recovery,
  checkin,
} from "./engine.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
for (const name of ["gesturestart", "gesturechange", "gestureend"])
  document.addEventListener(name, (event) => event.preventDefault(), {
    passive: false,
  });
let mode = localStorage.getItem("fit-mode") || "personal",
  state,
  version = 0,
  page = "overview",
  today = dateKey(),
  selected = today,
  status = {},
  draft = null,
  scanControls = null;
const icons = {
    overview: "◈",
    body: "⌁",
    training: "↗",
    nutrition: "◉",
    review: "◎",
    settings: "⚙",
  },
  nav = {
    overview: "今日总览",
    body: "身体趋势",
    training: "今日训练",
    nutrition: "饮食与采买",
    review: "周期复盘",
    settings: "我的设置",
  };
const kitchenGateway = "";
function fridgeInput(method = "manual") {
  const tabs =
    '<div class="fridge-entry">' +
    [
      ["manual", "手动输入"],
      ["photo", "拍照识别"],
      ["barcode", "扫描条形码"],
    ]
      .map(
        ([v, t]) =>
          `<button type="button" data-intake="${v}" ${v === method ? 'class="primary"' : ""}>${t}</button>`,
      )
      .join("") +
    "</div>";
  const content =
    method === "manual"
      ? '<label>食材名称与数量<textarea name="description" required maxlength="500" placeholder="例如：生牛后腿肉 300g"></textarea></label><p class="fine">联网查询成分资料，自动计算营养。无需手填蛋白质、碳水和脂肪；生熟与肥瘦差异会在结果中说明。</p>'
      : method === "photo"
        ? '<p>拍摄商品包装或清晰营养标签，支持中文、韩文与英文。</p><label>拍摄照片<input name="cameraPhoto" type="file" accept="image/*" capture="environment"></label><label>从相册选择<input name="albumPhoto" type="file" accept="image/*"></label><label>补充说明（可选）<input name="description" placeholder="例如：这包还剩 300g"></label><p class="fine">点击识别会将所选照片发送给豆包。外观照片只能估算食材种类，实际克重由你确认。</p>'
        : '<label>商品条形码<input name="code" required inputmode="numeric" pattern="[0-9]{8}|[0-9]{12,14}" placeholder="支持韩国商品常见的 880 开头条码"></label><button type="button" data-action="camera">打开摄像头扫描</button><label>上传条码照片<input id="barcode-photo" type="file" accept="image/*"></label><video id="scanner" muted playsinline style="width:100%;max-height:230px"></video><p class="fine">先查询食品数据库，未收录则联网检索完整条码。无法确认时补拍包装，不猜测商品。</p>';
  dialog(
    "放入冰箱 · " +
      { manual: "手动输入", photo: "拍照识别", barcode: "扫描条形码" }[method],
    tabs +
      content +
      '<p id="food-progress" role="status" aria-live="polite"></p>',
    async (form) => {
      const node = $("#dialogform"),
        submit = node.querySelector('[type="submit"]'),
        progress = node.querySelector("#food-progress");
      if (submit.disabled) return false;
      submit.disabled = true;
      const started = Date.now(),
        message =
          method === "photo"
            ? "正在识别照片；缺少标签时还会联网查询"
            : "正在联网查询营养资料";
      progress.textContent = message + "…";
      const timer = setInterval(() => {
        if (!node.isConnected) {
          clearInterval(timer);
          return;
        }
        progress.textContent =
          message +
          " · 已等待 " +
          Math.floor((Date.now() - started) / 1000) +
          " 秒";
      }, 1000);
      try {
        const payload = {
          mode: method,
          text: form.get("description") || "",
          code: form.get("code") || "",
        };
        if (method === "photo") {
          const file = form.get("cameraPhoto")?.size
            ? form.get("cameraPhoto")
            : form.get("albumPhoto");
          if (!file?.size) throw Error("请先拍摄或选择照片");
          payload.image = await imageData(file, 1400);
        }
        const food = await api("/api/food/resolve", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if ($("#dialogform") !== node || !$("#modal").open) return false;
        close();
        fridgePreview(food);
        return false;
      } catch (e) {
        progress.textContent = e.message;
        return false;
      } finally {
        clearInterval(timer);
        submit.disabled = false;
      }
    },
  );
  $('#dialogform [type="submit"]').textContent = "识别并生成营养资料";
  if (method === "barcode")
    $("#barcode-photo").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const progress = $("#food-progress");
      try {
        if (!window.ZXingBrowser) throw Error("扫码组件尚未加载");
        const url = URL.createObjectURL(file);
        try {
          const result =
            await new ZXingBrowser.BrowserMultiFormatReader().decodeFromImageUrl(
              url,
            );
          $('#dialogform [name="code"]').value = result.getText();
          progress.textContent = "条码已识别，请点击查询";
        } finally {
          URL.revokeObjectURL(url);
        }
      } catch {
        progress.textContent = "未读到清晰条码，请靠近拍摄或输入条码数字";
      }
    };
}
function fridgePreview(food) {
  const links = (food.sources || [])
    .filter((x) => safeUrl(x.url))
    .map(
      (x) =>
        `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title || "参考来源")} ↗</a>`,
    )
    .join("<br>");
  dialog(
    "确认放入冰箱",
    `<h3>${esc(food.name)}</h3><p>${food.kind === "estimate" ? "成分表估算 · 并非实测值" : "包装 / 数据库营养资料 · 请核对商品"} · ${esc(food.state)}</p><div class="food-nutrients">${[
      ["能量", food.kcal, "kcal"],
      ["蛋白质", food.p, "g"],
      ["碳水", food.c, "g"],
      ["脂肪", food.f, "g"],
    ]
      .map(
        ([label, val, unit]) =>
          `<div><small>${label} / 100 g</small><b>${round(val)} ${unit}</b></div>`,
      )
      .join(
        "",
      )}</div><p class="fine">钠：${food.sodium == null ? "资料未提供" : round(food.sodium) + " mg / 100 g"}</p><p>${esc(food.note || "请核对食材名称、生熟与包装规格。")}</p><p class="fine">${esc(food.source)}<br>${links}</p>${field("实际放入 / 剩余量 g", "stockGrams", food.stockGrams ?? "", "number", 'required min="0.1" max="100000" step=".1"')}<p class="fine">这里只需确认实物数量，无需填写营养数据。</p><button type="button" data-intake="photo">补拍包装重新识别</button>`,
    async (form) => {
      const entry = {
        ...food,
        id: food.id || crypto.randomUUID(),
        stockGrams: Number(form.get("stockGrams")),
      };
      const old = state.foods;
      state.foods = old.filter((x) => x.id !== entry.id).concat(entry);
      const ok = await save();
      if (!ok) state.foods = old;
      else toast("已放入冰箱");
      return ok;
    },
  );
  $('#dialogform [type="submit"]').textContent = food.id
    ? "保存数量"
    : "确认放入冰箱";
}
document.addEventListener(
  "click",
  (e) => {
    const input = e.target.closest("[data-intake]"),
      edit = e.target.closest("[data-intake-edit]");
    if (!input && !edit) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    close();
    if (input) fridgeInput(input.dataset.intake);
    else {
      const food = state.foods.find((x) => x.id === edit.dataset.intakeEdit);
      if (food) fridgePreview(food);
    }
  },
  { capture: true },
);
async function api(url, opt = {}) {
  if (portable && (url === "/api/assistant" || url === "/api/food/resolve")) {
    let r;
    try {
      r = await fetch(kitchenGateway + url, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        ...opt,
      });
    } catch {
      throw Error("助手服务未连通，请刷新循序后重试");
    }
    let j;
    try {
      j = await r.json();
    } catch {
      throw Error("助手服务响应异常");
    }
    if (!r.ok) throw Error(j.error || "请求失败");
    return j;
  }
  if (portable) return localRequest(url, opt, empty);
  let r = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opt,
  });
  let j = await r.json();
  if (!r.ok) throw Error(j.error || "请求失败");
  return j;
}
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 4000);
}
async function load() {
  let j = await api("/api/state/" + mode);
  state = j.state;
  version = j.version;
  if (mode === "demo" && !state.body.length) {
    state = demo();
    await save(false);
  }
  status = await api("/api/status");
  render();
}
async function save(redraw = true) {
  try {
    let r = await api("/api/state/" + mode, {
      method: "PUT",
      body: JSON.stringify({ state, version }),
    });
    version = r.version;
    if (redraw) render();
    return true;
  } catch (e) {
    toast("保存失败：" + e.message);
    await load();
    return false;
  }
}
const num = (v, unit = "") =>
  v == null || !Number.isFinite(v)
    ? "—"
    : `${round(v, unit === "kg" ? 1 : 0)}${unit ? ` <small>${unit}</small>` : ""}`;
const tag = (text, cl = "") => `<span class="tag ${cl}">${esc(text)}</span>`;
const button = (text, action, cl = "") =>
  `<button class="${cl}" data-action="${action}">${text}</button>`;
function field(label, name, value = "", type = "number", attrs = "") {
  return `<label>${label}<input name="${name}" type="${type}" value="${esc(value ?? "")}" ${attrs}></label>`;
}
function select(label, name, options, value) {
  return `<label>${label}<select name="${name}">${Object.entries(options)
    .map(
      ([k, v]) =>
        `<option value="${k}" ${String(value) === k ? "selected" : ""}>${v}</option>`,
    )
    .join("")}</select></label>`;
}
function dialog(title, html, onSubmit) {
  activeHuman?.dispose();
  activeHuman = null;
  let d = $("#modal");
  d.innerHTML = `<form id="dialogform"><div class="dialog-head"><h2>${title}</h2><button type="button" data-action="close" class="icon">×</button></div>${html}<div class="dialog-foot"><button type="button" data-action="close">取消</button><button class="primary" type="submit">确认保存</button></div></form>`;
  d.showModal();
  $("#dialogform").onsubmit = async (e) => {
    e.preventDefault();
    try {
      let result = await onSubmit(new FormData(e.target));
      if (result !== false) {
        d.close();
        scanControls?.stop();
      }
    } catch (e) {
      toast(e.message);
    }
  };
}
function close() {
  scanControls?.stop();
  scanControls = null;
  $("#modal").close();
}
function chart(field = "weight") {
  let rows = trends(state, field),
    values = rows.flatMap((x) => [x.raw, x.avg]).filter((x) => x != null);
  if (!values.length)
    return `<div class="empty chart-empty"><span>⌁</span><p>第一条记录，是看见变化的开始</p><small>每天同一条件测量，满 4 条后显示 7 日均线</small></div>`;
  let low = Math.min(...values) - 0.5,
    hi = Math.max(...values) + 0.5,
    y = (v) => 160 - ((v - low) / (hi - low)) * 125,
    x = (i) => 35 + (i / 27) * 680;
  let segments = (key) => {
    let result = "",
      pen = false;
    rows.forEach((r, i) => {
      if (r[key] == null) {
        pen = false;
        return;
      }
      result += `${pen ? "L" : "M"}${x(i)},${y(r[key])} `;
      pen = true;
    });
    return result;
  };
  return `<svg class="trend" viewBox="0 0 750 205" role="img" aria-label="${field} 原始值及七日均线">${[0, 1, 2, 3].map((i) => `<line x1="35" x2="720" y1="${35 + i * 42}" y2="${35 + i * 42}" stroke="#e9eae4"/><text x="0" y="${40 + i * 42}" fill="#93968a" font-size="11">${round(hi - (i * (hi - low)) / 3, 1)}</text>`).join("")}<path d="${segments("raw")}" fill="none" stroke="#bcc5b4" stroke-width="1.5"/>${rows.map((r, i) => (r.raw == null ? "" : `<circle cx="${x(i)}" cy="${y(r.raw)}" r="2.8" fill="#bdc8b7"><title>${r.date}: ${r.raw}</title></circle>`)).join("")}<path d="${segments("avg")}" fill="none" stroke="#49674a" stroke-width="3.5" stroke-linecap="round"/><text x="35" y="197" fill="#92978c" font-size="11">${rows[0].date.slice(5)}</text><text x="665" y="197" fill="#92978c" font-size="11">${today.slice(5)}</text></svg>`;
}
function metric(label, value, sub) {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
}
function render() {
  const p = state.profile;
  $("#app").innerHTML =
    `<aside class="sidebar"><div class="brand"><b>循</b><div>循序<span>FITNESS WORKBENCH</span></div></div><div class="workspace-label">我的健康空间</div><nav>${Object.entries(
      nav,
    )
      .map(
        ([k, v]) =>
          `<button data-page="${k}" class="${page === k ? "active" : ""}"><span>${icons[k]}</span>${v}${k === "review" && due() ? "<i></i>" : ""}</button>`,
      )
      .join(
        "",
      )}</nav><div class="side-note"><div class="seed">✳</div><b>持续，比完美更重要。</b><p>让每一次记录，成为下一次<br>调整的依据。</p></div><button class="profile-switch" data-action="mode"><span class="avatar">${mode === "demo" ? "试" : "我"}</span><div>${esc(p.name)}<small>${mode === "demo" ? "演示数据 · 点击切回我的档案" : "本设备档案 · 点击体验演示"}</small></div><span>⇄</span></button></aside><main data-view="${page}"><header><div><span class="eyebrow">YOUR PACE, YOUR PROGRESS</span><h1>${nav[page]}</h1><p>${{ overview: "吃得明白，练得有序。今天也向目标靠近一点。", body: "关注趋势，不被某一天的数字左右。", training: "计划可以改变，进步依然有迹可循。", nutrition: "从韩国包装标签，到每一餐的真实摄入。", review: "用均值看变化，用恢复状态决定下一步。", settings: "数据属于你，连接方式也由你决定。" }[page]}</p></div><div class="header-actions">${tag(mode === "demo" ? "演示档案 · 不代表你的数据" : "● 本地保存", mode === "demo" ? "amber" : "green")}<span class="date">${today.replaceAll("-", " / ")}</span></div></header>${mode === "demo" ? '<div class="notice">你正在体验独立的演示档案。示例体重、食品和健康数据均为虚构；点击左下角切回真实记录。</div>' : ""}${page === "overview" ? overview() : page === "body" ? bodyPage() : page === "training" ? trainingPage() : page === "nutrition" ? nutritionPage() : page === "review" ? reviewPage() : settingsPage()}<footer>循序 · 数据驱动，自主选择 <span>本设备存储 / 首尔时区 / v2.0</span></footer></main>`;
  enhance();
  bindForms();
}
function due() {
  let last = state.checks
    .map((x) => x.date)
    .sort()
    .at(-1);
  return !last || shift(last, state.profile.checkInterval) <= today;
}
function overview() {
  let t = targets(state),
    n = intake(state, today),
    h = state.health.find((x) => x.date === today) || {},
    b = state.body
      .filter((x) => x.weight > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1),
    r = recovery(state),
    next = plan(state, today, 7),
    pct = t.kcal ? Math.min(100, (n.kcal / t.kcal) * 100) : 0,
    complete = state.closedDays.includes(today);
  return `<div class="grid overview-grid"><section class="card energy"><div class="card-top"><h2>今日能量预算</h2>${tag("动态估计")}</div><div class="energy-main"><div class="ring" style="--pct:${pct}%"><div><small>已记录摄入</small><strong>${round(n.kcal)}</strong><span>kcal</span></div></div><div class="energy-stats"><span>目标摄入<strong>${num(t.kcal, "kcal")}</strong></span><span>每日总消耗 TDEE<strong>${num(t.tdee, "kcal")}</strong></span><span>${complete ? "估计热量缺口" : "距全天目标剩余"}<strong class="olive">${num(t.kcal == null ? null : complete ? t.tdee - n.kcal : t.kcal - n.kcal, "kcal")}</strong></span></div></div><div class="macros">${[
    ["蛋白质", "p"],
    ["碳水", "c"],
    ["脂肪", "f"],
  ]
    .map(
      ([name, k]) =>
        `<div><span>${name}<b>${round(n[k])} / ${t[k] ?? "—"} g</b></span><div class="bar ${k}"><i style="width:${t[k] > 0 ? Math.min(100, (n[k] / t[k]) * 100) : 0}%"></i></div></div>`,
    )
    .join(
      "",
    )}</div><p class="fine">${esc(t.source)} · ${complete ? "已确认全天饮食完整" : "当天尚未结束，不能把未记录部分当作真实缺口"}</p>${button("＋ 记录一餐", "meal", "primary full")}</section><section class="card trend-card"><div class="card-top"><h2>身体正在回应你的努力</h2>${tag("过去 28 天")}</div><div class="weight-head"><strong>${num(b?.weight, "kg")}</strong><span>最新体重 <small>${b?.date || "等待记录"}</small></span><div class="legend">● 7 日均线 <span>● 每日测量</span></div></div>${chart()}<div class="mini-metrics">${metric("体脂率", num(b?.fat, "%"), "同一设备观察趋势")}${metric("腰围", num(b?.waist, "cm"), "固定位置与测量条件")}${metric("记录天数", state.body.length + " <small>天</small>", "让变化更清楚")}</div></section></div><div class="health-strip">${metric("↗ 今日步数", num(h.steps, "步"), h.source || "尚未手动记录")}${metric("♡ 静息心率", num(h.rhr, "bpm"), r.baseline ? `个人基线 ${round(r.baseline)} bpm` : "等待建立个人基线")}${metric("☾ 昨夜睡眠", h.sleep == null ? "—" : h.sleep + " <small>h</small>", "请排除重复睡眠片段")}${metric("◎ 恢复观察", r.flags.length ? "留意恢复" : r.ready ? "未见阈值异常" : "数据不足", r.flags[0] || "结合主观疲劳，不作医学诊断")}</div><div class="grid lower-grid"><section class="card"><div class="card-top"><h2>这一周，循序前进</h2>${button("调整计划 ↗", "goto-training", "text")}</div><div class="week">${next.map((d) => `<button class="day ${d.date === today ? "today" : ""} ${d.type}" data-action="schedule:${d.date}"><span>${new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(new Date(d.date + "T12:00:00+09:00"))}</span><b>${d.date.slice(8)}</b><em>${types[d.type].split(" · ")[0]}</em><small>${d.actual ? "已完成" : d.custom ? "已调整" : "计划"}</small></button>`).join("")}</div><div class="tip">↳ 临时换练也没关系。系统从实际记录续接推拉腿，并为同类训练留出恢复时间。</div></section><section class="card coach"><span class="eyebrow">WEEKLY REFLECTION</span><h2>${due() ? "给这一周一次复盘" : "下一次进步，从恢复开始"}</h2><p>${esc(checkin(state).message)}</p>${button("查看复盘与建议 →", "goto-review", "dark")}</section></div>`;
}
function bodyPage() {
  let latest =
    state.body.slice().sort((a, b) => b.date.localeCompare(a.date))[0] || {};
  return `<div class="toolbar"><span>测量建议：晨起如厕后、进食前；围度每周固定条件测量</span>${button("＋ 记录体征", "body", "primary")}</div><div class="health-strip">${["weight", "fat", "waist", "abdomen", "hip", "thigh"].map((k, i) => metric(["体重", "体脂率", "腰围", "腹围", "臀围", "大腿围"][i], num(latest[k], i === 0 ? "kg" : i === 1 ? "%" : "cm"), "最新记录")).join("")}</div><section class="card"><div class="card-top"><h2>28 天体征趋势</h2><select id="trend-field"><option value="weight">体重</option><option value="fat">体脂率</option><option value="waist">腰围</option><option value="abdomen">腹围</option><option value="hip">臀围</option><option value="thigh">大腿围</option></select></div><div id="bodychart">${chart()}</div><p class="fine">灰点为原始数据，绿线为最近 7 个日历日均值（至少 4 次测量）；未测量日不补零。</p></section><section class="card spaced"><h2>测量档案</h2><div class="table-scroll"><table><thead><tr><th>日期</th><th>体重 kg</th><th>体脂 %</th><th>腰 / 腹 cm</th><th>臀 / 腿 cm</th><th></th></tr></thead><tbody>${
    state.body
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(
        (x) =>
          `<tr><td>${x.date}</td><td>${x.weight ?? "—"}</td><td>${x.fat ?? "—"}</td><td>${x.waist ?? "—"} / ${x.abdomen ?? "—"}</td><td>${x.hip ?? "—"} / ${x.thigh ?? "—"}</td><td>${button("编辑", `body:${x.date}`, "text")}</td></tr>`,
      )
      .join("") || '<tr><td colspan="6">还没有测量记录</td></tr>'
  }</tbody></table></div></section>`;
}
function trainingPage() {
  let schedule = plan(state, today, 14),
    weekSessions = state.sessions.filter(
      (x) => x.date >= shift(today, -6) && x.date <= today,
    ),
    v = volume(weekSessions.flatMap((x) => x.sets)),
    current = draft;
  return `<div class="toolbar"><span>${state.profile.template === "beginner" ? "减量起步方案 · 默认每动作 2 组，保留约 2 次余力" : "原视频完整方案 · 不强制力竭和短歇组"} / 每周 ${state.profile.frequency} 次</span>${button("开始记录训练", "start", "primary")}</div><section class="card"><div class="card-top"><h2>未来两周 · 可自由调整</h2>${tag("从实际完成情况续接")}</div><div class="week fortnight">${schedule.map((d) => `<button class="day ${d.date === today ? "today" : ""} ${d.type}" data-action="schedule:${d.date}"><span>${d.date.slice(5)}</span><b>${types[d.type].split(" · ")[0]}</b><small>${d.reason}${d.warning && d.type !== "rest" ? " · 恢复间隔短" : ""}</small></button>`).join("")}</div></section>${current ? sessionEditor(current) : ""}<div class="health-strip spaced">${metric("近 7 天训练", weekSessions.length + " <small>次</small>", "按实际完成日期")}${metric("工作组", v.sets + " <small>组</small>", "排除标记为热身的组")}${metric("外部负重总量", num(v.kg, "kg"), "仅供记录，不用于跨动作比较")}</div><section class="card spaced"><div class="card-top"><h2>动作库 · 来自你的跟练视频</h2><a href="/analysis.html" target="_blank">查看完整分析 ↗</a></div><div class="exercise-grid">${exercises.map((e) => `<article class="exercise"><div class="exercise-art ${e.type}" style="background-image:url(/thumbs/${e.id}.jpg)"><span>${e.type === "push" ? "↗" : e.type === "pull" ? "↙" : "⌁"}</span><b>${e.type.toUpperCase()}</b><button data-action="video:${e.id}">▶ 原视频演示</button></div><div class="exercise-body"><h3>${e.name}</h3>${button("人体 3D 指导 ↗", `guide:${e.id}`, "text")}<small>${e.muscles}</small><p>${e.cue}</p><div>${tag(e.prescription)}${e.unilateral ? tag("每侧分别记录") : ""}</div></div></article>`).join("")}</div></section><section class="card spaced"><h2>训练历史与渐进追踪</h2><p class="fine">外部负重 = 杠铃总重量 / 两只哑铃合计；单侧动作每侧单独记一行。自重与辅助组保留组数，不混入外部负重吨位。仅比较同动作、同器械、同记录方式。</p>${
    state.sessions
      .slice()
      .reverse()
      .map(
        (s) =>
          `<details><summary>${s.date} · ${types[s.type]} <span>${volume(s.sets).sets} 工作组 · ${round(volume(s.sets).kg)} kg</span></summary>${s.sets.map((x) => `<p class="fine">${esc(exercises.find((e) => e.id === x.exercise)?.name || x.exercise)} ${x.side || ""} · ${x.weight} kg × ${x.reps} · RPE ${x.rpe} ${x.warmup ? "热身" : ""} · ${x.mode === "external" ? "外部负重" : x.mode === "body" ? "自重" : "辅助"}</p>`).join("")}${button("删除这次记录", `delete-session:${s.id}`, "danger text")}</details>`,
      )
      .join("") ||
    '<div class="empty">完成第一场训练后，这里会形成你的容量档案。</div>'
  }</section>`;
}
function sessionEditor(d) {
  return `<section class="card spaced workout"><div class="card-top"><div><span class="eyebrow">LIVE SESSION</span><h2>${types[d.type]} · ${d.date}</h2></div>${button("结束并保存", "finish", "primary")}</div><p class="fine">草稿自动保存在当前浏览器。热身组单独标记；原视频进阶节奏以动作质量和恢复为前提。</p><div class="table-scroll"><table><thead><tr><th>动作 / 侧别</th><th>负重类型</th><th>kg</th><th>次数</th><th>RPE</th><th>热身</th><th></th></tr></thead><tbody>${d.sets
    .map(
      (x, i) =>
        `<tr><td>${esc(exercises.find((e) => e.id === x.exercise)?.name || x.exercise)} ${x.side || ""}</td><td><select data-set="${i}" data-key="mode">${Object.entries(
          { external: "外部负重", body: "自重", assisted: "辅助重量" },
        )
          .map(
            ([k, v]) =>
              `<option value="${k}" ${x.mode === k ? "selected" : ""}>${v}</option>`,
          )
          .join(
            "",
          )}</select></td>${["weight", "reps", "rpe"].map((k) => `<td><input aria-label="${k}" type="number" min="${k === "weight" ? 0 : 1}" max="${k === "rpe" ? 10 : k === "reps" ? 200 : 1000}" step="${k === "reps" ? 1 : 0.5}" data-set="${i}" data-key="${k}" value="${x[k]}"></td>`).join("")}<td><input type="checkbox" data-set="${i}" data-key="warmup" ${x.warmup ? "checked" : ""}></td><td>${button("×", `remove-set:${i}`, "icon")}</td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></div><div class="toolbar">${button("＋ 添加工作组 / 自定义动作", "add-set")}${button("放弃草稿", "discard", "text")}</div></section>`;
}
function nutritionPage() {
  let t = targets(state, selected),
    n = intake(state, selected),
    meals = state.meals.filter((x) => x.date === selected);
  return `<div class="toolbar"><label class="inline">记录日期 <input type="date" id="food-date" value="${selected}"></label><div>${button("营养目标", "macro")}${button("＋ 记录一餐", "meal", "primary")}</div></div><div class="health-strip">${metric("目标热量", num(t.kcal, "kcal"), t.source)}${metric("蛋白质", num(t.p, "g"), `已记录 ${round(n.p)} g`)}${metric("碳水化合物", num(t.c, "g"), `已记录 ${round(n.c)} g`)}${metric("脂肪", num(t.f, "g"), `已记录 ${round(n.f)} g`)}</div>${t.error ? `<div class="notice">${t.error}</div>` : ""}<div class="grid lower-grid spaced"><section class="card"><div class="card-top"><h2>今天吃了什么</h2>${tag(state.closedDays.includes(selected) ? "全天记录完整" : "尚未确认完整")}</div>${meals.map((m) => `<div class="meal-row"><span class="meal-icon">${m.meal === "早餐" ? "☀" : m.meal === "午餐" ? "◒" : "☾"}</span><div><b>${esc(m.name)}</b><small>${m.meal} · ${m.grams > 1 ? m.grams + " g · " : ""}P ${round(m.p)} / C ${round(m.c)} / F ${round(m.f)} g</small></div><strong>${round(m.kcal)} <small>kcal</small></strong>${button("×", `delete-meal:${m.id}`, "icon")}</div>`).join("") || '<div class="empty">从第一餐开始，建立自己的食物档案。</div>'}<div class="total">记录合计 <b>${round(n.kcal)} kcal</b></div>${button(state.closedDays.includes(selected) ? "取消全天完整标记" : "✓ 确认当天所有饮食已记全", "close-day", "full")}</section></div><section class="card spaced"><div class="card-top"><div><h2>周度备餐与采买</h2><p class="fine">按食材克数规划；生重与熟重必须匹配，烹调用油也计入。</p></div>${button("＋ 安排食材", "plan-meal")}</div>${state.mealPlan.map((m) => `<div class="meal-row"><span>${m.date}</span><div><b>${esc(state.foods.find((f) => f.id === m.foodId)?.name || "食材已移除")}</b><small>${m.meal} · ${m.grams} g</small></div>${button("记入当天", `consume-plan:${m.id}`, "text")}${button("×", `delete-plan:${m.id}`, "icon")}</div>`).join("") || '<div class="empty">将食材分配到未来一周，采买清单会自动合并克数。</div>'}<div class="toolbar"><span>清单范围：今天起 7 天，按食材汇总</span>${button("生成购物清单", "shopping", "primary")}</div></section>`;
}
function safeUrl(s) {
  try {
    let u = new URL(s);
    return ["https:", "http:"].includes(u.protocol);
  } catch {
    return false;
  }
}
function reviewPage() {
  let c = checkin(state),
    r = recovery(state),
    last = state.checks.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  return `<div class="toolbar"><span>${due() ? "本周期复盘已到期" : "下次复盘：" + shift(last.date, state.profile.checkInterval)} · 每 ${state.profile.checkInterval} 天一次</span>${button("完成本次 Check-in", "check", "primary")}</div><div class="grid lower-grid"><section class="card"><div class="card-top"><h2>连续两周平台期检查</h2>${tag(c.eligible ? "可考虑微调" : "保持观察", c.eligible ? "amber" : "green")}</div><div class="mini-metrics">${c.avgs.map((a, i) => metric(["前两周均值", "上周均值", "近 7 天均值"][i], num(a, "kg"), `${c.coverage[i]} / 7 天有记录`)).join("")}</div><p>${c.message}</p><div class="tip">最近 14 天已确认完整饮食 ${c.logged} 天。均值需覆盖三周，才能比较连续两段变化；还需排除经期、水分、盐分和记录遗漏。</div>${c.eligible ? `<div class="stack spaced">${button(state.profile.diet === "keto" ? "评估减少 100 kcal 总摄入" : "评估减少 100 kcal（约 25 g 碳水）", "adjust-calorie")}${button("选择增加 15 分钟低强度有氧", "adjust-cardio")}</div>` : ""}</section><section class="card coach"><span class="eyebrow">RECOVERY FIRST</span><h2>${r.flags.length ? "先照顾恢复" : "恢复与疲劳监控"}</h2><p>${r.flags.join("；") || "目前没有足够证据需要降容。请同时观察训练表现、肌肉酸痛和主观疲劳。"}</p><p class="fine">近三天睡眠均值 ${r.sleep == null ? "—" : round(r.sleep, 1)} h；心率基线 ${round(r.baseline) ?? "—"} bpm。心率升高不能单独诊断“中枢神经疲劳”。</p>${r.flags.length ? button("记录本周降容建议", "deload", "dark") : tag(r.ready ? "监测已建立" : "等待基线数据")}</section></div><section class="card spaced"><h2>复盘与体态照片</h2><p class="fine">照片仅保存在本机档案。建议固定光线、距离与姿势；不从照片自动推断精确体脂。</p><div class="check-grid">${
    state.checks
      .slice()
      .reverse()
      .map(
        (c) =>
          `<article class="check"><b>${c.date}</b><p>${esc(c.note)}</p>${c.photo ? `<img src="${c.photo}" alt="${c.date} 用户体态记录">` : ""}<small>主观疲劳 ${c.fatigue} / 10</small></article>`,
      )
      .join("") ||
    '<div class="empty">每周留下简短复盘，比频繁改变计划更有用。</div>'
  }</div></section><section class="card spaced"><h2>策略调整记录</h2>${state.adjustments.map((a) => `<div class="meal-row"><span>${a.date}</span><div><b>${esc(a.text)}</b><small>${a.undone ? "已撤回" : "已确认"} · ${esc(a.reason || "用户选择")}</small></div>${!a.undone && a.kind === "calorie" ? button("撤回", `undo:${a.id}`, "text") : ""}</div>`).join("") || '<p class="fine">建议需要你确认后才会改变目标，不会悄悄削减热量。</p>'}</section>`;
}
function settingsPage() {
  const p = state.profile;
  return `<div class="grid lower-grid"><section class="card"><h2>身体档案与偏好</h2><form id="profile-form" class="form-grid">${field("档案名称", "name", p.name, "text", 'required maxlength="40"')}${select("公式生理性别参数", "sex", { male: "男性公式", female: "女性公式" }, p.sex)}${field("参考体重 kg", "weight", p.weight || "", "number", 'required min="30" max="300" step=".1"')}${field("身高 cm", "height", p.height || "", "number", 'required min="100" max="230"')}${field("年龄", "age", p.age || "", "number", 'required min="18" max="100"')}${select("日常活动系数（含步数）", "activity", { 1.2: "1.2 · 久坐", 1.4: "1.4 · 轻活动", 1.6: "1.6 · 中等活动", 1.8: "1.8 · 高活动" }, p.activity)}${field("手动 TDEE kcal（0 = 使用公式）", "manualTdee", p.manualTdee, "number", 'min="0" max="8000"')}${select("每周训练次数", "frequency", { 1: "1 次", 2: "2 次", 3: "3 次", 4: "4 次", 5: "5 次", 6: "6 次" }, p.frequency)}${select("训练模板", "template", { beginner: "减量起步 · 每动作 2 组", original: "原视频完整组数" }, p.template)}${select("复盘周期", "checkInterval", { 7: "每周", 14: "每两周" }, p.checkInterval)}${select("复盘到期时", "requireCheck", { 1: "开始新训练前必须复盘", 0: "仅提醒，不限制训练" }, (p.requireCheck ?? true) ? 1 : 0)}<div class="form-wide"><button class="primary">保存档案</button><p class="fine">未填写档案时不计算个性化热量。体重优先取最近测量。TDEE 是估计值，日常步数不再重复加到活动系数上。</p></div></form></section><section class="card tinted"><span class="eyebrow">ALWAYS WITH YOU</span><h2>随身工作台</h2><p>手机用 Safari 打开私人在线入口，选择分享 → 添加到主屏幕。完成首次缓存后，今日计划与 3D 指导可离线查看。</p><div class="stack"><a class="mobile-entry" href="https://xunxu-fitness-workbench.easy-plume-7011.chatgpt.site" target="_blank" rel="noreferrer">打开手机私人入口 ↗</a>${button("导出档案到手机", "export")}${button("导入电脑 / 手机档案", "restore")}${button("手动记录步数、心率、睡眠", "manual-health")}</div><p class="fine">各设备本地保存自己的档案。换设备时导出再导入；不会自动把体态照片或记录上传到服务器。原视频完整文件保留在电脑，手机可看配套对照片段。</p></section></div><div class="grid lower-grid spaced"><section class="card"><h2>数据与备份</h2><p>真实档案和演示档案分开保存。备份包含健康记录及体态照片，请保存到你信任的位置。</p><div class="stack">${button("导出当前档案 JSON", "export")}${button("从备份恢复当前档案", "restore")}</div></section><section class="card"><h2>识别服务与来源</h2><p>冰箱统一支持手动输入、拍照识别与条形码。文字与条码补查需要后台联网搜索；照片通过豆包识别中韩英营养标签。</p><p class="fine">照片仅在点击识别后发送至豆包。不明成分不填零；通用食材的成分表估算会明确标注。</p><a href="/analysis.html" target="_blank">视频分析与科学参考 ↗</a></section></div>`;
}
function bodyDialog(date = today) {
  const old = state.body.find((x) => x.date === date) || {};
  dialog(
    "记录身体数据",
    `<div class="form-grid">${field("日期", "date", date, "date", "required")}${["weight", "fat", "waist", "abdomen", "hip", "thigh"].map((k, i) => field(["体重 kg", "体脂率 %", "腰围 cm", "腹围 cm", "臀围 cm", "大腿围 cm"][i], k, old[k] ?? "", "number", `min="${i === 0 ? 20 : 1}" max="${i === 1 ? 70 : 300}" step=".1"`)).join("")}</div><p class="fine">空白代表未测量，不会记为零。</p>`,
    async (f) => {
      let row = { date: f.get("date") };
      for (const k of ["weight", "fat", "waist", "abdomen", "hip", "thigh"])
        if (f.get(k) !== "") row[k] = Number(f.get(k));
      if (Object.keys(row).length === 1) throw Error("请至少填写一项体征");
      state.body = state.body.filter((x) => x.date !== row.date);
      state.body.push(row);
      return save();
    },
  );
}
function foodDialog(existing = {}) {
  dialog(
    "食材营养档案",
    `<p class="fine">按包装标注基准录入。例如每份 210 g，就填 210；营养值全部对应这一份。AI / 条码结果必须核对。</p><div class="form-grid">${field("商品名 / 韩文名", "name", existing.name || "", "text", 'required maxlength="120"')}${field("标签基准 g", "basis", existing.basis || 100, "number", 'required min=".1" max="5000" step=".1"')}${["kcal", "p", "c", "f", "sodium"].map((k, i) => field(["能量 kcal", "蛋白质 g", "碳水 g", "脂肪 g", "钠 mg（非盐）"][i], k, existing[k] ?? "", "number", `required min="0" max="${k === "sodium" ? 100000 : 10000}" step=".1"`)).join("")}${select("称量状态", "state", { 生重: "生重", 熟重: "熟重", 即食: "即食", 按包装确认: "按包装确认" }, existing.state || "即食")}${field("Coupang 商品链接（选填）", "url", existing.url || "", "url")}${field("数据来源 / 核对备注", "source", existing.source || "用户核对包装标签", "text")}</div>`,
    async (f) => {
      let o = Object.fromEntries(f);
      for (const k of ["basis", "kcal", "p", "c", "f", "sodium"])
        o[k] = Number(o[k]);
      if (o.p + o.c + o.f > o.basis * 1.15)
        throw Error("三大营养素总克数超过标签基准，请核对单位");
      o.id = existing.id || crypto.randomUUID();
      state.foods = state.foods.filter((x) => x.id !== o.id);
      state.foods.push(o);
      return save();
    },
  );
}
function mealDialog(foodId) {
  const food = state.foods.find((x) => x.id === foodId);
  dialog(
    food ? "记入这份食材" : "记录一餐",
    `<div class="form-grid">${field("日期", "date", selected, "date", "required")}${select("餐次", "meal", { 早餐: "早餐", 午餐: "午餐", 晚餐: "晚餐", 加餐: "加餐" }, "午餐")}${field("名称", "name", food?.name || "", "text", 'required maxlength="120"')}${food ? field("食用重量 g", "grams", food.basis, "number", 'required min=".1" max="10000" step=".1"') : ["kcal", "p", "c", "f"].map((k, i) => field(["整餐热量 kcal", "蛋白质 g", "碳水 g", "脂肪 g"][i], k, "", "number", 'required min="0" max="10000" step=".1"')).join("")}</div>${food ? `<p class="fine">按 ${food.basis} g 标签比例换算 · ${esc(food.state)}</p>` : '<p class="fine">输入整餐合计，或取消后从食材库选择食物自动换算。</p>'}`,
    async (f) => {
      let m = Object.fromEntries(f);
      m.id = crypto.randomUUID();
      if (food) {
        m.grams = Number(m.grams);
        for (let k of ["kcal", "p", "c", "f"])
          m[k] = round((food[k] * m.grams) / food.basis, 1);
        m.foodId = food.id;
      } else {
        m.grams = 1;
        for (let k of ["kcal", "p", "c", "f"]) m[k] = Number(m[k]);
      }
      state.meals.push(m);
      state.closedDays = state.closedDays.filter((d) => d !== m.date);
      return save();
    },
  );
}
function scheduleDialog(date) {
  let d = plan(state, date, 1)[0];
  dialog(
    "调整 " + date,
    `<p>可以休息、换练或自由训练。历史训练保持原样，未来自动计划从实际完成情况续接。</p>${select("当日安排", "type", { auto: "恢复自动安排", ...types }, state.schedule[date] || "auto")}<p class="fine">当前建议：${types[d.type]}。手动安排优先；连续刺激同一训练组时会提示恢复间隔。</p>`,
    async (f) => {
      let t = f.get("type");
      if (t === "auto") delete state.schedule[date];
      else state.schedule[date] = t;
      return save();
    },
  );
}
function macroDialog() {
  let p = state.profile;
  dialog(
    "营养目标与饮食偏好",
    `<div class="form-grid">${select("饮食模式", "diet", { balanced: "均衡饮食", cycle: "碳水循环", keto: "低碳 / 生酮偏好" }, p.diet)}${field("每日目标缺口 kcal", "deficit", p.deficit, "number", 'required min="0" max="1000" step="10"')}${field("蛋白质 g / kg", "protein", p.protein, "number", 'required min="1" max="2.5" step=".1"')}${field("脂肪 g / kg（均衡 / 循环）", "fat", p.fat, "number", 'required min=".5" max="1.5" step=".1"')}${field("低碳模式碳水 g", "carbs", p.carbs, "number", 'required min="20" max="100"')}</div><p class="fine">碳水循环训练日目标热量上调 15%，休息日按计划周频率抵消；改动周训练次数后重新核对周预算。低碳模式由剩余热量计算脂肪，不自动建议再减碳水。</p>`,
    async (f) => {
      for (const [k, v] of f) state.profile[k] = k === "diet" ? v : Number(v);
      return save();
    },
  );
}
function startWorkout() {
  if (
    (state.profile.requireCheck ?? true) &&
    due() &&
    state.sessions.some(
      (x) => x.date <= shift(today, -state.profile.checkInterval),
    )
  ) {
    page = "review";
    render();
    toast("本周期复盘已到期，请先完成 Check-in；可在设置中调整此规则。");
    return;
  }
  if (draft) {
    page = "training";
    render();
    return;
  }
  dialog(
    "开始一次训练",
    `<div class="form-grid">${field("实际训练日期", "date", today, "date", "required")}${select("训练类型", "type", types, plan(state, today, 1)[0].type === "rest" ? "push" : plan(state, today, 1)[0].type)}</div><p class="fine">自由训练可勾选涉及的肌群，帮助后续排程安排恢复。</p><div class="checks">${["push", "pull", "legs"].map((k) => `<label><input type="checkbox" name="groups" value="${k}">${types[k]}</label>`).join("")}</div>`,
    (f) => {
      let type = f.get("type");
      if (type === "rest") throw Error("休息日请在日程中安排，无需记录训练组");
      draft = {
        id: crypto.randomUUID(),
        date: f.get("date"),
        type,
        groups: type === "other" ? f.getAll("groups") : [type],
        sets: exercises
          .filter((e) => e.type === type)
          .flatMap((e) =>
            Array.from(
              { length: state.profile.template === "beginner" ? 2 : e.sets },
              () => (e.unilateral ? ["左", "右"] : [""]),
            )
              .flat()
              .map((side) => ({
                exercise: e.id,
                side,
                mode: e.id === "dips" ? "body" : "external",
                weight: 0,
                reps: e.reps,
                rpe: 8,
                warmup: false,
              })),
          ),
      };
      if (state.profile.template === "original" && type === "push") {
        draft.sets
          .filter((x) => x.exercise === "bench")
          .forEach((x, i) => (x.reps = [12, 10, 8][i] || 8));
      }
      persistDraft();
      page = "training";
      render();
    },
  );
}
function persistDraft() {
  if (draft) localStorage.setItem("fit-draft-" + mode, JSON.stringify(draft));
  else localStorage.removeItem("fit-draft-" + mode);
}
function addSet() {
  dialog(
    "添加一组",
    `<div class="form-grid">${select("动作", "exercise", Object.fromEntries([...exercises.map((e) => [e.id, e.name]), ["custom", "自定义动作"]]), "bench")}${field("自定义动作名（选用）", "custom", "", "text")}${select("侧别", "side", { "": "双侧 / 不分侧", 左: "左", 右: "右" }, "")}${select("负重方式", "mode", { external: "外部负重", body: "自重", assisted: "辅助重量" }, "external")}</div>`,
    (f) => {
      let exercise =
        f.get("exercise") === "custom"
          ? f.get("custom").trim()
          : f.get("exercise");
      if (!exercise) throw Error("请填写动作名");
      draft.sets.push({
        exercise,
        side: f.get("side"),
        mode: f.get("mode"),
        weight: 0,
        reps: 10,
        rpe: 8,
        warmup: false,
      });
      persistDraft();
      render();
    },
  );
}
function imageData(file, max = 1200) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type))
      return reject(Error("请选择 JPG、PNG 或 WebP 图片"));
    let im = new Image(),
      url = URL.createObjectURL(file);
    im.onload = () => {
      let c = document.createElement("canvas"),
        ratio = Math.min(1, max / im.width, max / im.height);
      c.width = im.width * ratio;
      c.height = im.height * ratio;
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      reject(Error("图片无法读取"));
    };
    im.src = url;
  });
}
function filePick(accept) {
  return new Promise((resolve) => {
    let i = document.createElement("input");
    i.type = "file";
    i.accept = accept;
    i.onchange = () => resolve(i.files[0]);
    i.click();
  });
}
function download(name, text, type = "application/json") {
  let u = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function shopping() {
  const rows = new Map();
  for (const m of state.mealPlan.filter(
    (x) => x.date >= today && x.date <= shift(today, 6),
  )) {
    const f = state.foods.find((x) => x.id === m.foodId);
    if (f)
      rows.set(f.id, { ...f, grams: (rows.get(f.id)?.grams || 0) + m.grams });
  }
  dialog(
    "未来 7 天购物清单",
    `${[...rows.values()].map((f) => `<div class="meal-row"><input type="checkbox" aria-label="已购买 ${esc(f.name)}"><div><b>${esc(f.name)}</b><small>${esc(f.state)} · ${round(f.grams)} g</small></div>${safeUrl(f.url) ? `<a href="${esc(f.url)}" target="_blank" rel="noreferrer">Coupang ↗</a>` : ""}</div>`).join("") || "<p>请先安排未来一周的食材。</p>"}<p class="fine">采购量按计划所需克数汇总，包装规格与库存可自行调整。</p>`,
    () => {
      download(
        "购物清单.txt",
        [...rows.values()]
          .map(
            (f) => `${f.name}\t${round(f.grams)} g\t${f.state}\t${f.url || ""}`,
          )
          .join("\n"),
        "text/plain",
      );
      toast("购物清单已导出");
    },
  );
  $('#dialogform button[type="submit"]').textContent = "导出清单";
}
async function action(a) {
  let [key, arg] = a.split(":");
  try {
    if (key === "close") return close();
    if (key === "guide") return showGuide(arg);
    if (key === "manual-health") return manualHealth();
    if (key.startsWith("goto-")) {
      page = key.slice(5);
      render();
      return;
    }
    if (key === "mode") {
      mode = mode === "demo" ? "personal" : "demo";
      localStorage.setItem("fit-mode", mode);
      draft = JSON.parse(localStorage.getItem("fit-draft-" + mode) || "null");
      await load();
      return;
    }
    if (key === "body") return bodyDialog(arg || today);
    if (key === "schedule") return scheduleDialog(arg);
    if (key === "food") return fridgeInput("manual");
    if (key === "edit-food")
      return foodDialog(state.foods.find((x) => x.id === arg));
    if (key === "meal") {
      if (page === "overview") selected = today;
      return mealDialog();
    }
    if (key === "use-food") return mealDialog(arg);
    if (key === "macro") return macroDialog();
    if (key === "start") return startWorkout();
    if (key === "add-set") return addSet();
    if (key === "remove-set") {
      draft.sets.splice(Number(arg), 1);
      persistDraft();
      render();
      return;
    }
    if (key === "discard") {
      if (confirm("放弃当前训练草稿？")) {
        draft = null;
        persistDraft();
        render();
      }
      return;
    }
    if (key === "finish") {
      if (!draft.sets.length) throw Error("请至少记录一组");
      if (
        draft.sets.some(
          (x) =>
            !Number.isFinite(x.weight) ||
            x.weight < 0 ||
            !Number.isInteger(x.reps) ||
            x.reps < 1 ||
            x.reps > 200 ||
            x.rpe < 1 ||
            x.rpe > 10,
        )
      )
        throw Error("请核对重量、整数次数和 1–10 的 RPE");
      if (draft.sets.some((x) => x.mode === "external" && x.weight === 0))
        throw Error("外部负重组还未填写重量；徒手动作请选择自重");
      state.sessions.push(structuredClone(draft));
      if (await save()) {
        draft = null;
        persistDraft();
        render();
        toast("训练已保存，后续日程已更新");
      }
      return;
    }
    if (key === "video") {
      let e = exercises.find((x) => x.id === arg);
      if (portable)
        e = {
          ...e,
          time: {
            bench: 485,
            incline: 2085,
            dips: 3135,
            triceps: 3785,
            yraise: 4365,
            onepull: 685,
            row: 2285,
            neutral: 3335,
            wide: 3955,
            curl: 4495,
            singleRdl: 885,
            bulgarian: 1439,
            goblet: 2315,
            rdl: 2635,
            extension: 3205,
          }[arg],
        };
      dialog(
        e.name,
        `<video controls playsinline preload="metadata" src="${portable ? `/clips/${e.id}.mp4` : `/api/video/${e.type}#t=${e.time}`}" style="width:100%;max-height:60vh"></video><p>${e.cue}</p><p class="fine">${portable ? "手机对照片段，完整原文件保留在电脑。片段源自" : "原跟练视频约"} ${Math.floor(e.time / 60)}:${String(e.time % 60).padStart(2, "0")} 起；分段时间为近似定位。${e.prescription}</p>`,
        () => {},
      );
      $('#dialogform button[type="submit"]').textContent = "看完了";
      return;
    }
    if (key === "delete-session") {
      if (confirm("删除此训练记录？未来日程将据此重新计算。")) {
        state.sessions = state.sessions.filter((x) => x.id !== arg);
        await save();
      }
      return;
    }
    if (key === "delete-meal") {
      const m = state.meals.find((x) => x.id === arg);
      state.meals = state.meals.filter((x) => x.id !== arg);
      state.closedDays = state.closedDays.filter((x) => x !== m.date);
      return save();
    }
    if (key === "close-day") {
      state.closedDays = state.closedDays.includes(selected)
        ? state.closedDays.filter((x) => x !== selected)
        : [...state.closedDays, selected];
      return save();
    }
    if (key === "plan-meal") {
      if (!state.foods.length) throw Error("请先添加至少一种食材");
      return dialog(
        "安排备餐食材",
        `<div class="form-grid">${field("日期", "date", today, "date", "required")}${select("餐次", "meal", { 早餐: "早餐", 午餐: "午餐", 晚餐: "晚餐", 加餐: "加餐" }, "午餐")}${select("食材", "foodId", Object.fromEntries(state.foods.map((x) => [x.id, x.name])), state.foods[0].id)}${field("所需克数", "grams", 100, "number", 'required min="1" max="10000"')}</div>`,
        async (f) => {
          state.mealPlan.push({
            ...Object.fromEntries(f),
            grams: Number(f.get("grams")),
            id: crypto.randomUUID(),
          });
          return save();
        },
      );
    }
    if (key === "delete-plan") {
      state.mealPlan = state.mealPlan.filter((x) => x.id !== arg);
      return save();
    }
    if (key === "consume-plan") {
      let m = state.mealPlan.find((x) => x.id === arg),
        f = state.foods.find((x) => x.id === m.foodId);
      selected = m.date;
      mealDialog(f.id);
      $('#dialogform [name="grams"]').value = m.grams;
      $('#dialogform [name="meal"]').value = m.meal;
      return;
    }
    if (key === "shopping") return shopping();
    if (key === "check")
      return dialog(
        "本周期复盘",
        `<div class="form-grid">${field("日期", "date", today, "date", "required")}${field("主观疲劳 1–10", "fatigue", 5, "number", 'required min="1" max="10"')}<label class="form-wide">观察与下周重点<textarea name="note" required placeholder="饥饿感、训练表现、围度变化、执行困难……"></textarea></label><label class="form-wide">体态照片（仅本地保存，可选）<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label></div>`,
        async (f) => {
          let photo = f.get("photo");
          state.checks.push({
            id: crypto.randomUUID(),
            date: f.get("date"),
            fatigue: Number(f.get("fatigue")),
            note: f.get("note"),
            photo: photo?.size ? await imageData(photo, 1000) : null,
          });
          return save();
        },
      );
    if (key === "adjust-calorie") {
      if (!checkin(state).eligible) throw Error("当前不满足微调条件");
      return dialog(
        "确认热量微调",
        `<p>目标缺口从 ${state.profile.deficit} 增加到 ${state.profile.deficit + 100} kcal。${state.profile.diet === "keto" ? "低碳模式保持碳水设置，减少约 11 g 脂肪。" : "保持蛋白质与脂肪，减少约 25 g 碳水。"}建议观察下一周期，不同时叠加有氧干预。</p>`,
        async () => {
          if (state.profile.deficit + 100 > 800)
            throw Error("缺口已较大，请先人工复核目标");
          state.adjustments.push({
            id: crypto.randomUUID(),
            date: today,
            kind: "calorie",
            before: state.profile.deficit,
            text: "目标缺口增加 100 kcal",
            reason: checkin(state).message,
          });
          state.profile.deficit += 100;
          return save();
        },
      );
    }
    if (key === "adjust-cardio" || key === "deload")
      return dialog(
        "记录恢复与策略建议",
        `<p>${key === "deload" ? "下一周工作组减少约 30%，避免力竭，观察疲劳是否缓解。训练组数仍由你自主调整。" : "先在可恢复的日子增加 15 分钟低强度有氧，记录实际完成情况；不同时再减少摄入。"}</p>`,
        async () => {
          state.adjustments.push({
            id: crypto.randomUUID(),
            date: today,
            kind: key,
            text:
              key === "deload"
                ? "下一周建议减少约 30% 工作组"
                : "选择增加 15 分钟低强度有氧",
            reason: "已确认建议，实际执行另行记录",
          });
          return save();
        },
      );
    if (key === "undo") {
      let x = state.adjustments.find((x) => x.id === arg);
      if (state.profile.deficit !== x.before + 100)
        throw Error("目标之后已被修改，请到营养目标手动调整");
      state.profile.deficit = x.before;
      x.undone = true;
      return save();
    }
    if (key === "barcode") {
      dialog(
        "商品条码查询",
        `${field("EAN / UPC 条码", "code", "", "text", 'required pattern="[0-9]{8,14}" inputmode="numeric"')}<button type="button" data-action="camera" class="spaced">打开摄像头扫描</button><video id="scanner" muted playsinline style="width:100%;max-height:240px"></video><p class="fine">条码由豆包联网检索，识别结果需与包装核对。</p>`,
        async (f) => {
          toast("豆包正在联网检索条码…");
          let food = await api("/api/barcode/" + f.get("code"));
          close();
          foodDialog(food);
          return false;
        },
      );
      $('#dialogform button[type="submit"]').textContent = "查询条码";
      return;
    }
    if (key === "camera") {
      if (!window.ZXingBrowser) throw Error("扫码组件加载失败，可输入条码");
      let reader = new ZXingBrowser.BrowserMultiFormatReader();
      scanControls = await reader.decodeFromVideoDevice(
        undefined,
        $("#scanner"),
        (result, error, controls) => {
          if (result) {
            $('#dialogform [name="code"]').value = result.getText();
            controls.stop();
            toast("条码已读出，请点击查询");
          }
        },
      );
      return;
    }
    if (key === "vision") {
      if (!status.vision)
        throw Error(
          "AI 服务尚未配置。请先到连接与设置查看配置方法，或手动填写标签。",
        );
      if (
        !confirm("将所选食品标签照片发送至你配置的 AI 服务？请勿选择体态照片。")
      )
        return;
      let file = await filePick("image/jpeg,image/png,image/webp");
      if (!file) return;
      toast("正在识别标签，请稍候…");
      let food = await api("/api/vision", {
        method: "POST",
        body: JSON.stringify({ image: await imageData(file, 1600) }),
      });
      if (food.error) throw Error(food.error);
      foodDialog(food);
      return;
    }
    if (key === "export") {
      download(
        `循序-${mode}-${today}.json`,
        JSON.stringify({ format: "fit-workbench-v1", state }, null, 2),
      );
      return;
    }
    if (key === "restore") {
      let file = await filePick(".json");
      if (!file) return;
      let j = JSON.parse(await file.text());
      if (j.format !== "fit-workbench-v1" || !j.state?.profile)
        throw Error("不是有效的工作台备份");
      if (!confirm("用备份替换当前档案？建议先导出现有档案。")) return;
      state = j.state;
      await save();
      return;
    }
  } catch (e) {
    toast(e.message);
  }
}
function bindForms() {
  const p = $("#profile-form");
  if (p)
    p.onsubmit = async (e) => {
      e.preventDefault();
      for (let [k, v] of new FormData(p))
        state.profile[k] =
          k === "requireCheck"
            ? v === "1"
            : ["name", "sex", "template"].includes(k)
              ? v
              : Number(v);
      if (await save()) toast("档案已保存");
    };
  const t = $("#trend-field");
  if (t) t.onchange = () => ($("#bodychart").innerHTML = chart(t.value));
  const d = $("#food-date");
  if (d)
    d.onchange = () => {
      selected = d.value;
      render();
    };
  document.querySelectorAll("[data-set]").forEach(
    (el) =>
      (el.onchange = () => {
        let x = draft.sets[Number(el.dataset.set)],
          k = el.dataset.key;
        x[k] =
          k === "warmup"
            ? el.checked
            : k === "mode"
              ? el.value
              : Number(el.value);
        persistDraft();
      }),
  );
}
document.addEventListener("click", (e) => {
  let n = e.target.closest("[data-page]");
  if (n) {
    page = n.dataset.page;
    render();
    window.scrollTo(0, 0);
  }
  let b = e.target.closest("[data-action]");
  if (b) {
    e.preventDefault();
    action(b.dataset.action);
  }
});
$("#modal").addEventListener("close", () => {
  activeHuman?.dispose();
  activeHuman = null;
  scanControls?.stop();
  $("#modal video")?.pause();
});
draft = JSON.parse(localStorage.getItem("fit-draft-" + mode) || "null");
load().catch((e) => {
  $("#app").textContent = "工作台连接失败：" + e.message;
});

function enhance() {
  const foot = $("footer");
  if (foot)
    foot.insertAdjacentHTML(
      "beforeend",
      '<span id="offline-state" class="offline-badge">' +
        (navigator.onLine ? "在线" : "离线") +
        " · " +
        (document.documentElement.dataset.offlineReady === "true"
          ? "3D 离线包就绪"
          : "正在准备离线包") +
        "</span>",
    );
  if (page === "training") {
    $("footer").insertAdjacentHTML(
      "beforebegin",
      trainingAnalytics(state, today),
    );
    $("header").insertAdjacentHTML("afterend", todayGuidance());
  }
  if (page === "overview")
    $("header").insertAdjacentHTML("afterend", todaySummary());
  if (page === "nutrition")
    $("footer").insertAdjacentHTML("beforebegin", weeklyEnergy(state, today));
  if (
    page === "overview" &&
    !state.profile.weight &&
    !state.body.some((x) => x.weight)
  )
    $("header").insertAdjacentHTML(
      "afterend",
      '<div class="notice onboarding">欢迎来到你的工作台。先填写身体档案，生成个人能量与训练目标。 <button data-action="goto-settings">填写身体档案 →</button></div>',
    );
  const badge = $(".header-actions .tag");
  if (badge) {
    badge.outerHTML =
      '<button data-action="mode" class="tag ' +
      (mode === "demo" ? "amber" : "green") +
      '">' +
      (mode === "demo" ? "演示档案 · 切回真实" : "本地档案 · 体验演示") +
      "</button>";
  }
}
function refreshDate() {
  const now = dateKey();
  if (now !== today && !$("#modal").open) {
    today = now;
    selected = now;
    if (state) render();
  }
}
window.addEventListener("focus", refreshDate);
setInterval(refreshDate, 60000);

let activeHuman = null;
function todaysExercises() {
  const actual = state.sessions.filter((x) => x.date === today).at(-1),
    d = plan(state, today, 1)[0];
  const ids = actual?.sets?.map((x) => x.exercise);
  return {
    day: d,
    items: ids?.length
      ? [...new Set(ids)]
          .map((id) => exercises.find((e) => e.id === id))
          .filter(Boolean)
      : exercises.filter((e) => e.type === d.type),
  };
}
function todaySummary() {
  const { day, items } = todaysExercises();
  return (
    '<section class="today-banner"><div><span class="eyebrow">TODAY’S TRAINING</span><h2>' +
    types[day.type] +
    "</h2><p>" +
    (day.type === "rest"
      ? "今天以恢复为主，下一次训练会续接推拉腿循环。"
      : items.map((e) => e.name).join(" · ")) +
    "</p></div>" +
    button(
      day.type === "rest" ? "查看安排 →" : "打开今日指导 →",
      "goto-training",
      "primary",
    ) +
    "</section>"
  );
}
function todayGuidance() {
  const { day, items } = todaysExercises();
  return (
    '<section class="card today-guidance"><div class="card-top"><div><span class="eyebrow">GUIDED SESSION</span><h2>' +
    types[day.type] +
    " · 今日动作指导</h2></div>" +
    tag(day.actual ? "按已完成训练" : "按今天安排") +
    '</div><p class="fine">写实人体网格与骨骼驱动 · 可旋转、慢放和停在关键姿势。轨迹按视频要点重建，非原视频动捕。</p><div class="guide-list">' +
    (items.length
      ? items
          .map(
            (e, i) =>
              '<button data-action="guide:' +
              e.id +
              '"><span class="guide-number">' +
              String(i + 1).padStart(2, "0") +
              "</span><div><b>" +
              e.name +
              "</b><small>" +
              e.prescription +
              "</small></div><span>3D ↗</span></button>",
          )
          .join("")
      : '<div class="empty">今天不安排固定力量动作。可先完成轻松活动、睡眠记录与恢复观察；临时训练可在下方修改安排。</div>') +
    "</div></section>"
  );
}
async function showGuide(id) {
  const e = exercises.find((x) => x.id === id),
    g = guideDetails[id];
  if (!g) throw Error("此自定义动作尚无 3D 轨迹");
  dialog(
    e.name + " · 人体 3D 指导",
    '<div class="human-stage" id="human-stage"><div class="human-loading">正在加载写实人体模型…</div><div class="human-label">' +
      g.focus +
      '</div></div><div class="human-controls"><button type="button" id="human-play">暂停</button><select id="human-speed" aria-label="播放速度"><option value=".35">慢速</option><option value=".7" selected>标准</option><option value="1.1">快速</option></select><button type="button" data-view="front">正面</button><button type="button" data-view="side">侧面</button><button type="button" data-view="back">背面</button><button type="button" data-view="angle">斜侧</button></div><label class="phase-slider">拖动查看关键姿势<input id="human-phase" type="range" min="0" max="1" step=".002" value="0"></label><div class="phase-cues">' +
      g.phases
        .map(
          (x, i) =>
            '<button type="button" data-phase="' +
            [0, 0.48, 0.75][i] +
            '"><b>' +
            ["01", "02", "03"][i] +
            "</b><span>" +
            x +
            "</span></button>",
        )
        .join("") +
      '</div><p class="fine">' +
      g.setup.join(" ") +
      '</p><div class="tip">' +
      g.risk +
      '</div><p class="fine">模型：Blender 官方写实男性人体基础网格（CC0），含 17 个驱动骨骼与 15,093 个顶点。教学轨迹为关键姿势重建；按自身活动度与器械设置调整。</p>' +
      button("对照原视频片段 ▶", "video:" + id, "text"),
    () => {},
  );
  $('#dialogform button[type="submit"]').textContent = "完成查看";
  const host = $("#human-stage");
  try {
    const { mountHuman } = await import("./human-viewer.js");
    const viewer = await mountHuman(host, id);
    if (!host.isConnected || !$("#modal").open) {
      viewer.dispose();
      return;
    }
    activeHuman = viewer;
    host._viewer = viewer;
    host.querySelector(".human-loading").remove();
    let playing = true;
    $("#human-play").onclick = () => {
      playing = !playing;
      viewer.setPlaying(playing);
      $("#human-play").textContent = playing ? "暂停" : "播放";
    };
    $("#human-speed").onchange = (e) => viewer.setSpeed(Number(e.target.value));
    $("#human-phase").oninput = (e) => {
      playing = false;
      viewer.setPhase(Number(e.target.value));
      $("#human-play").textContent = "播放";
    };
    document
      .querySelectorAll("[data-view]")
      .forEach((b) => (b.onclick = () => viewer.view(b.dataset.view)));
    document.querySelectorAll("[data-phase]").forEach(
      (b) =>
        (b.onclick = () => {
          playing = false;
          viewer.setPhase(Number(b.dataset.phase));
          $("#human-play").textContent = "播放";
        }),
    );
    host.addEventListener("poseframe", (e) => {
      if (!host.isConnected) return;
      $("#human-phase").value = e.detail.phase;
      document
        .querySelectorAll("[data-phase]")
        .forEach((b, i) => b.classList.toggle("current", i === e.detail.step));
    });
  } catch (err) {
    host.querySelector(".human-loading").textContent =
      "3D 加载失败：" + err.message + "。可先阅读要点或打开原视频。";
  }
}
function manualHealth() {
  let h = state.health.find((x) => x.date === today) || {};
  dialog(
    "手动记录身体状态",
    '<div class="form-grid">' +
      field("日期", "date", today, "date", "required") +
      field("步数", "steps", h.steps ?? "", "number", 'min="0" max="150000"') +
      field(
        "静息心率 bpm",
        "rhr",
        h.rhr ?? "",
        "number",
        'min="20" max="240"',
      ) +
      field(
        "睡眠时长 h",
        "sleep",
        h.sleep ?? "",
        "number",
        'min="0" max="24" step=".1"',
      ) +
      '</div><p class="fine">未测量项留空，不填零。</p>',
    async (f) => {
      let row = { date: f.get("date"), source: "手动记录" };
      for (let k of ["steps", "rhr", "sleep"])
        if (f.get(k) !== "") row[k] = Number(f.get(k));
      if (Object.keys(row).length === 2) throw Error("至少填写一个指标");
      let old = state.health.find((x) => x.date === row.date);
      state.health = state.health.filter((x) => x.date !== row.date);
      state.health.push({ ...old, ...row });
      return save();
    },
  );
}
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then(async (registration) => {
      await navigator.serviceWorker.ready;
      document.documentElement.dataset.offlineReady = "true";
      const badge = $("#offline-state");
      if (badge)
        badge.textContent =
          (navigator.onLine ? "在线" : "离线") + " · 3D 离线包就绪";
    })
    .catch(() => {});
}

window.addEventListener("online", () => {
  if (state) render();
});
window.addEventListener("offline", () => {
  if (state) render();
});

function fridgeSelection() {
  try {
    return new Set(
      JSON.parse(localStorage.getItem("xunxu-fridge-picks") || "[]"),
    );
  } catch {
    return new Set();
  }
}
function setFridgeSelection(ids) {
  localStorage.setItem("xunxu-fridge-picks", JSON.stringify([...ids]));
}
function fridgeSuggestion(items) {
  const t = targets(state, selected),
    meal = {
      kcal: (t.kcal || 0) * 0.35,
      p: (t.p || 0) * 0.35,
      c: (t.c || 0) * 0.35,
      f: (t.f || 0) * 0.35,
    };
  if (!items.length || !meal.kcal) return null;
  const choose = (key, used) =>
    items
      .filter((x) => !used.has(x.id) && x[key] > 0 && x.basis > 0)
      .sort((a, b) => b[key] / b.basis - a[key] / a.basis)[0];
  const used = new Set(),
    rows = [];
  for (const key of ["p", "c", "f"]) {
    const food = choose(key, used);
    if (!food) continue;
    used.add(food.id);
    const grams = Math.min(
      Number(food.stockGrams) || 9999,
      Math.max(20, (meal[key] * food.basis) / food[key]),
    );
    rows.push({ food, grams: round(grams, 1) });
  }
  return rows;
}
function installFridgeStudio() {
  if (page !== "nutrition" || document.querySelector("#fridge-studio")) return;
  const anchor = document.querySelector(".health-strip");
  if (!anchor) return;
  const picked = fridgeSelection(),
    foods = state.foods,
    chosen = foods.filter((f) => picked.has(f.id)),
    planRows = fridgeSuggestion(
      (chosen.length ? chosen : foods).filter((f) => Number(f.stockGrams) > 0),
    );
  const names = (chosen.length ? chosen : foods)
    .map((x) => x.name)
    .slice(0, 4)
    .join(" ");
  const el = document.createElement("section");
  el.id = "fridge-studio";
  el.className = "fridge-studio";
  el.innerHTML =
    '<div class="fridge-head"><div><span class="eyebrow">MY FRIDGE</span><h2>循序冰箱</h2><p>先把实际拥有的食材入库，再决定这一餐吃什么。</p></div></div><div class="fridge-entry"><button data-intake="manual">＋ 手动输入</button><button data-intake="photo">▧ 拍照识别</button><button data-intake="barcode">▥ 扫描条形码</button></div><div class="fridge-grid"><div class="fridge-list">' +
    (foods.length
      ? foods
          .map(
            (f) =>
              '<div class="fridge-item"><input type="checkbox" data-fridge-food="' +
              f.id +
              '" ' +
              (picked.has(f.id) ? "checked" : "") +
              "><span><b>" +
              esc(f.name) +
              "</b><small>库存 " +
              (f.stockGrams == null ? "待确认" : round(f.stockGrams)) +
              " g · P " +
              round(f.p) +
              " / C " +
              round(f.c) +
              " / F " +
              round(f.f) +
              " / " +
              f.basis +
              " g</small><small>" +
              esc(
                f.kind === "estimate"
                  ? "成分表估算"
                  : f.source || "原有食材档案",
              ) +
              '</small></span><button data-intake-edit="' +
              f.id +
              '">查看</button></div>',
          )
          .join("")
      : '<div class="empty">冰箱还是空的。通过手动输入、拍照识别或扫描条形码放入食材。</div>') +
    '</div><div class="fridge-plan"><span class="eyebrow">NEXT MEAL</span><h3>这一餐怎么配</h3>' +
    (planRows
      ? '<div class="plan-lines">' +
        planRows
          .map(
            (x) =>
              "<div><b>" +
              esc(x.food.name) +
              "</b><span>" +
              x.grams +
              " g</span></div>",
          )
          .join("") +
        "</div>"
      : "<p>完成身体档案并放入至少一种有营养信息的食材后，会生成份量建议。</p>") +
    '<button data-fridge-action="recipe">豆包检索减脂做法 ↗</button><button data-fridge-action="voice">🎙 语音调整这一餐</button><p class="fine">建议以包装标注的生重／熟重为准；烹调油、酱料另行记录。</p></div></div><div class="voice-bar"><b>豆包厨房助手</b><span>AI 与联网检索：豆包</span><button data-fridge-action="voice">按住说话 / 开始语音</button><small id="voice-result">可说“这餐用鸡胸肉和米饭”“减少碳水”或“推荐做法”。</small></div>';
  anchor.after(el);
}
function openRecipeSearch() {
  const selected = state.foods.filter((f) => fridgeSelection().has(f.id)),
    foods = (
      selected.length
        ? selected
        : state.foods.filter((f) => Number(f.stockGrams) > 0)
    )
      .slice(0, 4)
      .map((f) => f.name)
      .join("、"),
    result = document.querySelector("#voice-result");
  if (result)
    askKitchenDoubao(
      `请只通过豆包联网搜索，为${foods || "冰箱现有食材"}推荐减脂做法，并附可核对的来源链接。`,
      result,
    );
}
async function askKitchenDoubao(text, result) {
  const picked = fridgeSelection();
  const context = {
    target: targets(state, selected),
    today: intake(state, selected),
    foods: state.foods
      .filter((f) => picked.has(f.id) || Number(f.stockGrams) > 0)
      .map((f) => ({
        name: f.name,
        stockGrams: f.stockGrams,
        basis: f.basis,
        kcal: f.kcal,
        p: f.p,
        c: f.c,
        f: f.f,
        state: f.state,
      })),
  };
  result.textContent = "正在询问 豆包…";
  try {
    const reply = await api("/api/assistant", {
      method: "POST",
      body: JSON.stringify({ text, context }),
    });
    result.textContent = "豆包：" + reply.answer;
  } catch (error) {
    result.textContent = "豆包 暂不可用：" + error.message;
  }
}
function startKitchenVoice() {
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Speech) {
    toast("当前浏览器不支持网页语音识别。可在手机 Safari 中使用系统听写输入。");
    return;
  }
  const result = document.querySelector("#voice-result");
  const rec = new Speech();
  rec.lang = "zh-CN";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  result.textContent = "正在听…";
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    askKitchenDoubao(text, result);
  };
  rec.onerror = () =>
    (result.textContent = "未能识别语音，请重试或使用系统听写。");
  rec.start();
}
document.addEventListener("change", (e) => {
  const input = e.target.closest("[data-fridge-food]");
  if (!input) return;
  const ids = fridgeSelection();
  input.checked
    ? ids.add(input.dataset.fridgeFood)
    : ids.delete(input.dataset.fridgeFood);
  setFridgeSelection(ids);
  installFridgeStudio();
  document.querySelector("#fridge-studio")?.remove();
  installFridgeStudio();
});
document.addEventListener("click", (e) => {
  const action = e.target.closest("[data-fridge-action]")?.dataset.fridgeAction;
  if (action === "recipe") {
    e.preventDefault();
    openRecipeSearch();
  }
  if (action === "voice") {
    e.preventDefault();
    startKitchenVoice();
  }
});
setInterval(installFridgeStudio, 350);
function installKitchenDoubaoControls() {
  const bar = document.querySelector(".voice-bar"),
    result = document.querySelector("#voice-result");
  bar
    ?.querySelectorAll('[data-fridge-action="voice"]')
    .forEach((button) => (button.textContent = "🎙 点击开始语音"));
  if (bar && !document.querySelector("#kitchen-question")) {
    const label = document.createElement("label");
    label.className = "kitchen-text";
    label.innerHTML =
      '<input id="kitchen-question" placeholder="也可直接输入问题，例如：鸡胸肉怎么做？"><button data-fridge-action="ask">发送给 豆包</button>';
    bar.insertBefore(label, result);
  }
  if (result && !result.dataset.initialized) {
    result.dataset.initialized = "true";
    result.textContent = "点击开始语音或输入问题，发送后显示实际连接结果。";
  }
}
setInterval(installKitchenDoubaoControls, 350);
document.addEventListener("click", (e) => {
  if (e.target.closest('[data-fridge-action="ask"]')) {
    e.preventDefault();
    const text = document.querySelector("#kitchen-question")?.value.trim(),
      result = document.querySelector("#voice-result");
    if (!text) {
      toast("先输入想问厨房助手的问题");
      return;
    }
    askKitchenDoubao(text, result);
  }
});
function tapKitchenVoice() {
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition,
    result = document.querySelector("#voice-result"),
    input = document.querySelector("#kitchen-question");
  if (!Speech) {
    input?.focus();
    if (result)
      result.textContent =
        "此 iPhone 请点键盘上的听写麦克风，说完后点击“发送给 豆包”。";
    return;
  }
  const rec = new Speech();
  rec.lang = "zh-CN";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  if (result) result.textContent = "正在听，请正常说话…";
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    if (input) input.value = text;
    askKitchenDoubao(text, result);
  };
  rec.onerror = () => {
    if (result)
      result.textContent =
        "未能识别语音。可点输入框，使用 iPhone 键盘的听写麦克风。";
  };
  rec.start();
}
document.addEventListener(
  "click",
  (e) => {
    if (!e.target.closest('[data-fridge-action="voice"]')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    tapKitchenVoice();
  },
  { capture: true },
);
