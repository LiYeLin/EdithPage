import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '/private/tmp/edith-template-phase1-e2e',
  fullyParallel: true,
  workers: 3,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: { channel: 'chrome', baseURL: 'http://127.0.0.1:4179', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4179 --strictPort', url: 'http://127.0.0.1:4179', reuseExistingServer: false },
})
