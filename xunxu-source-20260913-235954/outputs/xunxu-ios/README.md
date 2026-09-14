# 循序 iOS 测试版

当前已从初始化页面推进到 0.1.0 测试版：原生外壳与手机存储、相机、扫码、备份分享，复用完整工作台的六个页面、深色色块 UI 和写实人体指导，并使用 PingFang。

运行 `script/preview-phone.cmd`，用 Expo Go 打开电脑端显示的二维码。电脑需保持开机，测试服务需保持运行。

- `npm run sync:workbench`：同步桌面界面与逻辑。
- `npm run typecheck`：检查 TypeScript。
- `npm run doctor`：检查 Expo 依赖。
- `npm run export:ios`：验证 iOS JavaScript 打包；不生成 IPA。

首次连接厨房 AI 需要在“我的设置 → 连接厨房 AI / 测试设置”输入电脑的测试配对码。配对码不是豆包密钥。

完整功能范围、修改方式与真机验收步骤见 [TESTING.md](TESTING.md)。正式独立安装包、Apple 健康同步与 TestFlight 分发需后续开发。
