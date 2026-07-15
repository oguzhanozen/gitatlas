import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "pages-routes.spec.ts",
  webServer: { command: "node scripts/serve-static-export.mjs", url: "http://127.0.0.1:4173/gitatlas/", reuseExistingServer: false },
  use: { baseURL: "http://127.0.0.1:4173", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
