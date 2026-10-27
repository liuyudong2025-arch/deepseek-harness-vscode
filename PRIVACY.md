# Privacy

This extension has no analytics or telemetry service.

The API key is stored in VS Code SecretStorage and passed to the local Harness process. Conversation content, files, model requests, MCP traffic, and plugin traffic are handled by DeepSeek Harness and the providers configured by the user.

The extension downloads `@deepseek-ai/dsh` from npm only after explicit user approval.
