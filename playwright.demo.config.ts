import { defineConfig, devices } from "@playwright/test";

// Demo-mode run: the app is served with NEXT_PUBLIC_DEMO_MODE=true (no Supabase),
// and each spec seeds its own fixture data into localStorage. Use for the
// customer-portal screens when the database is unavailable:
//   npx playwright test -c playwright.demo.config.ts
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.demo.spec.ts",
  testIgnore: "**/ola-map.demo.spec.ts", // needs the Ola stand-in service: run with playwright.ola.config.ts
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: { baseURL: "http://localhost:5174", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npx vite --port 5174",
    env: { NEXT_PUBLIC_DEMO_MODE: "true" },
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
