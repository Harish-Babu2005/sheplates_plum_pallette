import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dismissTourIfOpen, loginAsCustomer } from "./helpers";

// People and statuses against the real database, through the browser. Needs V9_3_PEOPLE_STATUS.sql.
// A throwaway neighbour ("bea") is created with a status and is removed at the end, together with the
// temporary delivery pin given to the demo customer if it had none.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, svc, opts);
const tag = "zz-e2e-" + Date.now().toString(36);
const PIN = { lat: 11.0383247, lng: 76.9780717 };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const north = (km: number) => ({ lat: PIN.lat + km / 111.32, lng: PIN.lng });

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

let bea: { id: string; handle: string; client: SupabaseClient };
let demoId = "", addedAddress = "";
const files: string[] = [];

test.beforeAll(async () => {
  const email = `${tag}-bea@sheplates.test`, password = "Zz-test-123456";
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Bea", role: "customer" } });
  if (u.error) throw u.error;
  await admin.from("profiles").upsert({ id: u.data.user.id, full_name: "Bea", role: "customer" }, { onConflict: "id" });
  const client = createClient(url, anon, opts); await client.auth.signInWithPassword({ email, password });
  await client.rpc("ensure_social_profile", { p_handle: null });
  const handle = (await admin.from("social_profiles").select("handle").eq("user_id", u.data.user.id).single()).data!.handle as string;
  bea = { id: u.data.user.id, handle, client };
  expect((await client.rpc("set_discoverable", { p_on: true, p_lat: north(1.5).lat, p_lng: north(1.5).lng })).error).toBeNull();
  expect((await client.rpc("post_status", { p_kind: "photo", p_media_url: "https://example.com/bea.jpg", p_thumb_url: null, p_caption: `Bea lunch ${tag}`, p_vendor_id: null, p_duration_s: null })).error).toBeNull();

  const list = (await admin.auth.admin.listUsers({ perPage: 200 })).data.users;
  demoId = list.find((x) => x.email === "customer@sheplates.demo")!.id;
  await admin.from("customer_follows").delete().eq("follower_id", demoId);
  await admin.from("social_profiles").update({ discoverable: false, map_lat: null, map_lng: null }).eq("user_id", demoId);
  const have = await admin.from("customer_addresses").select("id").eq("customer_id", demoId).limit(1);
  if (!have.data?.length) {
    const ins = await admin.from("customer_addresses").insert({ customer_id: demoId, label: "Home", address: "RS Puram, Coimbatore", latitude: PIN.lat, longitude: PIN.lng, is_default: true }).select("id").single();
    addedAddress = ins.data!.id;
  }
});
test.afterAll(async () => {
  if (files.length) await admin.storage.from("status-media").remove(files);
  await admin.from("customer_statuses").delete().eq("author_id", demoId).eq("caption", `Mine ${tag}`);
  await admin.from("customer_follows").delete().eq("follower_id", demoId);
  await admin.from("social_profiles").update({ discoverable: false, map_lat: null, map_lng: null }).eq("user_id", demoId);
  if (addedAddress) await admin.from("customer_addresses").delete().eq("id", addedAddress);
  if (bea?.id) await admin.auth.admin.deleteUser(bea.id);
});

const tab = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
async function open(page: Page) {
  await loginAsCustomer(page); await dismissTourIfOpen(page);
  await expect(tab(page, "Stories")).toBeVisible({ timeout: 20_000 });
}

test("1. a neighbour on the map shows in the rail; watching it once removes it, for good", async ({ page }) => {
  await open(page);
  await tab(page, "Stories").click();
  const ring = page.getByRole("button", { name: new RegExp(`^${bea.handle}'s status`) });
  await expect(ring).toBeVisible({ timeout: 20_000 });
  await expect(ring).toHaveAttribute("data-source", "nearby");
  await ring.click();
  const viewer = page.getByRole("dialog", { name: `${bea.handle}'s status` });
  await expect(viewer.getByTestId("status-caption")).toHaveText(`Bea lunch ${tag}`);
  await viewer.getByRole("button", { name: "Like" }).click();
  await expect(viewer.getByRole("button", { name: "Unlike" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(ring).toHaveCount(0);
  // the database records the view (view-once is decided there, not in the browser)
  await expect.poll(async () => (await admin.from("status_views").select("viewer_id").eq("viewer_id", demoId)).data?.length, { timeout: 15_000 }).toBeGreaterThan(0);
  await page.evaluate(() => localStorage.removeItem("sheplates-status-seen-v1"));   // prove the server alone hides it after a reload
  await page.reload();
  await dismissTourIfOpen(page);
  await tab(page, "Stories").click();
  await expect(page.getByTestId("status-rail")).toBeVisible();
  await expect(ring).toHaveCount(0);
  const seen = await admin.from("status_views").select("viewer_id").eq("viewer_id", demoId);
  expect(seen.data?.length).toBeGreaterThan(0);
  const likes = await admin.from("status_likes").select("user_id").eq("user_id", demoId);
  expect(likes.data?.length).toBe(1);
});

test("2. find a neighbour by handle, follow, and see them in the counts and the lists", async ({ page }) => {
  await open(page);
  await tab(page, "Stories").click();
  await page.getByRole("button", { name: "Find people" }).click();
  const dialog = page.getByRole("dialog", { name: "Find people" });
  await dialog.getByLabel("Search people").fill(bea.handle.slice(0, 5));
  const row = dialog.getByTestId("person-row").filter({ has: page.locator(`[data-handle="${bea.handle}"]`) }).or(dialog.locator(`[data-testid="person-row"][data-handle="${bea.handle}"]`)).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: `Follow @${bea.handle}` }).click();
  await expect(row.getByRole("button", { name: `Unfollow @${bea.handle}` })).toBeVisible();
  await expect.poll(async () => (await admin.from("customer_follows").select("followee_id").eq("follower_id", demoId)).data?.map((r) => r.followee_id), { timeout: 15_000 }).toEqual([bea.id]);

  await dialog.getByRole("tab", { name: "People nearby" }).click();
  await dialog.getByRole("tab", { name: "3 km", exact: true }).click();
  await expect(dialog.locator(`[data-testid="person-row"][data-handle="${bea.handle}"]`)).toBeVisible({ timeout: 15_000 });
  await dialog.getByRole("tab", { name: "1 km", exact: true }).click();
  await expect(dialog.locator(`[data-testid="person-row"][data-handle="${bea.handle}"]`)).toHaveCount(0);
  await page.keyboard.press("Escape");

  await tab(page, "Profile").click();
  await expect(page.getByRole("button", { name: "Following 1" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Following 1" }).click();
  await expect(page.getByRole("dialog", { name: "Following" }).locator(`[data-handle="${bea.handle}"]`)).toBeVisible();
  await page.getByRole("dialog", { name: "Following" }).getByRole("button", { name: `Unfollow @${bea.handle}` }).click();
  await expect.poll(async () => (await admin.from("customer_follows").select("followee_id").eq("follower_id", demoId)).data?.length).toBe(0);
});

test("3. the Maps People view shows Bea, the profile switch stores only a coarse position, and posting a status works", async ({ page }) => {
  await open(page);
  await tab(page, "Maps").click();
  await expect(page.locator(".sp-vendor-map")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tab", { name: "People", exact: true }).click();
  await expect(page.locator(".sp-map-person-pin")).toHaveCount(1, { timeout: 15_000 });
  await page.getByRole("tab", { name: "1 km", exact: true }).click();
  await expect(page.locator(".sp-map-person-pin")).toHaveCount(0);

  await tab(page, "Profile").click();
  const toggle = page.getByRole("switch", { name: "Show me on the map" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  const row = (await admin.from("social_profiles").select("discoverable,map_lat,map_lng").eq("user_id", demoId).single()).data!;
  expect(row.discoverable).toBe(true);
  expect(Math.abs(Math.round(Number(row.map_lat) / 0.005) * 0.005 - Number(row.map_lat))).toBeLessThan(1e-6);
  await page.reload(); await dismissTourIfOpen(page);
  await tab(page, "Profile").click();
  await expect(page.getByRole("switch", { name: "Show me on the map" })).toHaveAttribute("aria-checked", "true");

  // post a status
  await tab(page, "Stories").click();
  await page.getByRole("button", { name: "Add status", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Choose a photo").setInputFiles({ name: "thali.png", mimeType: "image/png", buffer: PNG });
  await dialog.getByLabel("Status caption").fill(`Mine ${tag}`);
  await dialog.getByRole("button", { name: "Post status" }).click();
  await expect(page.getByText(/Status posted/)).toBeVisible({ timeout: 20_000 });
  const mine = (await admin.from("customer_statuses").select("id,media_url,expires_at,created_at").eq("author_id", demoId).eq("caption", `Mine ${tag}`).single()).data!;
  const path = decodeURIComponent(mine.media_url.split("/status-media/")[1]); files.push(path);
  expect(Math.abs((new Date(mine.expires_at).getTime() - new Date(mine.created_at).getTime()) / 3_600_000 - 24)).toBeLessThan(0.01);
  const file = await fetch(mine.media_url); expect(file.ok).toBe(true);

  // Bea (who follows nobody and is on the map) can now see it, within 5 km, once
  const feed = (await bea.client.rpc("status_feed", { p_lat: north(1.5).lat, p_lng: PIN.lng, p_radius_km: 5 })).data as { status_id: string }[];
  expect(feed.some((s) => s.status_id === mine.id)).toBe(true);

  // own status: views and delete
  await page.getByTestId("my-status").click();
  const viewer = page.getByRole("dialog", { name: "Your status", exact: true });
  await expect(viewer.getByTestId("status-views")).toContainText("0 views");
  await viewer.getByRole("button", { name: "Delete this status" }).click();
  await expect.poll(async () => (await admin.from("customer_statuses").select("id").eq("id", mine.id)).data?.length).toBe(0);
});
