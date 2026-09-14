# 模型分工配置 · 2026-09-13

| 能力 | 配置变量 | 调用位置 |
| --- | --- | --- |
| Vision | EXPO_PUBLIC_EP_VISION | processVisionInput；食品、补剂和InBody读取 |
| Pro-32k | EXPO_PUBLIC_EP_PRO | processMealPlanning；常规体测/训练分析，≤10天复盘 |
| Pro-128k | EXPO_PUBLIC_EP_PRO_128K | processAnalysis；>10天或multi_day_plan分析 |
| Lite-32k | EXPO_PUBLIC_EP_LITE | parseDailyLog；意图、数量及单位提取 |
| ASR | VOLC_ASR_API_KEY、VOLC_ASR_RESOURCE_ID | 独立语音服务，当前仅配置检测，适配器待接入 |
| TTS | VOLC_TTS_API_KEY、VOLC_TTS_RESOURCE_ID、VOLC_TTS_VOICE | 独立语音服务，当前仅配置检测，适配器待接入 |

这张表定义任务分工，不保证模型商品名称仍可开通、真实上下文窗口、性能等级或费用。请使用控制台当前已开通的Endpoint ID，对应能力需实际验证。旧版语音控制台使用APP ID/Access Token时，需按账号实际鉴权方式适配，不能把ARK_API_KEY直接当语音密钥。

## 当前状态

视觉已按用户最新指定保存为doubao-seed-evolving；使用现有服务端密钥，通过Chat Completions真实调用视觉路由成功，测试标签每100g换算正确。本机配置已保存；未部署Supabase或切换旧手机图片入口。其余三个模型及语音配置缺失。代码未冒用原doubao-seed-evolving填充这四项，未覆盖用户现有.env.local，未切换旧录入流程。没有创建付费资源或部署云端新版本。

`services/aiRouter.ts` 已扩展long路由与AnalyzePeriod入口，使用原生fetch和Chat Completions格式。多日分析返回待确认建议；目前不提供跨日期联合库存优化，单餐仍使用程序库存与营养校验。Lite当前做结构化意图提取，未新增一般聊天回答方法。

## 本机配置

运行 `script/configure-ai-routing.ps1` 并输入四个真实模型ID或Endpoint ID，或通过参数传入；只配置一项时加-Partial，其余已有项会保留：

```powershell
./script/configure-ai-routing.ps1 -Vision 'ep-真实视觉ID' -Pro32k 'ep-真实Pro32kID' -Pro128k 'ep-真实Pro128kID' -Lite 'ep-真实LiteID'
```

ID存入 `%APPDATA%/循序/ai-routing.json`；不存API密钥。Node进程环境变量优先于此文件。直接使用AILogicRouter的生产后台仍从环境变量读取。

后台复用现有本机加密豆包密钥；若设置服务端ARK_API_KEY，则优先使用该值。新增配置文件按请求重新读取；服务器源代码变更需要重启Expo后生效。

## 新后台入口

- GET `/native-api/ai/status`：在现有配对认证之后返回配置状态。未实测时ready/verified=false，避免仅因变量存在就显示可用。
- POST `/native-api/ai/route`：在现有配对认证之后调用processInput。请求支持image/text/voiceTranscript/GenerateMealPlan/AnalyzePeriod。
- 允许逐路配置；仅在所调用的路由缺少ID时返回配置错误，不要求视觉识别先配齐其他模型。不打印密钥。

这些是Expo开发网关接口，生产需要经过用户鉴权的云端handler；当前App旧的食材查询/联网检索接口未改接新入口。不能将部署前的新增路由宣称为手机已启用。

分析请求示例：

```json
{"action":"AnalyzePeriod","analysis":{"task":"review","days":30,"data":{"entries":[]}}}
```

语音当前继续使用系统转写，voiceTranscript可交给Lite。火山ASR/TTS需要确认服务开通、凭据类型、资源ID、音色后实现相应适配器及录音/播放接入。

## 检查

`node script/test-ai-router.cjs` 与 `node script/test-ai-router-config.cjs`；均为模拟调用/配置测试，不代表实际模型可用性或速度。

官方语音文档：https://www.volcengine.com/docs/6561/1631584?lang=zh

本轮已保存视觉模型配置至本机私有配置文件。2026-09-13实测：视觉服务请求返回HTTP_404；最小文字请求进一步返回ModelNotOpen，证实并非标签图片或JSON结构导致。需要在同一API密钥所属账号开通该模型后重测。

最新验证：doubao-seed-evolving视觉路由8.765秒返回JSON，40g单份正确归一为每100g 250kcal / 10g蛋白 / 45g碳水 / 5g脂肪；库存未知保留null。结果文件：../../work/evolving-vision-probe.json。前述Seed-2.1-Pro错误仅为历史测试记录。

## 最新轻量文本配置

EXPO_PUBLIC_EP_LITE=deepseek-v4-flash-260425，视觉仍为doubao-seed-evolving。
轻量路由独立凭据以Windows DPAPI加密保存在本机ai-route-keys.json；生产后台使用ARK_LITE_API_KEY。该凭据不覆盖ARK_API_KEY，也不进入Expo客户端。

新增answerQuestion及AskQuestion action：常识问答直接一次调用Lite，返回kind=answer和source=model_knowledge。未指定action时先做意图分类，question再进入常识问答。parseDailyLog仍独立提取结构化记录。Flash轻量请求关闭thinking，实际是否可用须以该方舟部署响应为准。

2026-09-13实测：现有密钥与新提供的轻量专用密钥均返回404 / InvalidEndpointOrModel.NotFound。新密钥下最小Chat Completions请求同样失败；因此无法验证响应速度或实际效果，未切换App原入口。需要核对该密钥账号、北京地域、模型是否可调用及控制台生成的确切模型ID。
测试结果：../../work/flash-lite-probe.json。模型权限错误不能靠重试或修改UI可用文案解决。
