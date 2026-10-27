# DeepSeek Harness Companion + Local Search

在 VS Code 侧边栏中运行官方 DeepSeek Harness，并可通过本地 MCP 免费替代 DeepSeek Search / Fetch 接口。

> 社区集成，并非 DeepSeek 官方扩展。“免费”指不产生 DeepSeek Search / Fetch 接口调用费；DeepSeek 模型 Token 和网络流量仍按各自服务计费。

## 为什么需要本地搜索

DeepSeek Harness 在联网检索时可以调用 DeepSeek 官方 Search / Fetch。启用本扩展的本地搜索后，联网流程会改为：

```text
DeepSeek Harness
  -> 本机 Local Search MCP
  -> Bing RSS / DuckDuckGo / 自建 SearXNG
  -> 抓取公开网页正文
  -> DeepSeek 阅读并整理结果
```

这里的“本地搜索”不是只搜索电脑文件，也不是在电脑上重建搜索引擎，而是由本机 MCP 直接访问公开搜索源和网页，不再调用 DeepSeek Search / Fetch。

## 功能

- 在 VS Code 侧边栏内运行官方 DeepSeek Harness
- 可选的本地联网搜索与网页正文抓取
- Bing RSS 默认后端，无需 API Key
- DuckDuckGo 无 Key 搜索
- 支持用户自建 SearXNG
- 网页正文转换为适合模型阅读的 Markdown
- 拦截本机、内网和保留地址，逐次校验网页跳转
- 限制请求超时和最大下载体积
- 本地搜索仅影响由本扩展启动的 Harness，不修改 `~/.dsh`
- DeepSeek API Key 保存在 VS Code SecretStorage
- Harness 仅监听 `127.0.0.1` 的随机端口

## 快速开始

1. 打开 Activity Bar 中的 DeepSeek Harness 图标。
2. 执行 `DeepSeek Harness: Set DeepSeek API Key`。
3. 在 VS Code 设置中启用 `DeepSeek Harness > Local Search: Enabled`。
4. 启动或重启 Harness。

扩展优先使用系统中的 `dsh`。如果尚未安装，会在征得同意后通过 `npx` 下载官方 `@deepseek-ai/dsh`。

本地搜索默认使用 Bing RSS。也可以在设置中选择 DuckDuckGo，或填写自己的 SearXNG 地址。关闭 Local Search 开关即可恢复 Harness 官方默认行为。

## 环境要求

- VS Code 1.90 或更高版本
- 通过 `npx` 启动 Harness：Node.js `^22.19` 或 `>=24`
- 启用本地搜索：Node.js 24.5 或更高版本

## 命令

- `DeepSeek Harness: Start`
- `DeepSeek Harness: Stop`
- `DeepSeek Harness: Restart`
- `DeepSeek Harness: Open in Editor`
- `DeepSeek Harness: Set DeepSeek API Key`
- `DeepSeek Harness: Copy Selection as Context`
- `DeepSeek Harness: Show Logs`

## 安全与隐私

- API Key 不写入普通设置或日志。
- 启动 token 会在日志中脱敏。
- 不支持未受信任工作区，因为 Harness 可以编辑文件和执行命令。
- 搜索词和目标网页会发送给所选搜索源及网站；模型处理遵循用户配置的模型服务条款。

详见扩展包中的 `PRIVACY.md`、`SECURITY.md` 和 `SUPPORT.md`。

MIT License
