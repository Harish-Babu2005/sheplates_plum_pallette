import { test, expect, type Page } from "@playwright/test";
import { buildDemoState, DEMO_CUSTOMER } from "./fixtures/demo-state";

// People and Statuses in demo mode (no database). Run with: npx playwright test -c playwright.demo.config.ts
// Sample people are placed around the customer pin: priya_eats 0.5 km, arjun.k 1.5, divya_r 2.5, karan_m 4,
// meena.t 7, ravi_south 12, and quiet_cook who is not on the map. priya, arjun, divya, karan and meena have a status.

const CUSTOMER = { email: DEMO_CUSTOMER.email, name: DEMO_CUSTOMER.name, role: "customer", toursCompleted: ["customer_v1"] };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const RED_SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#e0194f"/></svg>');

async function openAs(page: Page, extra: Record<string, unknown> = {}, session: Record<string, unknown> = CUSTOMER) {
  const state = buildDemoState();
  await page.addInitScript(([s, u, seed]) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.clear();
      localStorage.setItem("sheplates-v3-state", JSON.stringify(s));
      localStorage.setItem("sheplates-v3-session", JSON.stringify(u));
      for (const [k, v] of Object.entries(seed as Record<string, unknown>)) localStorage.setItem(k, JSON.stringify(v));
      sessionStorage.setItem("seeded", "1");
    }
  }, [state, session, extra] as const);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Stories", exact: true })).toBeVisible({ timeout: 15_000 });
}
async function openProfile(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) >= 768) await page.locator('[data-tour="account"]').click(); // desktop: Profile lives in the account menu
  await page.getByRole("button", { name: "Profile", exact: true }).click();
}
const tab = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const ring = (page: Page, handle: string) => page.getByRole("button", { name: new RegExp(`^${handle.replace(".", "\\.")}'s status`) });
const mineKey = `local-${DEMO_CUSTOMER.email}`;
const ownStatus = (over: Record<string, unknown> = {}) => ({ id: "own-1", authorId: mineKey, handle: "raj", kind: "photo", caption: "My lunch", mediaUrl: `data:image/png;base64,${PNG.toString("base64")}`, createdAt: new Date(Date.now() - 3_600_000).toISOString(), expiresAt: new Date(Date.now() + 23 * 3_600_000).toISOString(), ...over });

test.describe("Statuses: one-time view, gone after 24 hours (demo data)", () => {
  test("the rail shows people nearby, each status can be watched once, and it is gone afterwards", async ({ page }) => {
    await openAs(page);
    await tab(page, "Stories").click();
    await expect(page.getByTestId("status-rail")).toBeVisible();
    // within 5 km: priya, arjun, divya, karan. meena (7 km) and ravi (12 km) are out, quiet_cook is not on the map
    for (const h of ["priya_eats", "arjun.k", "divya_r", "karan_m"]) await expect(ring(page, h)).toBeVisible();
    for (const h of ["meena.t", "ravi_south", "quiet_cook"]) await expect(ring(page, h)).toHaveCount(0);

    await ring(page, "priya_eats").click();
    const viewer = page.getByRole("dialog", { name: "priya_eats's status" });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByTestId("status-caption")).toHaveText("Idli and filter coffee before work");
    await viewer.getByRole("button", { name: "Next status" }).click();
    await expect(viewer.getByTestId("status-caption")).toHaveText("Chutney trio, all home made");
    await viewer.getByRole("button", { name: "Like" }).click();
    await expect(viewer.getByRole("button", { name: "Unlike" })).toBeVisible();
    await viewer.getByRole("button", { name: "Next status" }).click();   // last one: the viewer closes
    await expect(page.getByTestId("status-viewer")).toHaveCount(0);

    // watched: the ring is gone, and stays gone after a reload
    await expect(ring(page, "priya_eats")).toHaveCount(0);
    await page.reload();
    await tab(page, "Stories").click();
    await expect(ring(page, "arjun.k")).toBeVisible();
    await expect(ring(page, "priya_eats")).toHaveCount(0);
  });

  test("post a photo status: it shows with its time left, counts views, and can be deleted", async ({ page }) => {
    await openAs(page);
    await tab(page, "Stories").click();
    await page.getByRole("button", { name: "Add status", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/disappears after 24 hours and each person can watch it once/)).toBeVisible();
    await dialog.getByLabel("Choose a photo").setInputFiles({ name: "thali.svg", mimeType: "image/svg+xml", buffer: RED_SVG });
    await expect(dialog.getByRole("img", { name: "Preview of your photo" })).toBeVisible();
    await dialog.getByLabel("Status caption").fill("Sunday thali");
    await dialog.getByLabel("Tag a vendor").selectOption("v-meena");
    await dialog.getByRole("button", { name: "Post status" }).click();
    await expect(page.getByText(/Status posted/)).toBeVisible();

    await page.getByTestId("my-status").click();
    const viewer = page.getByRole("dialog", { name: "Your status", exact: true });
    await expect(viewer.getByTestId("status-caption")).toHaveText("Sunday thali");
    const photo = viewer.getByRole("img", { name: "Customer status photo" });
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    const centerPixel = await photo.evaluate((image: HTMLImageElement) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.drawImage(image, 0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    });
    expect(centerPixel[0]).toBeGreaterThan(150);
    expect(centerPixel[1]).toBeLessThan(100);
    await expect(viewer.getByText(/2\dh left|1h left|2[0-4]h left/).first()).toBeVisible();
    await expect(viewer.getByTestId("status-views")).toContainText("0 views");
    await expect(viewer.getByText("Meena's Home Kitchen")).toBeVisible();
    await viewer.getByRole("button", { name: "Delete this status" }).click();
    await expect(page.getByTestId("status-viewer")).toHaveCount(0);
    await expect(page.getByTestId("my-status")).toHaveAccessibleName("Add your status");
  });

  test("a status older than 24 hours is gone, one younger than that is still shown", async ({ page }) => {
    const expired = ownStatus({ id: "old", createdAt: new Date(Date.now() - 25 * 3_600_000).toISOString(), expiresAt: new Date(Date.now() - 3_600_000).toISOString() });
    const fresh = ownStatus({ id: "new", caption: "Still here", createdAt: new Date(Date.now() - 23 * 3_600_000).toISOString(), expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
    await openAs(page, { "sheplates-statuses-v1": { statuses: [expired, fresh], views: {}, likes: {} } });
    await tab(page, "Stories").click();
    await page.getByTestId("my-status").click();
    const viewer = page.getByRole("dialog", { name: "Your status", exact: true });
    await expect(viewer.getByTestId("status-caption")).toHaveText("Still here");   // the expired one is not in the set
    await expect(viewer.getByText(/^(59 min|1h) left/)).toBeVisible();
    await expect(viewer.getByRole("button", { name: "Next status" })).toBeVisible();
    await viewer.getByRole("button", { name: "Next status" }).click();             // only one: this closes
    await expect(page.getByTestId("status-viewer")).toHaveCount(0);
  });

  test("a status is limited to 30 seconds of video", async ({ page }) => {
    await openAs(page);
    await tab(page, "Stories").click();
    await page.getByRole("button", { name: "Add status", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Video, up to 30 s")).toBeVisible();
    // a file that is not a video is refused before posting
    await dialog.getByLabel("Choose a video").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Post status" })).toHaveCount(1);
    await expect(dialog.getByRole("button", { name: "Post status" })).toBeDisabled();
  });
});

test.describe("People: follow, search by handle, and who is nearby (demo data)", () => {
  test("search a handle (even someone not on the map), follow, and their status joins your rail", async ({ page }) => {
    await openAs(page);
    await tab(page, "Stories").click();
    await expect(ring(page, "meena.t")).toHaveCount(0);       // 7 km away, not followed

    await page.getByRole("button", { name: "Find people" }).click();
    const dialog = page.getByRole("dialog", { name: "Find people" });
    await dialog.getByLabel("Search people").fill("q");
    await expect(dialog.getByText(/at least two letters/)).toBeVisible();
    await dialog.getByLabel("Search people").fill("quiet");
    await expect(dialog.getByTestId("person-row")).toHaveAttribute("data-handle", "quiet_cook");   // found by handle though hidden from the map
    await dialog.getByLabel("Search people").fill("@Mee");
    const row = dialog.getByTestId("person-row");
    await expect(row).toHaveAttribute("data-handle", "meena.t");
    await row.getByRole("button", { name: "Follow @meena.t" }).click();
    await expect(row.getByRole("button", { name: "Unfollow @meena.t" })).toBeVisible();
    await page.keyboard.press("Escape");

    // followed people show up whatever the distance, with the "following" ring
    await expect(ring(page, "meena.t")).toBeVisible();
    await expect(ring(page, "meena.t")).toHaveAttribute("data-source", "following");
    await expect(ring(page, "priya_eats")).toHaveAttribute("data-source", "nearby");

    // and the profile counts them, with a list to unfollow from
    await openProfile(page);
    await expect(page.getByRole("button", { name: "Following 1" })).toBeVisible();
    await page.getByRole("button", { name: "Following 1" }).click();
    const list = page.getByRole("dialog", { name: "Following" });
    await expect(list.getByTestId("person-row")).toHaveAttribute("data-handle", "meena.t");
    await list.getByRole("button", { name: "Unfollow @meena.t" }).click();
    await expect(list.getByText("You are not following anyone yet")).toBeVisible();
  });

  test("People nearby lists only those on the map, within the distance chosen", async ({ page }) => {
    await openAs(page);
    await tab(page, "Stories").click();
    await page.getByRole("button", { name: "Find people" }).click();
    const dialog = page.getByRole("dialog", { name: "Find people" });
    await dialog.getByRole("tab", { name: "People nearby" }).click();
    await expect(dialog.getByRole("tab", { name: "5 km", exact: true })).toHaveAttribute("aria-selected", "true");
    const handles = async () => dialog.getByTestId("person-row").evaluateAll((els) => els.map((e) => e.getAttribute("data-handle")));
    await expect.poll(handles).toEqual(["priya_eats", "arjun.k", "divya_r", "karan_m"]);
    await dialog.getByRole("tab", { name: "10 km", exact: true }).click();
    await expect.poll(handles).toEqual(["priya_eats", "arjun.k", "divya_r", "karan_m", "meena.t"]);
    await dialog.getByRole("tab", { name: "1 km", exact: true }).click();
    await expect.poll(handles).toEqual(["priya_eats"]);
    await expect(dialog.getByText(/half kilometre/).first()).toBeVisible();
    await dialog.getByLabel("Search people").fill("zzz");
    await expect(dialog.getByText("Nobody on the map within 1 km")).toBeVisible();
  });

  test("the Maps tab has a People view with pins, distance and who-to-show filters", async ({ page }) => {
    test.setTimeout(60_000); // with real Ola credentials set, the map loads over the network
    await openAs(page);
    await tab(page, "Maps").click();
    await expect(page.locator(".sp-vendor-map")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("tab", { name: "People", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Trials" })).toHaveCount(0);
    const pins = page.locator(".sp-map-person-pin");
    await expect(pins).toHaveCount(4);
    await expect(page.getByTestId("map-count")).toContainText("4 people nearby");
    await expect(page.locator(".sp-map-photo-pin")).toHaveCount(0);   // no vendor pins in People view

    await page.getByRole("tab", { name: "10 km", exact: true }).click();
    await expect(pins).toHaveCount(5);
    await page.getByRole("tab", { name: "1 km", exact: true }).click();
    await expect(pins).toHaveCount(1);
    await expect(page.getByTestId("map-count")).toContainText("1 person nearby");

    await page.getByRole("tab", { name: "10 km", exact: true }).click();
    await page.getByRole("tab", { name: "Following", exact: true }).last().click();
    await expect(pins).toHaveCount(0);
    await expect(page.getByText("Nobody you follow is on the map here")).toBeVisible();
    await page.getByRole("tab", { name: "Everyone" }).click();
    await pins.first().click();
    const row = page.getByTestId("person-row").first();
    await row.getByRole("button", { name: /^Follow @/ }).click();
    await expect(row.getByRole("button", { name: /^Unfollow @/ })).toBeVisible();
    await page.getByRole("tab", { name: "Following", exact: true }).last().click();
    await expect(pins).toHaveCount(1);

    // list view and the search box work on people too
    await page.getByRole("tab", { name: "Everyone" }).click();
    await page.getByLabel("Search people on the map").fill("div");
    await expect(pins).toHaveCount(1);
    const listToggle = page.getByRole("button", { name: /^List \(/ });
    if (await listToggle.isVisible()) await listToggle.click(); // from 1024 px the list sits beside the map
    await expect(page.getByTestId("people-list").getByTestId("person-row")).toHaveAttribute("data-handle", "divya_r");
  });

  test("the profile is slim: counts, a map switch that is off by default, and no upload gallery", async ({ page }) => {
    await openAs(page);
    await openProfile(page);
    const toggle = page.getByRole("switch", { name: "Show me on the map" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText(/never your delivery pin/)).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await openProfile(page);
    await expect(page.getByRole("switch", { name: "Show me on the map" })).toHaveAttribute("aria-checked", "true");
    for (const name of ["Photos", "Food Trials", "Saved"]) await expect(page.getByRole("tab", { name })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Your status" })).toBeVisible();
  });

  test("nobody sees you on the map unless you chose it, and only a coarse position is stored", async ({ page }) => {
    await openAs(page);
    await openProfile(page);
    await page.getByRole("switch", { name: "Show me on the map" }).click();
    const stored = await page.evaluate((email) => {
      const mine = JSON.parse(localStorage.getItem(`sheplates-people-v1:${email}`) || "{}");
      const state = JSON.parse(localStorage.getItem("sheplates-v3-state") || "{}");
      const me = (state.customers || []).find((c: { email: string }) => c.email === email);
      return { pin: mine.pin, exact: me && { lat: me.latitude, lng: me.longitude }, on: mine.discoverable };
    }, DEMO_CUSTOMER.email);
    expect(stored.on).toBe(true);
    expect(stored.pin).toBeTruthy();
    expect(stored.pin.lat).not.toBe(stored.exact.lat);
    expect(Math.abs(Math.round(stored.pin.lat / 0.005) * 0.005 - stored.pin.lat)).toBeLessThan(1e-6);
    await page.getByRole("switch", { name: "Show me on the map" }).click();
    const after = await page.evaluate((email) => JSON.parse(localStorage.getItem(`sheplates-people-v1:${email}`) || "{}"), DEMO_CUSTOMER.email);
    expect(after.discoverable).toBe(false);
    expect(after.pin).toBeUndefined();
  });
});
