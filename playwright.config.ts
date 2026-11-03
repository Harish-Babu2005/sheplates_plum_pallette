import { defineConfig, devices } from "@playwright/test";

// A couple of specs reset DB state (e.g. tour completion) directly via the
// service-role key for deterministic setup — same env the app itself uses.
try { process.loadEnvFile(".env.local"); } catch { /* fine without it — those specs just no-op */ }

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "**/*.demo.spec.ts", // demo-mode specs run via playwright.demo.config.ts
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
