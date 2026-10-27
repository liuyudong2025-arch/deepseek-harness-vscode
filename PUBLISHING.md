# Publishing

1. Create a Publisher at <https://marketplace.visualstudio.com/manage/publishers/>.
2. Replace `local` in `package.json` with your Publisher ID.
3. Add your contact details to `SECURITY.md` and `SUPPORT.md`.
4. Run:

```powershell
npm run check
npm run publish:check
npm run package
```

Upload the VSIX in Marketplace Publisher Management, or authenticate `vsce` and run `npm run publish`.

Never commit a publishing token.
