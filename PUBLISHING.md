# Publishing

Publisher: `matrix-oai-compatible-copilot-provider`

## Preflight

```powershell
npm ci
npm run check
npm run publish:check
npm run package
```

Install and smoke-test the generated VSIX before publishing:

```powershell
code --install-extension .\matrix-deepseek-harness-companion-0.5.1.vsix --force
```

Verify both launch modes:

1. Local Search disabled: Harness starts with its normal provider configuration.
2. Local Search enabled: logs show the generated invocation overlay and Harness exposes `mcp__localWeb__web_search` and `mcp__localWeb__web_fetch`.

## Publish

Either upload the VSIX in [Marketplace Publisher Management](https://marketplace.visualstudio.com/manage/publishers/), or authenticate `vsce` and run:

```powershell
npm run publish
```

Never save or commit a Marketplace Personal Access Token. The token needs Marketplace **Manage** scope for this publisher.
