import { defineConfig, devices } from '@playwright/test';

const localTestUrl = 'http://127.0.0.1:4175';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || localTestUrl;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 0,
  workers: 4,
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure', reducedMotion: 'reduce' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
    url: localTestUrl,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
