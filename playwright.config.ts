import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4175",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    env: {
      DB_URL:
        process.env.TEST_DB_URL ??
        "postgresql://test:test@127.0.0.1:1/browser_test",
      TELEGRAM_OAUTH_CLIENT_ID: "",
      TELEGRAM_OAUTH_CLIENT_SECRET: "",
    },
    command:
      "TT_STATS_FAKE_DATA=true RATE_LIMIT_READ_COUNT=100000 RATE_LIMIT_READ_BURST=100000 RATE_LIMIT_LOGIN_COUNT=100000 RATE_LIMIT_LOGIN_BURST=100000 ADMIN_TELEGRAM_ID=123456789 bun scripts/browser-server.mjs",
    url: "http://127.0.0.1:4175/dashboard/",
    reuseExistingServer: false,
  },
})
