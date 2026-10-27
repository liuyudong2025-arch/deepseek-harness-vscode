# Changelog

## 0.5.1

- Added an optional bundled local web-search MCP for Companion-launched Harness sessions.
- Added keyless Bing RSS and DuckDuckGo backends plus self-hosted SearXNG.
- Added an invocation-scoped overlay that disables the paid DeepSeek search provider while local search is enabled.
- Added local public-page fetching with SSRF checks, redirect validation, timeouts, and size limits.

## 0.4.8

- Change the Marketplace extension name to the unique ID `matrix-deepseek-harness-companion`.

## 0.4.7

- Set the Marketplace Publisher ID to `matrix-oai-compatible-copilot-provider` for publication.

## 0.4.6

- Fix automatic Workspace creation using the official `/api/workspace/create` and `/api/session/create` routes.
- Send Typert RPC arguments in the required `payload.args.request` envelope.
- Verified end to end that both the Workspace path and Session working directory match the active VS Code folder.

## 0.4.5

- Use a separate official Harness home for each VS Code workspace.
- Let Harness initialize its default Workspace from the process working directory instead of calling its private WebSocket RPC protocol.

## 0.4.4

- Accept the official Harness HTTP 303 authentication redirect so automatic workspace binding can complete.
- Log the exact VS Code workspace folder selected at launch.

## 0.4.3

- Force the embedded Harness UI to restore the Session created for the active VS Code workspace.
- Load the VS Code bridge before the official frontend starts, preventing restoration of an older default-workspace Session.

## 0.4.2

- Removed the VS Code extension-details Preview badge.

## 0.4.1

- Hides the upstream Preview badge in the embedded UI by default, with a setting to restore it.

## 0.4.0

- Automatically registers and selects the active VS Code workspace in Harness.
- In multi-root workspaces, prefers the root containing the active editor.
- Authenticates and prepares the Workspace before loading the official UI.

## 0.3.0

- Added a loopback authentication proxy so the official Harness UI works inside VS Code webviews despite strict third-party cookie rules.
- Added a random secret URL prefix and in-memory cookie forwarding for HTTP and WebSocket traffic.

## 0.2.4

- Fixed timeout cleanup so the entire Windows npx process tree is stopped.

## 0.2.3

- Extended first-run npx startup timeout to five minutes for runtime download.

## 0.2.2

- Fixed automatic npx fallback when `dsh.cmd` is not installed on Windows.

## 0.2.1

- Fixed `spawn EINVAL` when launching Windows `.cmd` shims.

## 0.2.0

- Added Marketplace icon and branding.
- Added consent before npx runtime download.
- Redacted launch tokens from logs.
- Improved Windows process cleanup.
- Added publishing and security metadata.

## 0.1.0

- Initial preview.
