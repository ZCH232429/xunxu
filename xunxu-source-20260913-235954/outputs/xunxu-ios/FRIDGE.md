# 智能冰箱与配餐 · iOS 测试版

入口是现有底部“饮食”和首页冰箱按钮。新版 NutritionPanel 在主界面内切换，与其余五页共享固定原生导航栏，不再 push 新页面。旧 /nutrition 路由只重定向到主界面饮食标签；生成的 iOS 网页包已移除旧饮食大盘，删除返回旧版按钮。

## 实现

- `lib/fridge/models.ts`：FoodItem、FoodCategory、Macros、MealTarget、MealSolution 全局接口。
- `VisionScannerService.ts`：通过已配对的 Node 后台请求豆包，不在 App 存模型密钥。拍照、文字、条码共用已部署在测试服务器的 food/resolve。照片先压到最长1400像素、JPEG0.8。
- 后端 `../fitness-workbench/food-resolver.mjs`：提示词要求标签原始 serving 克重及单份宏量营养，输出 JSON；后端独立乘100/serving克重，不能把整包重量或ml当作serving g。新入口启用 strictServing，标签未提供可核对的单份克重则要求补拍。成分表估算保留来源与不确定性。
- `CategorizationEngine`：碳水/蛋白4kcal/g，脂肪9kcal/g，按最高宏量热量贡献分类；中韩英常见天然蔬菜名称优先VEG，过滤明显面包、饼、粉、酱等复合加工名称。
- `MealMathSolver`：有库存上界的加权最小二乘坐标下降，整数克数；支持热量、蛋白、可选碳水和脂肪目标。不可行时显示偏差提示，不编造库存。零克分配不计入用餐。
- `FridgeContext`：Context API 管理当前登录用户库存，适配旧的 foods/basis/kcal/p/c/f，避免另建分裂的食材库。
- `SmartScannerView` → `ConfirmFoodSheet`：所有入库均先确认名称、实际库存和每100g数据。库存未知保持待填，图片不推测剩余克重。
- `FridgeInventoryGrid`：四个分类Tab、纯色网格、空库/用尽/<100g告警。
- `AIPlanDashboard`：从当前未记录餐次与剩余日目标，按早餐25%、午餐40%、晚餐35%的相对比例生成参考分配。各餐依次预留库存，不会重复分配。比例是产品默认值，非原视频规定；可手动调整本餐目标。
- `MacroSlotMachinePicker`：四列 React Native ScrollView、56px吸附行、停滚重算，支持“不选择”。`CalculatedPortionsCard` 淡入；食谱通过真实后台 AI 请求给出，确定性算法负责营养与克重。

## 保存与一致性

点击“确认吃掉这一餐”才提交一份含库存扣减与饮食新增的 workspace。云端沿用 save_workspace 乐观锁与用户隔离；失败不修改本地库存。每餐UUID幂等，拒绝负库存、重复食材和超量。并发版本冲突会提示重新加载，不覆盖另一设备数据。原生退出返回首页会重新载入云端版本。

## 验证

- `npm run test:fridge`：分类、40g→100g换算、库存约束、不可行目标、异常值、用餐幂等与原子转换。
- `work/test-fridge-ui.mjs`：以模拟后端测试四列选材、AI做法请求、保存失败不扣库、成功扣库、扫描后二次确认。截图使用测试食材，不是真实用户记录。
- `work/test-fridge-live-api.mjs`：真实豆包读取韩文100g测试标签，与已知值一致。
- `work/test-serving-live.mjs`：真实豆包区分40g单份与400g整包，后台得到每100g 250kcal / 10g蛋白 / 45g碳水 / 5g脂肪。
- TypeScript检查和 iOS Hermes/JavaScript 导出通过；没有执行签名安装。尚需用户在 Expo Go 真机确认相机、条码对焦与滚轮手感。

当前后台仍由电脑测试服务器承载，手机需访问 Expo 隧道且已设置测试配对码。代码未声称已迁移至独立生产云后端。条码命中率取决于公开数据库和精确检索结果，失败时补拍标签。AI 做法属于模型生成建议，不作为独立验证的营养数据或实际库存更新指令。

## AI 超时优化（2026-09-13）

- 原生冰箱的识别与食谱请求使用 `Prefer: respond-async`：POST 立即返回任务编号，客户端每1.5秒查询结果，不保持一条长连接等待模型。
- 每次网络请求20秒超时，网络异常最多尝试3次；任务总等待预算210秒。错误会如实显示，未知营养数据不会以0补齐。
- `server/ai-jobs.cjs` 对完全相同的端点和请求体计算哈希，复用处理中任务及10分钟内成功结果；错误不缓存。仅内存保存结果，不写照片到磁盘；后台重启会清空任务。限制4个同时执行任务和64条任务记录。查询任务与提交都需要配对认证。
- 此任务服务仅适用于当前配对测试后台。将来迁移多租户云服务时必须按用户身份隔离任务与缓存，不得把共享配对码当生产认证。
- 食材检索和简短食谱禁用深度思考，保留真实联网检索与来源要求。搜索失败不会伪装成功。
- 提交时收起键盘，显示等待时间和断线重连提示。原有未使用异步头的请求保持兼容。
- 实测：旧文字查询28.48秒后因营养单位不符失败；优化后本机查询9.10秒成功，公网隧道查询12.81秒成功（含重复提交与权限校验），缓存复查0.93秒；公网食谱6.76秒。仅代表此次请求，不保证固定延迟。
- `node script/test-ai-jobs.cjs` 验证任务去重、并发上限、过期、失败重试；根目录 `work/test-fridge-async-ui.mjs` 模拟网络中断后重连、异步结果与确认保存；`work/test-ai-tunnel.cjs` 实测公网食材查询及未授权访问拒绝。40g韩文测试标签换算亦通过。

## 原位导航与补剂记录（2026-09-13）

- WorkbenchTabs 统一六个标签；WebView 隐藏重复导航，内页跳转通过桥通知主容器。主容器保持 WebView 布局与实例，不使用 display:none 或 reload。冰箱加载/保存后回传已确认的 workspace 快照；离开饮食时原位更新状态和版本再切换目标标签，拒绝旧版本快照。保存期间暂停切换。
- NutritionPanel 的补剂模块记录名称、运动/健康类型、实际用量及 g/mg/μg/ml/粒/片/份/IU、日期、时间和备注，支持今日/全部、编辑、两次点击确认删除。
- SupplementLog 保存于现有账号 workspace.supplementLogs，与既有云端乐观锁使用同一保存入口。旧档案缺失该字段按空数组处理，无数据库结构改动；保存失败保留表单。补剂日志不自动计入饮食热量，界面提示含热量补剂另计饮食。
- 保留今日饮食记全/撤销按钮；原饮食和库存数据沿用。
- 验证：work/test-supplement-ui.mjs 模拟云端验证原位标签、保存失败、创建编辑、重新读取、删除及库存不变；work/test-integrated-home.mjs 验证 WebView 桥导航、隐藏重复栏、阻止旧饮食渲染、趋势与训练回归；work/test-fridge-async-ui.mjs 验证 AI 异步和冰箱保存。浏览器测试不等于 iPhone 真机手势测试。

导航重载修复：`work/test-tab-no-reload.mjs` 验证四次饮食往返后 document timeOrigin 不变、运行时状态保留、快照新版本用于后续保存、拒绝过期快照。只有用户明确点击错误提示中的“重新连接”才整页 reload。

## 常驻饮食页与补剂扫描

NutritionPanel 不再按标签条件挂载，而是与其他页面同时常驻，保持滚动和配餐选择。原生端使用 WebView 已读取的账号快照初始化冰箱（managed/sharedRecord），不重复 GET；WebView 成功保存也推送新版本至冰箱。只有主动刷新才重新读取。
补剂照片和条码向 food/resolve 发送 productType=supplement，使用独立标签提示词与校验器；保留 servingText、ingredients 和原始单位，不要求克重或宏量营养、不转换每100g。严格条码来源校验仍保留。确认页要求填写实际服用量，随 SupplementLog.label 保存识别资料，后续可在编辑记录中查阅。
测试补剂标签为合成测试图，非真实用户补剂。UI 测试比较切换前后 GET 数量，确认没有再次读取；验证每2粒25μg保持原单位而实际记录1粒。真实豆包测试位于 work/test-supplement-live.mjs。

## 全球条码与照片联网补查

- 支持 EAN-8/13、UPC-A、扫描类型明确的 UPC-E 与 GTIN-14，先校验并规范化，跨地区查询不以国家前缀筛选。食品和补剂条码统一交给豆包联网精确检索完整条码及等价 GTIN；条码不一致不入库。未找到可靠公开资料时要求补拍正面或营养标签。
- 照片第一轮提取标签及identity品牌/产品/口味型号/规格。labelComplete=false、返回error或成分不完整均触发一次携带原图的联网查询；品牌包装须确认同款并具实际检索引用。匹配不清不借用相似营养。完整标签保持一次识别快速路径。
- 新结果保留lookup信息与sources，确认卡片可打开参考来源。补剂始终保留每份/每粒单位。条码失败后提供直接拍摄正面的按钮。
- 这使用多模态识别图片线索加联网搜索，不声称已接入Google Lens等全网反向图片索引，也不保证所有商品都有公开营养资料。
- work/test-global-lookup.mjs覆盖跨地区GTIN、UPC-E、前导零、照片错误与不完整补剂补查、同款验证、来源保留与快速路径；work/test-photo-web-live.mjs用明确标为合成的品牌正面文字图片实测联网检索，不是真实商品照片。

## SDK扫码

SDKBarcodeScanner使用现有expo-camera ~57.0.5。在支持的iPhone上提供CameraView.launchScanner（VisionKit DataScanner）系统增强扫码，启用引导、高亮和双指缩放；不支持/启动失败则回退CameraView实时条码读取。相机路径支持补光和缩放，后台暂停预览，关闭组件释放监听及系统扫描。未增加付费SDK，也未宣称SDK包含全球商品营养数据库。食材与补剂共用此读码层。真机光照/对焦尚需Expo Go现场验证。


## Omni input bar (2026-09-13)

`OmniInputBar` is a controlled presentation component. `OmniInputDock` owns the target menu, camera/gallery action sheet and scanner confirmation flow; `useVoiceInput` owns system speech lifecycle. It stays in the existing nutrition tab above navigation. Draft text survives tab switches and cancelled/failed saves and clears only after successful cloud save. Photo selection compresses to 1400px JPEG before the existing resolver. Barcode SDK remains reachable from +.

Speech uses expo-speech-recognition 57 with explicit microphone/speech permission descriptions. The native module is dynamically imported outside Expo Go. Expo Go focuses the input and directs users to keyboard dictation; it never reports listening. Real start/end events control the listening display, a startup timeout restores controls, and leaving the tab or backgrounding aborts recognition. No speech transcript is automatically sent to AI. Native camera, keyboard positioning and speech require iPhone verification; JS export does not compile the native module.

Validation: `npm run typecheck`; iOS JS/Hermes export; `node work/test-omni-input.mjs` from workspace root (mock auth/backend and browser speech events, verifies automatic submit, draft retention, failed-save retry, target routing, barcode access, narrow layout and recording lifecycle).

## Diet planning and Today verification (2026-09-13)

The Diet tab owns deterministic inventory-bounded recommendations, `PlannedMeal` selection, the large four-wheel custom workspace and inline scanner confirmation above `OmniInputBar`. “就这样吃！” persists selected plans into the versioned workspace without deducting stock. Today is a persistent native sibling panel that receives the same workspace snapshot, so tab changes do not reload the app.

Meal verification sends an explicitly captured plate photo, optional user note, planned weights and only the relevant nutrition labels to `/native-api/meal/verify`. The model estimates actual eaten grams and confidence; the backend discards unknown food IDs and recomputes all macros from the saved per-100g labels instead of trusting model arithmetic. The user reviews the result before one optimistic-concurrency write marks the plan verified, subtracts bounded inventory and appends the actual meal. The UI calls this estimated intake because a photo cannot measure digestion or nutrient absorption.

Validation: `node work/test-diet-today.mjs`, `node work/test-omni-input.mjs`, cloud worker tests, TypeScript, iOS export, and a real configured-provider smoke request with a non-meal test image. The smoke response correctly returned LOW confidence and was never written to user state.
