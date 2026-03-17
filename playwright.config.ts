// playwright.config.ts (root of project)

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e", // All Playwright tests live here
  testMatch: ["**/*.e2e.ts", "**/*.spec.ts"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: process.env.HEADLESS !== "false",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Add more browsers if needed
  ],
});
