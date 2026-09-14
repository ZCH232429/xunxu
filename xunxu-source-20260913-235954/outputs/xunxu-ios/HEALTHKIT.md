# Apple 健康与 Apple Watch 大盘

2026-09-13：本阶段为代码与界面测试，用户尚无 Apple Developer 账号。不触发 EAS 签名构建或付费开通。

## 首页整合（2026-09-13 更新）

按用户反馈，移除单独健康入口和 `/health` 页面。现在在现有“今日总览”展示饮食预算、四项运动指标、核心与深睡、今日训练和冰箱快捷操作；删除“身体正在回应你的努力”和重复训练横幅，身体趋势独立页面继续保留。
首页 WebView 通过 `native-bridge.js` 接收原生 HealthKit 模型；授权、刷新、保存均在首页完成。无原生健康数据时展示已记录指标与饮食预算，不伪造手表读数。新版首页由 `workbench-overrides/home.js`、`home.css` 生成，`sync:workbench` 可重复执行。

## 架构

- 现有“今日总览”内嵌健康状态，无新增导航入口。
- `lib/health/HealthKitService.ts`：延迟加载原生模块，HealthKit 只读授权，统计查询，部分失败处理。
- `lib/health/calculations.js`：无 UI、无网络的时间区间与能量计算，可独立测试。
- `lib/health/model.ts`：全局可复用 discriminated union 与只含计算结果的 UI 模型。
- `lib/health/useHealthDashboard.ts`：协调健康查询、已登录用户的饮食目标、刷新与云端汇总保存。UI 不读原始样本。
- `components/health/dashboard-ui.tsx`：PermissionRequestCard、CalorieDeficitRing、MetricCardGrid、SleepCard。深色底、纯色色块、PingFang SC、胶囊按钮。进度环 duration=1500 的 spring，数值 1500ms cubic easing，响应系统减少动态效果设置。

## 状态与授权

`isLoading → needsPermission | noData | success | error | unavailable`。
申请读取：活动能量、心率、步数、静息心率、睡眠。`toShare: []`，没有写入健康数据权限。
本地标记仅代表授权对话框完成，不表示读权限已授予。HealthKit 不允许 App 区分读取被拒绝与没有数据；noData 会明确解释两种可能。
Expo Go / 网页 / Android 返回 unavailable，不加载 Nitro 原生模块、不伪造可用状态。真实 iPhone 开发构建才会请求授权。Watch 无需独立伴侣 App，读取的是已经同步到 iPhone HealthKit 的数据，不是手表实时流。
当前前台进入大盘、返回前台、手动刷新重新查询；不承诺后台实时同步。构建配置关闭 background entitlement。

## 计算口径

- 本地日期从 iPhone 当天 00:00 至查询时刻；不固定 UTC 午夜。
- 活动能量与步数使用 HealthKit cumulativeSum，不手动叠加手机和手表样本。静息心率是当日 restingHeartRate 样本均值。
- 区间为 `(220 − 年龄) × 60%–70%`。同源相邻心率点仅在间隔 ≤60秒时线性插值，对区间内时间求和；合并重叠来源时段，不跨空档推算，不把每个点当一分钟。完整分钟向下取整。界面标记样本估算及覆盖时长；这不是实际脂肪消耗量测量。
- 昨夜窗口为前一天18:00至今天12:00，不超过当前时刻。只求 core=3、deep=4 的区间并集；不计 REM=5、awake=2、unspecified=1。缺少分期显示“—”，不显示假0。
- 云端通用 `sleep` 字段保留所有睡眠分期的总睡眠（1/3/4/5），避免把 core+deep 错用于恢复监控；core+deep 单独存在 `coreDeepSleepHours`。
- `calorieDeficit = 基础消耗 − 已记录摄入 + 今日活动消耗`。基础消耗采用基础信息中的全天 Mifflin 静息代谢估算，而不是包含活动系数的 TDEE，因此不重复计算活动。不是完整全天的实测缺口。目标环分母为原饮食计划的正缺口；负缺口显示盈余；没有正目标时不画完成进度。
- 读取失败和没有记录不当作0展示；模型必需数值字段配套 `available`。饮食未标记完整时明显提示缺口可能偏高。

## 云端数据

默认只在设备内查询与展示。用户点击保存汇总并确认后，通过已有用户隔离的 save_workspace RPC 保存日报，不上传原始心率样本。保存前重读云端版本，只覆盖可用指标，保留其他日期/手动字段。并发写入由现有版本检查拒绝，页面反馈失败。当天汇总标记 energyComplete=false，避免当作完整日的实测消耗。回到工作台时刷新云端档案。

## 已完成验证

- `npm run typecheck`。
- `npm run test:health`：跨阈值、采样空档、来源去重、跨日截断、分期睡眠、能量收支、目标环上下界。
- `npx expo export --platform ios --output-dir dist-health-ios`：iOS JS/Hermes 打包（不是已签名 IPA）。
- `npx expo config --type introspect --json`：HealthKit entitlement 与 UsageDescription 生效。
- `work/test-health-ui.mjs`：浏览器移动尺寸，测试时在浏览器内注入 HealthKit 假服务，拦截所有 Supabase 请求，不写真实数据；生产代码无测试数据入口。

## 真机验收尚待完成

尚未签名、安装或在真 iPhone/Apple Watch 上验证 HealthKit/Nitro。仅 JS 打包通过不等于原生编译或健康同步成功。
未来具备 Apple Developer 账号后，在 Windows 可通过 EAS 的现有 development profile 云编译，安装开发客户端后用 `npx expo start --dev-client --tunnel` 连接。云构建需要配置 EAS 项目、签名设备、公开 Supabase 环境变量；不能把私钥打进客户端。当前工作台仍依赖开发服务器，不是可离线发布的生产安装包。
验收覆盖：首次授权、部分授权、全拒绝、撤销、无手表/无睡眠分期、锁屏后返回、跨午夜、手表延迟同步、饮食更新、切换账号、保存失败和并发冲突。对照 Apple 健康的同日步数/活动能量与选定睡眠窗口。

参考：
- https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data
- https://docs.expo.dev/develop/development-builds/introduction/
- https://docs.expo.dev/versions/v57.0.0/sdk/svg/
