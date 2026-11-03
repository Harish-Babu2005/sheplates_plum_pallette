import { defineConfig, devices } from "@playwright/test";

// The map running on Ola Maps, against a local stand-in for the service (no real credentials):
//   npx playwright test -c playwright.ola.config.ts
export default defineConfig({
  globalTeardown: "./tests/e2e/ola-teardown.ts",
  testDir: "./tests/e2e",
  testMatch: ["**/ola-map.demo.spec.ts", "**/pin-map.demo.spec.ts", "**/food-shorts.demo.spec.ts", "**/people-status.demo.spec.ts"],
  fullyParallel: false, workers: 1, retries: 0, reporter: [["list"]], timeout: 40_000,
  use: { baseURL: "http://localhost:5175", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }, { name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: [
    { command: "node scripts/mock-ola-server.mjs 4599", url: "http://localhost:4599/__seen", reuseExistingServer: true, timeout: 20_000 },
    { command: "node scripts/run-ola-test-server.mjs 5175", url: "http://localhost:5175", reuseExistingServer: true, timeout: 60_000 },
  ],
});
