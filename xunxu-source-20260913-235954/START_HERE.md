# 循序开发进度迁移包

这是当前工作目录的源码快照，不是可直接安装的 IPA，也不是线上部署备份。
优先阅读本文件；子目录的早期 README 可能描述旧阶段，不能据此判断当前完成度。

## 包含内容
- outputs/xunxu-ios：Expo / React Native App、界面、业务服务、测试、锁文件、静态素材、Supabase 函数与迁移源码。
- outputs/fitness-workbench：桌面/网页工作台及本地 AI 后端实现。必须保持与 xunxu-ios 同级，手机项目会引用它。
- outputs/xunxu-ai-gateway：现存网关源码，作为历史实现参考，不代表当前云端已部署它。
- MANIFEST.json：各文件 SHA-256；PACKAGING_REPORT.json：排除与脱敏记录。

## 在新平台启动
1. 完整解压，保留 outputs 下的同级目录结构。
2. 安装支持该项目的 Node.js（建议 22 LTS）与 npm。依赖版本以 package-lock.json 为准。
3. 进入 outputs/fitness-workbench，执行 npm ci；再进入 outputs/xunxu-ios，执行 npm ci。
4. 将 xunxu-ios/.env.example 复制为 .env.local，填入自己的 Supabase URL 与 publishable key。登录供应商只有实际配置且验证后才能启用。
5. 在 xunxu-ios 执行 npm run typecheck。
6. 执行 npx expo start --go --clear，使用兼容当前项目 SDK 57 的 Expo Go 扫码。手机和电脑网络必须可达。此启动方式保留已打包的 public/workbench 快照。
7. 若确实需要重新同步桌面素材，再运行 npm run sync:workbench。npm start 会自动同步，因此不要在不了解覆盖文件逻辑时随意重建界面。
8. 桌面工作台可在其目录执行 npm start；这与 Expo 启动是两件事。

项目包含 Windows 的 .cmd/.ps1 辅助工具；macOS/Linux 使用上面的 npm/npx 命令。
Apple 健康、部分语音/原生模块须使用 iOS 开发构建验证，Expo Go 的界面测试不等于 HealthKit 已接通。
本包不包含签名证书或 TestFlight 发布配置授权；未生成 IPA。

## 后端 AI 的配置与实际状态
密钥只放后台运行环境，禁止放入 EXPO_PUBLIC_* 或客户端源码。
启动开发服务前，给进程配置以下环境变量（推荐使用开发平台的私密变量界面）：

    ARK_API_KEY=<有效的主模型密钥>
    ARK_LITE_API_KEY=<有效的文本模型密钥，可与主密钥相同但需有模型权限>
    ARK_MODEL=doubao-seed-evolving
    EXPO_PUBLIC_EP_VISION=doubao-seed-evolving
    EXPO_PUBLIC_EP_LITE=deepseek-v4-flash-260425

EXPO_PUBLIC_EP_PRO 和 EXPO_PUBLIC_EP_PRO_128K 暂未确定，不应伪填为已可用。
这几个 EP 变量只是模型 ID，不是秘密。server/ai-router-config.cjs 从进程环境读取；若平台不自动加载后端变量，必须在启动终端中导入，不能假设 Expo 会替后台导入全部私密 .env 值。
Windows 原机使用的 DPAPI 密钥文件无法迁移到其他账号/系统；本包没有复制这些文件。
本地测试的配对码由新服务生成在 .expo/native-pairing.json；旧设备需要重新配对。

- services/aiRouter.ts：已有视觉、规划、日常解析、常识问答与长周期分析路由、JSON 归一化、超时/重试和库存约束检查。
- doubao-seed-evolving 视觉：此前独立真实调用通过，营养标签测试约 8.8 秒；这是历史结果，不保证新环境可用。
- deepseek-v4-flash-260425：用户控制台显示已开通；最近本地实际调用返回 401 AuthenticationError / The API key doesn't exist。必须换有效密钥并重新实测，不能标记为已接通。
- Pro/长周期模型、ASR/TTS 尚未完成真实接通。
- 新路由仅作为本地服务实现存在；没有证据表明已部署到 Supabase，现有食材输入也尚未全部切换至新路由。不能仅凭状态文案宣称 AI 成功。
- 原有云端优先调用和本地回退仍需检查，可能造成叠加等待；原有云端照片/补剂结构与本地实现存在差异，详见 AI_CAPABILITY_AUDIT.md。

## UI 与产品约束
保留深色画布、纯色色块、超大圆角、PingFang 风格，保留用户恢复的“今日”界面。
workbench-overrides/today-restored 及 public/workbench 是当前界面快照的重要部分，不要用早期桌面源码或初始 Git 提交整体覆盖。
饮食应在 App 内原地切换；统一底部 OmniInputBar 录入食材/补剂，解析后允许修改并确认，不要恢复重复录入页面。
已保存素材随包携带，但原机系统安装的字体未复制；迁移后检查 PingFang 回退与字体授权。
未经用户审核的新运动动图不能接入；不要因为包里保留旧素材就重新启用用户取消的 3D 指导。

## 测试与接手顺序
在 xunxu-ios 执行：

    npm run typecheck
    node script/test-ai-router.cjs
    node script/test-ai-router-config.cjs
    npm run test:nutrition
    npm run test:health
    npm run test:fridge

路由测试主要使用 mock，不证明真实模型权限、计费或网络可用。
本次交接首先验证启动与账号配置，再修复有效文本密钥、进行真实调用，最后让 OmniInputBar 接入经过验证的路由并验证移动端交互。
不要替用户开通收费服务或把未测功能写成已完成。

## 云数据与未携带内容
没有导出真实用户健康记录、账号会话、数据库数据、Storage 文件或服务端秘密。
沿用原项目需要在新平台重新登录相关云服务，并安全配置环境变量；源码不自动迁移线上数据库和 OAuth/短信/SMTP 配置。
若新建云项目，需要另行审核、应用迁移并配置登录提供商；不要未经核对直接覆盖原数据库。
本包不含 node_modules、Git 历史、构建缓存、历史安装包、开发机私密设置和临时调试记录。
提供给其他 AI 开发工具时，可直接让它先读取本文件和 outputs/xunxu-ios/AGENTS.md，再检查实际代码与测试；无需重新从头创建 App。
