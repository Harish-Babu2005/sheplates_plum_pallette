import { test, expect, type Browser } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { dismissTourIfOpen, loginAsCustomer, loginAsStaff, openStaffNavIfCollapsed } from "./helpers";

// Live campaigns across real accounts: the Super Admin sets a campaign live in the browser and the
// customer sees it on the Marketplace; pausing takes it down. Needs supabase/V9_2_LIVE_CAMPAIGNS.sql.
// Campaigns created here are named "E2E <tag>" and are removed at the end.

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const tag = Date.now().toString(36);
const NAME = `E2E ${tag}`;
const HEADLINE = `E2E offer ${tag}`;

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);
test.afterAll(async () => { await admin().from("marketing_campaigns").delete().like("name", `E2E ${tag}%`); });

async function adminPage(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  await loginAsStaff(page, "admin"); await dismissTourIfOpen(page); await openStaffNavIfCollapsed(page);
  await page.getByRole("button", { name: "Homepage & campaigns" }).click();
  await expect(page.getByTestId("campaign-manager")).toBeVisible({ timeout: 20_000 });
  return page;
}
async function customerPage(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  await loginAsCustomer(page); await dismissTourIfOpen(page);
  return page;
}
const tap = async (loc: import("@playwright/test").Locator) => { await loc.evaluate((el) => el.scrollIntoView({ block: "center" })); await loc.click(); };

test("1. the Super Admin creates a campaign and sets it live", async ({ browser }) => {
  const page = await adminPage(browser);
  await page.getByRole("button", { name: "New live campaign" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Campaign name", { exact: true }).fill(NAME);
  await dialog.getByLabel("Headline", { exact: true }).fill(HEADLINE);
  await dialog.getByLabel("Line under the headline", { exact: true }).fill("Set live from the browser");
  await dialog.getByLabel("Offer tag", { exact: true }).fill("Test offer");
  await dialog.getByLabel("Button goes to", { exact: true }).selectOption("category");
  await dialog.getByLabel("Target", { exact: true }).selectOption({ label: "Bakery & Desserts" });
  await dialog.getByRole("button", { name: "Save and go live" }).click();
  await expect(page.getByText("Campaign is live for matching customers")).toBeVisible({ timeout: 15_000 });
  const row = page.getByTestId("campaign-row").filter({ hasText: NAME });
  await expect(row.getByTestId("campaign-phase")).toHaveText("Live now");

  const saved = (await admin().from("marketing_campaigns").select("status,headline,target_type,target_value,segment").eq("name", NAME).single()).data!;
  expect(saved).toMatchObject({ status: "active", headline: HEADLINE, target_type: "category", target_value: "Bakery & Desserts", segment: "everyone" });
  await page.context().close();
});

test("2. the customer sees the live campaign, it counts the view, and the button filters the Marketplace", async ({ browser }) => {
  const page = await customerPage(browser);
  const banner = page.getByTestId("campaign-banner");
  await expect(banner).toBeVisible({ timeout: 20_000 });
  // other live campaigns may exist: rotate to ours through the dots if needed
  const ours = banner.locator(`[data-campaign-id]`).filter({ hasText: HEADLINE });
  if (!(await ours.count())) { const dots = banner.getByRole("tab"); for (let i = 0; i < (await dots.count()); i++) { await dots.nth(i).click(); if (await ours.count()) break; } }
  await expect(banner.getByTestId("campaign-headline")).toHaveText(HEADLINE);
  await expect(banner.getByText("Set live from the browser")).toBeVisible();

  await expect.poll(async () => (await admin().from("marketing_campaigns").select("view_count").eq("name", NAME).single()).data?.view_count, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
  await banner.getByTestId("campaign-cta").click();
  await expect.poll(async () => (await admin().from("marketing_campaigns").select("click_count").eq("name", NAME).single()).data?.click_count, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Bakery & Desserts", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.context().close();
});

test("3. the Super Admin sees the results and pauses it; the customer no longer sees it", async ({ browser }) => {
  const page = await adminPage(browser);
  const row = page.getByTestId("campaign-row").filter({ hasText: NAME });
  await expect(row.getByTestId("campaign-views")).not.toHaveText(/^0 views/, { timeout: 20_000 });
  await expect(row.getByTestId("campaign-clicks")).not.toContainText(/^0 taps/);
  await tap(row.getByRole("button", { name: "Pause", exact: true }));
  await expect(page.getByText(/Campaign paused/)).toBeVisible({ timeout: 15_000 });
  await expect(row.getByTestId("campaign-phase")).toHaveText("Paused");
  expect((await admin().from("marketing_campaigns").select("status").eq("name", NAME).single()).data?.status).toBe("paused");
  await page.context().close();

  const customer = await customerPage(browser);
  await expect(customer.getByText("Marketplace", { exact: false }).first()).toBeVisible();
  await expect(customer.getByText(HEADLINE)).toHaveCount(0);
  await customer.context().close();
});
