# AILogicRouter

完整实现位于同目录 `aiRouter.ts`。运行环境为 Node.js 22+；不依赖 OpenAI SDK，使用原生 fetch 调用方舟 Chat Completions 兼容接口。

## Endpoint 与部署

复制 `aiRouter.env.example` 中的字段到**后台**环境变量。三个 EP 字段填写火山方舟控制台提供的实际 Endpoint ID：视觉、多步配餐、轻量文本分别映射到用户开通的模型。代码没有把 doubao-vision-pro / doubao-pro-32k / doubao-lite-32k 当作已经可用的真实 ID，也没有将原先单个 Endpoint 冒充为三个模型。

`ARK_API_KEY` 只在后台配置。Expo 页面通过已认证的业务 API 访问此服务，禁止直接导入它。实例由 API handler 创建并复用；handler 还需做用户鉴权、限流、请求大小限制，并从该用户的数据中加载可信库存与目标。router 本身不写库存、不核销用餐、不记录用户图片或密钥。

```ts
import { AILogicRouter } from './services/aiRouter';

const router = AILogicRouter.fromEnv();

const foodOrInBody = await router.processVisionInput(base64Image, requestSignal);
const plan = await router.processMealPlanning(target, fridge, requestSignal);
const parsed = await router.parseDailyLog('我买了三个鸡蛋', requestSignal);

// 多模态统一入口；图片优先，显式配餐 action 直接走 Pro。
const result = await router.processInput({
  voiceTranscript: '帮我用冰箱的食材配一餐',
  target,
  fridge,
}, requestSignal);
```

语音参数是已转写文字；原始音频需另接 ASR，不能把任意音频发给这三个文本/视觉 Endpoint。若同时传入 text 和 voiceTranscript，两段都用于意图提取。图像优先入口只识别图像，其他文字不作该次视觉请求的补充说明。

## 返回契约

- 视觉：`kind = food | supplement | inbody | unknown`；所有结果要求用户确认。食品按原始 serving.grams 在程序中转换为每100g，缺失数据保留 null。ml/片/粒未确认质量时不强行转换为g。补剂保留原份量和成分。InBody只读取报告，不计算或诊断。
- 记录：`kind = daily_log`，intent及items数组。数量保留原单位，支持多项，不猜测营养和个数对应的克重。
- 配餐：`kind = meal_plan`，按库存数据重新计算totals；同一食材跨菜品累计不得超库存。热量误差超过5%或宏量目标超过max(3g,10%)时为needs_adjustment，不谎称达标，也不声称数学上已找到全局最优。
- 错误：`AIRouterError.code` 区分配置、输入、缺少上下文、鉴权状态、JSON/数据校验、网络、超时和取消。错误中不返回上游原文、密钥或用户图片。

每次模型调用有一个覆盖重试/退避的总时间预算：Lite 15秒，Vision/Pro 45秒，最多2次尝试。自动意图配餐是Lite后接Pro，组合预算可达60秒；调用方传AbortSignal可更早终止整个流程。401/403和一般400不重试；429遵循Retry-After，若超出预算则直接返回错误，不提前重试。

默认使用response_format=json_object；若某Endpoint不支持，构造器中显式设置 `jsonMode: { vision: false }` 等，仍通过Prompt和运行时验证约束输出，不因400静默切换模型。

注意：此服务是识别/提取/配餐路由，未新增联网搜索工具，不能把Lite的结构化提取宣称为实时商品营养检索。原有联网资料功能与本服务的整合需要在后台适配层完成。

## 验证状态

`node script/test-ai-router.cjs` 使用模拟fetch测试路由、食品换算、补剂/InBody独立结构、累计库存、程序计算总量、未达标反馈、非法输入、错误JSON与429重试、401不重试、取消及超时。

尚未取得三个真实Endpoint ID，未进行三个模型的端到端联调，也未替换App现有线上调用。

接口格式参考：字节官方 SDK 的 Chat Completions 参数定义：
https://github.com/volcengine/volcengine-python-sdk/blob/master/volcenginesdkarkruntime/types/chat/completion_create_params.py
