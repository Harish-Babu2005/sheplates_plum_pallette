// One-off script (not part of the test suite) to capture a representative
// set of screenshots for the final delivery package. Run with:
//   node scripts/capture-qa-screenshots.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const OUT = "qa-screenshots";
fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:5173";

async function loginCustomer(page) {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE);
  await page.getByRole("button", { name: /Customer login|^Sign in$/ }).click();
  await page.getByLabel("Email").fill("customer@sheplates.demo");
  await page.getByLabel("Password").fill("Customer@123");
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(2500);
  const skip = page.getByRole("button", { name: "Skip" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.waitForTimeout(500);
}

async function loginStaff(page, email, password) {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE);
  await page.getByRole("button", { name: /Vendor/ }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(2500);
  const skip = page.getByRole("button", { name: "Skip" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.waitForTimeout(500);
}

const browser = await chromium.launch();

// Desktop pass
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/01-desktop-landing.png` });

  await loginCustomer(page);
  await page.screenshot({ path: `${OUT}/02-desktop-marketplace.png` });

  await page.getByRole("button", { name: "Cart" }).click().catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/03-desktop-cart.png` });

  await page.locator('[data-tour="agent-desktop"]').click().catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/04-desktop-she-agent.png` });

  await loginStaff(page, "vendor@sheplates.demo", "Vendor@123");
  await page.screenshot({ path: `${OUT}/05-desktop-vendor-dashboard.png` });

  await loginStaff(page, "operations@sheplates.demo", "Operations@123");
  await page.screenshot({ path: `${OUT}/06-desktop-operations-command-centre.png` });

  await loginStaff(page, "admin@sheplates.demo", "Admin@123");
  await page.screenshot({ path: `${OUT}/07-desktop-admin-executive-view.png` });

  await page.getByRole("button", { name: "Homepage & campaigns" }).click().catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/08-desktop-admin-homepage-campaigns.png` });

  await page.close();
}

// Mobile pass (iPhone-ish)
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/09-mobile-landing.png` });

  await loginCustomer(page);
  await page.screenshot({ path: `${OUT}/10-mobile-marketplace.png` });

  const account = page.locator('[data-tour="account-mobile"]');
  if (await account.isVisible().catch(() => false)) {
    await account.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/11-mobile-account-sheet.png` });
  }

  await page.close();
}

await browser.close();
console.log("Screenshots written to", OUT);
