# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pages.spec.ts >> mọi trang của web GCS v2 >> đi qua 10 tab: không lỗi trang, chỉ MỘT WebSocket suốt phiên
- Location: tests\e2e\pages.spec.ts:34:3

# Error details

```
Error: browserType.launch: Executable doesn't exist at C:\Users\Nghaiz\AppData\Local\ms-playwright\chromium_headless_shell-1248\chrome-headless-shell-win64\chrome-headless-shell.exe
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║                                                            ║
║     npx playwright install                                 ║
║                                                            ║
║ <3 Playwright Team                                         ║
╚════════════════════════════════════════════════════════════╝
```