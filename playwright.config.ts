import { defineConfig, devices } from '@playwright/test';

// Demo data is built in this process: use the same zone as the browser.
process.env.TZ = 'Europe/Berlin';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173/HealthTracker/',
    ...devices['Pixel 7'],
    timezoneId: 'Europe/Berlin',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/HealthTracker/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
