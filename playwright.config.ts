import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', workers: 1, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4174', headless: true, trace: 'retain-on-failure' },
  webServer: { command: 'node tests/start-server.mjs', url: 'http://127.0.0.1:4174/api/health', reuseExistingServer: false },
});
