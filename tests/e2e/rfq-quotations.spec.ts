import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { DEMO, dismissTourIfOpen, openStaffNavIfCollapsed } from "./helpers";

// Live RFQ across real accounts: the customer publishes, only Package 3 vendors whose OWN radius
// covers the customer are invited, the invited vendor quotes, and the customer accepts.
// Needs supabase/V9_1_RFQ_LIVE.sql applied and the service-role key in .env.local.
// Throwaway vendors (named "E2E RFQ ...") and their data are removed at the end.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = () => createClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } });
const tag = Date.now().toString(36);
const RFQ_TITLE = `E2E monthly groceries ${tag}`;
const PASSWORD = "Zz-test-123456";
type Acct = { id: string; email: string; vendorId: string };
const accts = {} as Record<"crown" | "thrive" | "small", Acct>;
let customerId = "", rfqId = "";

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

async function newVendor(plan: "crown" | "thrive", name: string, lat: number, lng: number, radius: number): Promise<Acct> {
  const sb = admin();
  const email = `zz-e2e-rfq-${tag}-${name.replace(/\W+/g, "").toLowerCase()}@sheplates.test`;
  const u = await sb.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name, role: "vendor" } });
  if (u.error) throw u.error;
  await sb.from("profiles").upsert({ id: u.data.user.id, full_name: name, role: "vendor" }, { onConflict: "id" });
  const planRow = await sb.from("vendor_plans").select("id").eq("code", plan).single();
  const v = await sb.from("vendors").insert({ owner_id: u.data.user.id, name: `E2E RFQ ${name}`, category: "Groceries", locality: "Test", latitude: lat, longitude: lng, service_radius_km: radius, plan_id: planRow.data!.id, verification_status: "verified", operational_status: "active", marketplace_visible: true }).select("id").single();
  if (v.error) throw v.error;
  await sb.from("profiles").update({ vendor_id: v.data.id }).eq("id", u.data.user.id);
  return { id: u.data.user.id, email, vendorId: v.data.id };
}

test.beforeAll(async () => {
  const sb = admin();
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  customerId = users.data.users.find((x) => x.email === DEMO.customer.email)!.id;
  // the demo customer needs a delivery pin; keep theirs if it exists
  const pref = await sb.from("customer_preferences").select("latitude,longitude").eq("customer_id", customerId).maybeSingle();
  let lat = Number(pref.data?.latitude), lng = Number(pref.data?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) { lat = 11.0383; lng = 76.9781; await sb.from("customer_preferences").upsert({ customer_id: customerId, latitude: lat, longitude: lng, address: "RS Puram, Coimbatore", onboarding_complete: true }, { onConflict: "customer_id" }); }
  const north = (km: number) => lat + km / 111.32;
  accts.crown = await newVendor("crown", "Premium Ten", north(4), lng, 10);   // 4 km away, radius 10: invited
  accts.thrive = await newVendor("thrive", "Growth Ten", north(1), lng, 10);      // Package 2: not invited
  accts.small = await newVendor("crown", "Premium Three", north(4), lng, 3);    // Package 3 but radius 3: not invited
});

test.afterAll(async () => {
  const sb = admin();
  const reqs = rfqId ? [rfqId] : ((await sb.from("customer_requirements").select("id").eq("title", RFQ_TITLE)).data || []).map((r) => r.id);
  if (reqs.length) {
    const files = (await sb.from("customer_requirement_files").select("storage_path").in("requirement_id", reqs)).data || [];
    if (files.length) await sb.storage.from("customer-requirements").remove(files.map((file) => file.storage_path));
    const orders = ((await sb.from("orders").select("id").in("requirement_id", reqs)).data || []).map((o) => o.id);
    if (orders.length) { await sb.from("payments").delete().in("order_id", orders); await sb.from("orders").delete().in("id", orders); }
    await sb.from("customer_requirements").delete().in("id", reqs);
  }
  const ids = Object.values(accts).map((a) => a.id);
  if (ids.length) {
    await sb.from("notifications").delete().in("recipient_id", ids);
    await sb.from("profiles").update({ vendor_id: null }).in("id", ids);
    await sb.from("vendors").delete().in("id", Object.values(accts).map((a) => a.vendorId));
    for (const id of ids) await sb.auth.admin.deleteUser(id);
  }
  if (customerId) await sb.from("notifications").delete().eq("recipient_id", customerId).like("body", `%${RFQ_TITLE}%`);
});

async function signIn(browser: Browser, who: "customer" | Acct): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/"); await page.evaluate(() => localStorage.clear()); await page.goto("/");
  if (who === "customer") await page.getByRole("button", { name: /Customer login|^Sign in$/ }).click();
  else await page.getByRole("button", { name: /Vendor/ }).click();
  await page.getByLabel("Email").fill(who === "customer" ? DEMO.customer.email : who.email);
  await page.getByLabel("Password").fill(who === "customer" ? DEMO.customer.password : PASSWORD);
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await page.waitForSelector("text=Loading your ShePlates profile", { state: "hidden", timeout: 15_000 }).catch(() => undefined);
  await dismissTourIfOpen(page);
  return page;
}
async function customerOpens(page: Page, entry: "Monthly requirement" | "My quotations") {
  await page.locator('[data-tour="account"]:visible, [data-tour="account-mobile"]:visible').first().click();
  await page.getByRole("button", { name: entry, exact: true }).click();
}
async function vendorOpensQuotes(page: Page) {
  // On a phone the first-login tour may already have opened the drawer; only toggle it when the item is hidden.
  const target = page.getByRole("button", { name: "Quote opportunities" });
  if (!(await target.isVisible().catch(() => false))) await openStaffNavIfCollapsed(page);
  await target.click();
}

test("1. the customer publishes an RFQ and only the Package 3 vendor whose radius covers them is invited", async ({ browser }) => {
  const page = await signIn(browser, "customer");
  await customerOpens(page, "Monthly requirement");
  await page.getByLabel("Request title").fill(RFQ_TITLE);
  await page.getByLabel("Item 1").fill("Basmati rice");
  await page.getByRole("button", { name: "Publish RFQ" }).click();
  await expect(page.getByText(/RFQ sent to 1 Crown vendor near you/)).toBeVisible({ timeout: 20_000 });

  await customerOpens(page, "My quotations");
  const card = page.getByTestId("rfq-card").filter({ hasText: RFQ_TITLE });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByTestId("rfq-invited")).toHaveText("1");
  await expect(card.getByTestId("rfq-quoted")).toHaveText("0");
  await card.getByLabel(`Upload documents for ${RFQ_TITLE}`).setInputFiles({
    name: "product-spec.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Preferred packaging details"),
  });
  await expect(card.getByRole("link", { name: "product-spec.txt" })).toBeVisible({ timeout: 15_000 });
  const row = (await admin().from("customer_requirements").select("id,invited_count,status").eq("title", RFQ_TITLE).single()).data!;
  rfqId = row.id;
  expect(row.status).toBe("quoting");
  const document = (await admin().from("customer_requirement_files").select("file_name,storage_path").eq("requirement_id", rfqId).single()).data!;
  expect(document.file_name).toBe("product-spec.txt");
  const invited = ((await admin().from("rfq_vendor_invitations").select("vendor_id").eq("requirement_id", rfqId)).data || []).map((x) => x.vendor_id);
  expect(invited).toEqual([accts.crown.vendorId]);
  await page.context().close();
});

test("2. a Package 2 vendor sees the Package 3 lock and no RFQs", async ({ browser }) => {
  const page = await signIn(browser, accts.thrive);
  await vendorOpensQuotes(page);
  await expect(page.getByRole("heading", { name: "Quotations are available on the Crown plan" })).toBeVisible();
  await expect(page.getByTestId("vendor-rfq")).toHaveCount(0);
  await page.context().close();
});

test("3. a Package 3 vendor whose radius is too small is not shown the RFQ", async ({ browser }) => {
  const page = await signIn(browser, accts.small);
  await vendorOpensQuotes(page);
  await expect(page.getByRole("heading", { name: "No RFQs for your store yet" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("vendor-rfq")).toHaveCount(0);
  await page.context().close();
});

test("4. the invited Package 3 vendor sees the RFQ and sends a quotation", async ({ browser }) => {
  const page = await signIn(browser, accts.crown);
  await vendorOpensQuotes(page);
  const card = page.getByTestId("vendor-rfq").filter({ hasText: RFQ_TITLE });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText("Basmati rice").first()).toBeVisible();
  await expect(card.getByRole("button", { name: "Send quotation" })).toBeDisabled(); // no price yet
  await card.getByLabel("Price for Basmati rice").fill("84.5");
  await card.getByLabel("Delivery fee").fill("100");
  await expect(card.getByTestId("quote-items-total")).toContainText("84.50");
  await card.getByRole("button", { name: "Send quotation" }).click();
  await expect(page.getByText("Quotation sent to the customer")).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText("Quotation sent", { exact: true })).toBeVisible();
  await page.context().close();
});

test("5. the customer sees the quotation, accepts it, and an order is created", async ({ browser }) => {
  const page = await signIn(browser, "customer");
  await customerOpens(page, "My quotations");
  const card = page.getByTestId("rfq-card").filter({ hasText: RFQ_TITLE });
  await expect(card.getByTestId("rfq-quoted")).toHaveText("1", { timeout: 15_000 });
  const quote = card.getByTestId("quote-card");
  await expect(quote).toContainText("E2E RFQ Premium Ten");
  await expect(quote.getByTestId("quote-total")).toContainText("184.50"); // 84.50 x 1 + 100 delivery
  await quote.getByRole("button", { name: "Accept quotation" }).click();
  await quote.getByRole("button", { name: "Yes, create the order" }).click();
  await expect(page.getByText(/Quotation accepted\. Order RFQ-/)).toBeVisible({ timeout: 15_000 });
  await expect(card.getByTestId("rfq-order")).toContainText("payment pending");
  await expect(card.getByText("Awarded", { exact: true })).toBeVisible();

  const order = (await admin().from("orders").select("order_number,status,customer_total,vendor_id,requirement_id").eq("requirement_id", rfqId).single()).data!;
  expect(order.status).toBe("awarded");
  expect(Number(order.customer_total)).toBe(184.5);
  expect(order.vendor_id).toBe(accts.crown.vendorId);
  await page.context().close();
});

test("6. the winning vendor sees that they won", async ({ browser }) => {
  const page = await signIn(browser, accts.crown);
  await vendorOpensQuotes(page);
  const card = page.getByTestId("vendor-rfq").filter({ hasText: RFQ_TITLE });
  await expect(card.getByText("You won")).toBeVisible({ timeout: 15_000 });
  await page.context().close();
});
