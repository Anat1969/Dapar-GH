import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: process.env.CHROME_PATH || process.env.CI ? {} : { executablePath: '/opt/pw-browsers/chromium' },
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm run preview', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 60000 },
})
