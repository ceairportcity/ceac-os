import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Browser and source-contract specs are Playwright; Node .test.mjs units run separately.
  testMatch: "**/*.spec.js",
  timeout: 30000,
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
});
