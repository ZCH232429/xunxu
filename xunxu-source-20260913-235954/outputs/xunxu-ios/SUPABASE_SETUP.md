# 循序多用户测试版配置

当前实现：iOS 原生验证码登录、Apple 原生授权、会话恢复/退出；登录账号的完整工作台记录通过 Supabase 保存。每次成功保存才更新版本号，离线保存失败会明确提示，不宣称已同步。演示档案按用户 ID 隔离，仅保存在手机。

尚未接通：真实 Supabase 项目、邮件/短信投递、Apple provider。因此当前界面会显示“云服务尚未配置”。旧桌面/网站尚未迁移账号系统；厨房 AI 仍为开发配对服务，不是公开多用户服务。

## 创建项目

1. 打开 https://supabase.com/dashboard ，创建项目 `xunxu`。项目区域按主要用户所在地选择。数据库密码自行保存，不要发到聊天。
2. 从项目 Connect 对话框或 Settings → API Keys 获取 Project URL 和 **Publishable key**。不要使用 secret key 或 service_role。
3. 复制 `.env.example` 为 `.env.local`，填写 URL 和 Publishable key。
4. 在项目 SQL Editor 中执行 `supabase/migrations/202609130001_workspaces.sql`。
5. 重启 Expo 开发服务器，让 EXPO_PUBLIC 环境变量进入手机包。

## 邮箱验证码

Authentication → Email Templates → Magic Link 模板中加入：

```html
<h2>登录循序</h2><p>你的验证码：{{ .Token }}</p>
```

保留邮箱注册开关。面向其他用户发送邮件需要配置自己的 SMTP（Supabase 默认邮件服务限制收件人和发送量）。界面发送验证码后必须实际收到邮件并验证；发送成功不等于已登录。

## 手机号

Authentication → Sign In / Providers → Phone，配置短信供应商和适用国家/地区。完成真实测试后设置 `EXPO_PUBLIC_PHONE_AUTH_ENABLED=true`。界面接受 E.164 格式（例如 +82 或 +86 开头），不内置固定国家。

## Apple

在 Apple Developer 为应用标识 `com.xunxu.fitness` 配置 Sign in with Apple，并在 Supabase Apple provider 填写对应允许的 Client IDs。需要什么凭证以控制台要求为准，私钥不得放入 App。

Expo Go 可测试系统 Apple 授权，但 token 的 audience/用户标识可能与正式应用不同；Supabase 的允许 Client IDs 必须与当前测试环境对应。生产前用自己的开发构建重新验证。配置完成后设置 `EXPO_PUBLIC_APPLE_AUTH_ENABLED=true`。

## 验收

- 两个测试账号 A/B：A 保存的体重、冰箱、训练记录在 B 中不可见。
- 同一账号两台设备：保存后另一台重新加载可见；陈旧版本保存提示冲突。
- 退出后回到登录页，重新登录不显示前一个账号的页面缓存。
- 断网保存显示失败，重新联网可重试，不显示伪成功。
- 旧本地记录不自动上传；用户通过原生备份导入明确选择迁移。

数据库只允许本人 SELECT；写入通过绑定 auth.uid() 的版本检查函数。客户端没有指定其他用户 ID 的写入口。服务端凭证不进入手机包。此迁移尚需在真实 Supabase 项目执行并完成双账号实测。

公开发布前仍需补齐账户注销、隐私说明/同意、云端 AI 的用户鉴权与限额、生产邮件短信配置；本次为 Expo Go 内测阶段，不代表 App Store 发布就绪。

官方参考：
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/phone-login
- https://supabase.com/docs/guides/auth/social-login/auth-apple
- https://docs.expo.dev/versions/v57.0.0/sdk/apple-authentication/

2026-09-13：已通过 MCP 在 kuhtkxdboboakpxdddmd 项目应用 create_user_workspaces 迁移，创建 workspaces 表和 save_workspace 函数。已验证匿名保存禁止、登录用户可调用保存函数；客户端 Publishable key 和认证供应商仍待配置。

2026-09-13 连接实测：已配置现代 Publishable key；Auth settings 返回 200，邮箱注册启用，手机号/Apple 关闭；匿名查询 workspaces 返回 401（符合预期）。Expo 已加载 .env.local，iOS bundle 返回 200 并包含项目地址。邮件模板/SMTP 和真实收码登录尚未验证。
