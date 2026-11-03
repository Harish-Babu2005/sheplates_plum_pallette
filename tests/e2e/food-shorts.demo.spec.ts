import { test, expect, type Page } from "@playwright/test";
import { buildDemoState, DEMO_CUSTOMER } from "./fixtures/demo-state";
import { openStaffNavIfCollapsed } from "./helpers";

// Food Shorts in demo mode (no database): vendors post a video of up to 30 seconds and customers
// see it only inside the distance rules. Run with: npx playwright test -c playwright.demo.config.ts
//
// Fixture geography (Coimbatore): the customer pin is RS Puram. Meena's Home Kitchen is about
// 0.5 km away. Fresh Farm (Ukkadam) is about 6.8 km away.

const CUSTOMER = { email: DEMO_CUSTOMER.email, name: DEMO_CUSTOMER.name, role: "customer", toursCompleted: ["customer_v1"] };
const VENDOR = { email: "v-meena@sheplates.demo", name: "Meena", role: "vendor", toursCompleted: ["vendor_v1"] };

type SeedShort = { id: string; vendorId: string; vendorName: string; vendorCategory: string; title: string; reachKm: number };
const short = (s: SeedShort) => ({ caption: "", durationS: 18, status: "active", viewCount: 3, likeCount: 2, createdAt: new Date(Date.now() - 600_000).toISOString(), ...s });
const SEEDED = [
  short({ id: "s-a", vendorId: "v-meena", vendorName: "Meena's Home Kitchen", vendorCategory: "Home food", title: "A reach 2 km", reachKm: 2 }),
  short({ id: "s-b", vendorId: "v-fresh", vendorName: "Fresh Farm", vendorCategory: "Vegetables", title: "B reach 10 km", reachKm: 10 }),
  short({ id: "s-c", vendorId: "v-fresh", vendorName: "Fresh Farm", vendorCategory: "Vegetables", title: "C reach 5 km", reachKm: 5 }),
];

async function openAs(page: Page, session: unknown, shorts: unknown[] | null = null, ready: string | null = "Stories") {
  const state = buildDemoState();
  await page.addInitScript(([s, u, seeded]) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.clear();
      localStorage.setItem("sheplates-v3-state", JSON.stringify(s));
      localStorage.setItem("sheplates-v3-session", JSON.stringify(u));
      if (seeded) localStorage.setItem("sheplates-food-shorts-v1", JSON.stringify({ shorts: seeded, likes: {}, views: {} }));
      sessionStorage.setItem("seeded", "1");
    }
  }, [state, session, shorts] as const);
  await page.goto("/");
  if (ready) await expect(page.getByRole("button", { name: ready, exact: true })).toBeVisible({ timeout: 15_000 });
  else await expect(page.getByText("VENDOR WORKSPACE")).toBeVisible({ timeout: 15_000 });
}
const tab = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const thumb = (page: Page, title: string) => page.getByRole("button", { name: new RegExp(`^Watch ${title} from`) });

async function openVendorShorts(page: Page) {
  await openStaffNavIfCollapsed(page);
  await tab(page, "Food Shorts").click();
}

/** Records a short WebM clip in the page (no ffmpeg needed) and returns its bytes. */
async function makeWebm(page: Page, seconds = 2): Promise<Buffer> {
  const base64 = await page.evaluate(async (secs) => {
    const canvas = document.createElement("canvas"); canvas.width = 180; canvas.height = 320;
    const ctx = canvas.getContext("2d")!;
    const stream = canvas.captureStream(15);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
    recorder.start();
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const draw = () => { const t = (performance.now() - start) / 1000; ctx.fillStyle = `hsl(${(t * 90) % 360} 70% 55%)`; ctx.fillRect(0, 0, 180, 320); ctx.fillStyle = "#fff"; ctx.font = "28px sans-serif"; ctx.fillText(t.toFixed(1), 60, 170); if (t < secs) requestAnimationFrame(draw); else resolve(); };
      draw();
    });
    recorder.stop(); await done;
    const blob = new Blob(chunks, { type: "video/webm" });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = ""; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }, seconds);
  return Buffer.from(base64, "base64");
}

test.describe("Food Shorts: distance control (demo data)", () => {
  test("customers see a short only inside the vendor's reach AND the distance they choose", async ({ page }) => {
    await openAs(page, CUSTOMER, SEEDED);
    await tab(page, "Stories").click();
    await expect(page.getByRole("heading", { name: "Food Shorts", exact: true })).toBeVisible();

    // default chip is 5 km: Meena (0.5 km, reach 2) is in. Fresh Farm (6.8 km) is out whatever its reach.
    await expect(page.getByRole("tab", { name: "5 km", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(thumb(page, "A reach 2 km")).toBeVisible();
    await expect(thumb(page, "B reach 10 km")).toHaveCount(0);
    await expect(thumb(page, "C reach 5 km")).toHaveCount(0);

    // widen to 10 km: B (reach 10) appears; C (reach only 5 km) never does, because the vendor limited it
    await page.getByRole("tab", { name: "10 km", exact: true }).click();
    await expect(thumb(page, "B reach 10 km")).toBeVisible();
    await expect(thumb(page, "C reach 5 km")).toHaveCount(0);
    await page.getByRole("tab", { name: "30 km", exact: true }).click();
    await expect(thumb(page, "C reach 5 km")).toHaveCount(0);

    // narrow to 1 km: A is still 0.5 km away, B is gone again
    await page.getByRole("tab", { name: "1 km", exact: true }).click();
    await expect(thumb(page, "A reach 2 km")).toBeVisible();
    await expect(thumb(page, "B reach 10 km")).toHaveCount(0);
  });

  test("a hidden short disappears for customers", async ({ page }) => {
    await openAs(page, CUSTOMER, SEEDED.map((s) => (s.id === "s-a" ? { ...s, status: "hidden" } : s)));
    await tab(page, "Stories").click();
    await expect(page.getByTestId("shorts-grid")).toBeVisible();
    await expect(thumb(page, "A reach 2 km")).toHaveCount(0);
  });

  test("the full-screen viewer shows distance and reach, likes, and closes with Escape", async ({ page }) => {
    await openAs(page, CUSTOMER, SEEDED);
    await tab(page, "Stories").click();
    await thumb(page, "A reach 2 km").click();
    const viewer = page.getByRole("dialog", { name: "Food Shorts" });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByRole("heading", { name: "A reach 2 km" })).toBeVisible();
    await expect(viewer.getByText(/away$/).first()).toBeVisible();
    await expect(viewer.getByText("Reaches 2 km")).toBeVisible();
    const likes = viewer.getByTestId("short-likes").first();
    await expect(likes).toHaveText(/^\d+$/);
    const before = Number(await likes.textContent());
    await viewer.getByRole("button", { name: "Like" }).first().click();
    await expect(viewer.getByRole("button", { name: "Unlike" }).first()).toBeVisible();
    await expect(likes).toHaveText(String(before + 1));
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
  });

  test("Stories shows the Food Shorts for the chosen distance", async ({ page }) => {
    await openAs(page, CUSTOMER, SEEDED, "Stories");
    await page.getByRole("button", { name: "Stories", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Food Shorts", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Nearby" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("shorts-grid")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Watch A reach 2 km from/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Watch B reach 10 km from/ })).toHaveCount(0);
  });
});

test.describe("Food Shorts: the map (demo data)", () => {
  test("pins show a play badge, the Shorts tab filters vendors, and a pin opens the viewer", async ({ page }) => {
    await openAs(page, CUSTOMER, SEEDED);
    await tab(page, "Maps").click();
    await expect(page.locator(".sp-vendor-map")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.sp-map-photo-pin:not([data-shorts="0"])').first()).toBeVisible();

    await page.getByRole("tab", { name: "Shorts" }).click();
    // every vendor left on the map has at least one short that reaches the customer
    const pins = page.locator(".sp-map-photo-pin");
    await expect(pins.first()).toBeVisible();
    const withoutShorts = await page.locator('.sp-map-photo-pin[data-shorts="0"]').count();
    expect(withoutShorts).toBe(0);

    await pins.first().click();
    const watch = page.getByTestId("watch-shorts");
    await expect(watch).toBeVisible();
    await watch.click();
    await expect(page.getByRole("dialog", { name: "Food Shorts" })).toBeVisible();
  });

  test("custom controls: zoom, centre on me, and the radius chip", async ({ page }) => {
    await openAs(page, CUSTOMER, SEEDED);
    await tab(page, "Maps").click();
    await expect(page.locator(".sp-vendor-map")).toBeVisible({ timeout: 15_000 });
    const map = page.locator(".sp-vendor-map");
    await expect(map.getByRole("button", { name: "Zoom in" })).toBeVisible();
    await expect(map.getByRole("button", { name: "Zoom out" })).toBeVisible();
    await expect(map.getByRole("button", { name: "Centre the map on my location" })).toBeVisible();
    // the zoom control no longer sits under the radius chip
    const chip = await map.getByText(/km · \d+ vendors? in range/).boundingBox();
    const zoom = await map.getByRole("button", { name: "Zoom in" }).boundingBox();
    expect(chip && zoom).toBeTruthy();
    const overlap = !(zoom!.x > chip!.x + chip!.width || zoom!.x + zoom!.width < chip!.x || zoom!.y > chip!.y + chip!.height || zoom!.y + zoom!.height < chip!.y);
    expect(overlap).toBe(false);
    await map.getByRole("button", { name: "Increase radius" }).click();
    await expect(map.getByText(/^11 km/)).toBeVisible();
  });
});

test.describe("Food Shorts: the vendor creates one", () => {
  test("a vendor posts a real video and the customer then sees it and can play it", async ({ page }) => {
    await openAs(page, VENDOR, null, null);
    await openVendorShorts(page);
    await expect(page.getByRole("heading", { name: "Food Shorts", exact: true })).toBeVisible();
    await expect(page.getByText("No Food Shorts yet")).toBeVisible();

    const video = await makeWebm(page, 2);
    await page.getByLabel("Choose a video").setInputFiles({ name: "kitchen.webm", mimeType: "video/webm", buffer: video });
    await expect(page.getByLabel("Preview of your video")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Length 0:0[1-3] of 0:30/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish short" })).toBeDisabled(); // a title is required
    await page.getByLabel("Short title").fill("Morning idli batch");
    await page.getByLabel("Short caption").fill("Steamed fresh at 7 am");
    await page.getByLabel("Reach distance").selectOption("5");
    await expect(page.getByText(/Customers within 5 km of your shop can see this short/)).toBeVisible();
    await page.getByRole("button", { name: "Publish short" }).click();

    await expect(page.getByText(/Food Short published/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Food Shorts (1)" })).toBeVisible();
    const card = page.getByTestId("my-short").first();
    await expect(card.getByText("Morning idli batch")).toBeVisible();
    await expect(card.getByText("Live", { exact: true })).toBeVisible();
    await expect(card.getByText("5 km")).toBeVisible();

    // switch to the customer in the same browser (same local data) and look for it
    await page.evaluate((u) => localStorage.setItem("sheplates-v3-session", JSON.stringify(u)), CUSTOMER);
    await page.reload();
    await expect(tab(page, "Stories")).toBeVisible({ timeout: 15_000 });
    await tab(page, "Stories").click();
    await thumb(page, "Morning idli batch").click();
    const viewer = page.getByRole("dialog", { name: "Food Shorts" });
    await expect(viewer).toBeVisible();
    const player = viewer.locator("video").first();
    await expect(player).toHaveAttribute("src", /^blob:/);
    await expect.poll(() => player.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    expect(await player.evaluate((v: HTMLVideoElement) => v.duration)).toBeGreaterThan(0);
  });

  test("the vendor can hide, show and delete a short; unsupported files are refused", async ({ page }) => {
    await openAs(page, VENDOR, SEEDED.filter((s) => s.id === "s-a"), null);
    await openVendorShorts(page);
    await expect(page.getByRole("heading", { name: "Your Food Shorts (1)" })).toBeVisible();
    const card = page.getByTestId("my-short").first();

    await page.getByLabel("Choose a video").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a video") });
    await expect(page.getByRole("alert")).toContainText("Use an MP4, MOV or WebM video");

    await card.getByRole("button", { name: "Hide" }).click();
    await expect(card.getByText("Hidden", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Show" }).click();
    await expect(card.getByText("Live", { exact: true })).toBeVisible();

    await card.getByRole("button", { name: "Delete" }).click();
    await card.getByRole("button", { name: "Confirm delete" }).click();
    await expect(page.getByText("No Food Shorts yet")).toBeVisible();
  });

  test("a vendor without a store pin is told shorts will reach nobody", async ({ page }) => {
    const state = buildDemoState();
    state.vendors = state.vendors.map((v) => (v.id === "v-meena" ? { ...v, latitude: undefined, longitude: undefined } : v)) as unknown as typeof state.vendors;
    await page.addInitScript(([s, u]) => {
      if (!sessionStorage.getItem("seeded")) { localStorage.clear(); localStorage.setItem("sheplates-v3-state", JSON.stringify(s)); localStorage.setItem("sheplates-v3-session", JSON.stringify(u)); sessionStorage.setItem("seeded", "1"); }
    }, [state, VENDOR] as const);
    await page.goto("/");
    await expect(page.getByText("VENDOR WORKSPACE")).toBeVisible({ timeout: 15_000 });
    await openVendorShorts(page);
    await expect(page.getByText(/Set your exact store pin/)).toBeVisible();
  });
});
