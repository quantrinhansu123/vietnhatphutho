import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npx vite --port 5173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120000
  },
  reporter: [['list']],
  outputDir: 'test-results/artifacts',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
