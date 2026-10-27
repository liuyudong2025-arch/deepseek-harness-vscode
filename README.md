# DeepSeek Harness Companion

在 VS Code 中运行官方 DeepSeek Harness：对话、文件修改、终端、审批、插件、MCP 和历史会话都保留在同一个侧边栏中。

> 社区集成，非 DeepSeek 官方扩展。

## 使用

1. 点击 Activity Bar 中的 DeepSeek Harness 图标。
2. 设置 API Key。
3. 点击启动。

扩展优先使用系统中的 `dsh`。如果没有安装，会先征得同意，再通过 npx 下载官方 `@deepseek-ai/dsh`。

要求：VS Code 1.90+；通过 npx 启动时需要 Node.js `^22.19` 或 `>=24`。

## 安全

- API Key 保存在 VS Code SecretStorage，不写入设置或日志。
- Harness 仅监听 `127.0.0.1` 的随机端口。
- 内置代理使用随机秘密路径，在内存中转发认证 Cookie，以兼容 VS Code Webview。
- 启动 token 会在日志中脱敏。
- 关闭扩展时会终止它启动的进程树。
- Harness 可以编辑文件和执行命令，因此不支持未受信任工作区。

模型、MCP 和插件的数据处理取决于你配置的服务商。详见随扩展提供的 `PRIVACY.md`。

## 命令

- Start / Stop / Restart
- Open in Editor
- Set DeepSeek API Key
- Copy Selection as Context
- Show Logs

## 发布

见随源码提供的 `PUBLISHING.md`。

MIT License
