import { test, expect, type Page } from "@playwright/test";
import { buildDemoState, DEMO_CUSTOMER } from "./fixtures/demo-state";
import { openStaffNavIfCollapsed } from "./helpers";

// Live campaigns in demo mode (no database): the Super Admin creates a campaign, and it reaches the
// customer's Marketplace only while it is live and inside its audience and dates.
// Run with: npx playwright test -c playwright.demo.config.ts

const ADMIN = { email: "admin@sheplates.demo", name: "Super Admin", role: "admin", toursCompleted: [] };
const CUSTOMER = { email: DEMO_CUSTOMER.email, name: DEMO_CUSTOMER.name, role: "customer", toursCompleted: ["customer_v1"] };
const NEW_CUSTOMER = { email: "brand-new@sheplates.demo", name: "Nila", role: "customer", toursCompleted: ["customer_v1"] };

async function open(page: Page, session: unknown, extraState?: (state: ReturnType<typeof buildDemoState>) => void) {
  const state = buildDemoState();
  extraState?.(state);
  await page.addInitScript(([s, u]) => {
    if (!sessionStorage.getItem("seeded")) { localStorage.clear(); localStorage.setItem("sheplates-v3-state", JSON.stringify(s)); localStorage.setItem("sheplates-v3-session", JSON.stringify(u)); sessionStorage.setItem("seeded", "1"); }
  }, [state, session] as const);
  await page.goto("/");
}
/** Same browser, same local data, different person (the demo keeps one shared data blob). */
async function switchTo(page: Page, session: unknown) {
  await page.evaluate((u) => localStorage.setItem("sheplates-v3-session", JSON.stringify(u)), session);
  await page.reload();
}
async function openCampaigns(page: Page) {
  await expect(page.locator(".k-main h1").first()).toBeVisible({ timeout: 15_000 });
  await openStaffNavIfCollapsed(page);
  await page.getByRole("button", { name: "Homepage & campaigns" }).click();
  await expect(page.getByTestId("campaign-manager")).toBeVisible();
}
const inDays = (d: number, hour = 9) => { const t = new Date(Date.now() + d * 86_400_000); t.setHours(hour, 0, 0, 0); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}`; };

async function createCampaign(page: Page, o: { name: string; headline: string; subline?: string; offer?: string; target?: [string, string]; segment?: string; starts?: string; ends?: string; priority?: string; goLive?: boolean }) {
  await page.getByRole("button", { name: "New live campaign" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Campaign name", { exact: true }).fill(o.name);
  await dialog.getByLabel("Headline", { exact: true }).fill(o.headline);
  if (o.subline) await dialog.getByLabel("Line under the headline", { exact: true }).fill(o.subline);
  if (o.offer) await dialog.getByLabel("Offer tag", { exact: true }).fill(o.offer);
  if (o.target) { await dialog.getByLabel("Button goes to", { exact: true }).selectOption(o.target[0]); await dialog.getByLabel("Target", { exact: true }).selectOption({ label: o.target[1] }); }
  if (o.segment) await dialog.getByLabel("Show to", { exact: true }).selectOption(o.segment);
  if (o.starts) await dialog.getByLabel("Starts", { exact: true }).fill(o.starts);
  if (o.ends) await dialog.getByLabel("Ends", { exact: true }).fill(o.ends);
  if (o.priority) await dialog.getByLabel("Priority", { exact: true }).fill(o.priority);
  await dialog.getByRole("button", { name: o.goLive === false ? "Save draft" : "Save and go live" }).click();
}
/** The floating She Agent launcher sits over the bottom-right corner; bring the control to mid-screen before pressing it. */
async function tap(locator: ReturnType<Page["locator"]>) { await locator.evaluate((el) => el.scrollIntoView({ block: "center" })); await locator.click(); }
const rowOf = (page: Page, name: string) => page.getByTestId("campaign-row").filter({ hasText: name });

test.describe("Live campaigns (demo data)", () => {
  test("the Super Admin sets a campaign live and the customer sees it with a working button", async ({ page }) => {
    await open(page, ADMIN);
    await openCampaigns(page);
    await expect(page.getByTestId("live-count")).toHaveText("0 live now");

    await createCampaign(page, { name: "Meat week", headline: "Fresh meat, cut to order", subline: "From butchers within 5 km", offer: "10% off above 500", target: ["category", "Meat & Seafood"] });
    await expect(page.getByText("Campaign is live for matching customers")).toBeVisible();
    const row = rowOf(page, "Meat week");
    await expect(row.getByTestId("campaign-phase")).toHaveText("Live now");
    await expect(page.getByTestId("live-count")).toHaveText("1 live now");

    await switchTo(page, CUSTOMER);
    const banner = page.getByTestId("campaign-banner");
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner.getByTestId("campaign-headline")).toHaveText("Fresh meat, cut to order");
    await expect(banner.getByText("From butchers within 5 km")).toBeVisible();
    await expect(banner.getByText("10% off above 500")).toBeVisible();
    await expect(page.getByText("Tonight 8 PM to midnight")).toHaveCount(0); // the standing promo steps aside

    await banner.getByTestId("campaign-cta").click();
    const grid = page.locator('[data-tour="products"]');
    await expect(grid.getByRole("heading", { name: "Chicken Curry Cut" })).toBeVisible();
    await expect(grid.getByRole("heading", { name: "Mini Meals" })).toHaveCount(0);
  });

  test("no live campaign means the customer sees the standing promo; pausing takes a live one down", async ({ page }) => {
    await open(page, CUSTOMER);
    await expect(page.getByText("Tonight 8 PM to midnight")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("campaign-banner")).toHaveCount(0);

    await switchTo(page, ADMIN);
    await openCampaigns(page);
    await createCampaign(page, { name: "Pause me", headline: "Limited time" });
    await expect(rowOf(page, "Pause me").getByTestId("campaign-phase")).toHaveText("Live now");
    await switchTo(page, CUSTOMER);
    await expect(page.getByTestId("campaign-headline")).toHaveText("Limited time");

    await switchTo(page, ADMIN);
    await openCampaigns(page);
    await tap(rowOf(page, "Pause me").getByRole("button", { name: "Pause", exact: true }));
    await expect(page.getByText(/Campaign paused/)).toBeVisible();
    await expect(rowOf(page, "Pause me").getByTestId("campaign-phase")).toHaveText("Paused");
    await switchTo(page, CUSTOMER);
    await expect(page.getByText("Tonight 8 PM to midnight")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("campaign-banner")).toHaveCount(0);
  });

  test("a draft never reaches customers, and Go live asks for confirmation first", async ({ page }) => {
    await open(page, ADMIN);
    await openCampaigns(page);
    await createCampaign(page, { name: "Still a draft", headline: "Not yet", goLive: false });
    const row = rowOf(page, "Still a draft");
    await expect(row.getByTestId("campaign-phase")).toHaveText("Draft");
    await switchTo(page, CUSTOMER);
    await expect(page.getByText("Tonight 8 PM to midnight")).toBeVisible({ timeout: 15_000 });

    await switchTo(page, ADMIN);
    await openCampaigns(page);
    await tap(rowOf(page, "Still a draft").getByRole("button", { name: "Go live" }));
    await expect(rowOf(page, "Still a draft").getByTestId("campaign-phase")).toHaveText("Draft"); // not yet: it asked first
    await tap(rowOf(page, "Still a draft").getByRole("button", { name: /Confirm: customers will see this now/ }));
    await expect(rowOf(page, "Still a draft").getByTestId("campaign-phase")).toHaveText("Live now");
  });

  test("dates: a future start is Scheduled and hidden, a campaign cannot go live with an end in the past", async ({ page }) => {
    await open(page, ADMIN);
    await openCampaigns(page);
    await createCampaign(page, { name: "Starts later", headline: "Coming soon", starts: inDays(2) });
    await expect(rowOf(page, "Starts later").getByTestId("campaign-phase")).toHaveText("Scheduled");
    await switchTo(page, CUSTOMER);
    await expect(page.getByText("Tonight 8 PM to midnight")).toBeVisible({ timeout: 15_000 });

    await switchTo(page, ADMIN);
    await openCampaigns(page);
    await createCampaign(page, { name: "Already over", headline: "Too late", ends: inDays(-1) });
    await expect(page.getByText("The end date has already passed")).toBeVisible();
    await expect(page.getByTestId("campaign-row").filter({ hasText: "Already over" })).toHaveCount(0);
    await page.getByRole("dialog").getByLabel("Ends", { exact: true }).fill(inDays(1));
    await page.getByRole("dialog").getByLabel("Starts", { exact: true }).fill(inDays(2));
    await page.getByRole("dialog").getByRole("button", { name: "Save and go live" }).click();
    await expect(page.getByText("The end must be after the start")).toBeVisible();
  });

  test("audience: new-customer and returning-customer campaigns reach only the right people", async ({ page }) => {
    await open(page, ADMIN);
    await openCampaigns(page);
    await createCampaign(page, { name: "Welcome", headline: "Welcome offer for new customers", segment: "new_customers" });
    await createCampaign(page, { name: "Come back", headline: "Welcome back, here is a treat", segment: "returning_customers" });
    await expect(page.getByTestId("live-count")).toHaveText("2 live now");

    // the demo customer has past orders: returning only
    await switchTo(page, CUSTOMER);
    await expect(page.getByTestId("campaign-headline")).toHaveText("Welcome back, here is a treat", { timeout: 15_000 });
    await expect(page.getByRole("tab", { name: /Campaign \d of \d/ })).toHaveCount(0); // only one slide, so no dots

    // a customer with no orders: new only (needs a profile in the demo data)
    await page.evaluate(([u, c]) => {
      const raw = JSON.parse(localStorage.getItem("sheplates-v3-state") || "{}");
      raw.customers = [...(raw.customers || []), { ...(raw.customers || [])[0], email: c }];
      localStorage.setItem("sheplates-v3-state", JSON.stringify(raw)); localStorage.setItem("sheplates-v3-session", JSON.stringify(u));
    }, [NEW_CUSTOMER, NEW_CUSTOMER.email] as const);
    await page.reload();
    await expect(page.getByTestId("campaign-headline")).toHaveText("Welcome offer for new customers", { timeout: 15_000 });
  });

  test("several live campaigns rotate, highest priority first, with dots to choose one", async ({ page }) => {
    await open(page, ADMIN);
    await openCampaigns(page);
    await createCampaign(page, { name: "Low", headline: "Low priority offer", priority: "0" });
    await createCampaign(page, { name: "High", headline: "High priority offer", priority: "9" });
    await switchTo(page, CUSTOMER);
    const banner = page.getByTestId("campaign-banner");
    await expect(banner.getByTestId("campaign-headline")).toHaveText("High priority offer", { timeout: 15_000 });
    const dots = banner.getByRole("tab");
    await expect(dots).toHaveCount(2);
    await dots.nth(1).click();
    await expect(banner.getByTestId("campaign-headline")).toHaveText("Low priority offer");
  });

  test("the editor previews the banner, validates, edits and deletes", async ({ page }) => {
    await open(page, ADMIN);
    await openCampaigns(page);
    await page.getByRole("button", { name: "New live campaign" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Write a headline to see the banner")).toBeVisible();
    await dialog.getByLabel("Campaign name", { exact: true }).fill("Preview check");
    await dialog.getByLabel("Headline", { exact: true }).fill("Live preview works");
    await expect(dialog.getByTestId("campaign-headline")).toHaveText("Live preview works");
    await dialog.getByLabel("Button goes to", { exact: true }).selectOption("category");
    await dialog.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Choose the category the button opens")).toBeVisible();
    await dialog.getByLabel("Button goes to", { exact: true }).selectOption("none");
    await dialog.getByRole("button", { name: "Save draft" }).click();
    await expect(rowOf(page, "Preview check")).toBeVisible();

    await tap(rowOf(page, "Preview check").getByRole("button", { name: "Edit" }));
    await page.getByRole("dialog").getByLabel("Headline", { exact: true }).fill("Edited headline");
    await page.getByRole("dialog").getByRole("button", { name: "Save draft" }).click();
    await expect(rowOf(page, "Preview check")).toContainText("Edited headline");

    await tap(rowOf(page, "Preview check").getByRole("button", { name: /Delete Preview check/ }));
    await tap(rowOf(page, "Preview check").getByRole("button", { name: "Confirm delete" }));
    await expect(rowOf(page, "Preview check")).toHaveCount(0);
  });
});
