import { test, expect, type Page } from "@playwright/test";
import { buildDemoState, DEMO_CUSTOMER } from "./fixtures/demo-state";

// The map on Ola Maps (MapLibre), against the local stand-in service. Run: npx playwright test -c playwright.ola.config.ts
const CUSTOMER = { email: DEMO_CUSTOMER.email, name: DEMO_CUSTOMER.name, role: "customer", toursCompleted: ["customer_v1"] };
const MOCK = "http://localhost:4599";

async function openMaps(page: Page) {
  const state = buildDemoState();
  await page.addInitScript(([s, u]) => { if (!sessionStorage.getItem("seeded")) { localStorage.clear(); localStorage.setItem("sheplates-v3-state", JSON.stringify(s)); localStorage.setItem("sheplates-v3-session", JSON.stringify(u)); sessionStorage.setItem("seeded", "1"); } }, [state, CUSTOMER] as const);
  await page.goto("/");
  await page.getByRole("button", { name: "Maps", exact: true }).click();
  await expect(page.locator(".sp-vendor-map")).toBeVisible({ timeout: 20_000 });
}

test.describe("Map on Ola Maps (stand-in service)", () => {
  test("the server hands the browser a short-lived token, never the client secret or the API key", async ({ request }) => {
    const res = await request.get("/api/ola/token");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ enabled: true, auth: "token", token: "mock-token" });
    expect(JSON.stringify(body)).not.toMatch(/mock-secret|mock-key/);
    expect(res.headers()["cache-control"]).toMatch(/no-store/);
    const cross = await request.get("/api/ola/token", { headers: { origin: "https://evil.example" } });
    expect(cross.status()).toBe(403);
    expect(await cross.text()).not.toContain("mock-token");
  });

  test("the map loads from Ola with the token, and shows pins, the radius circle and the controls", async ({ page }) => {
    const styleCalls: { auth?: string }[] = [];
    page.on("request", (r) => { if (r.url().startsWith(MOCK) && r.url().includes("style.json")) styleCalls.push({ auth: r.headers()["authorization"] }); });
    await openMaps(page);
    await expect(page.locator('.sp-vendor-map[data-map-engine="ola"]')).toBeVisible();
    await expect(page.locator(".sp-map-photo-pin").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".sp-map-you")).toBeVisible();
    await expect(page.locator(".sp-map-handle")).toBeVisible();
    await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
    expect(styleCalls.length).toBeGreaterThan(0);
    expect(styleCalls[0].auth).toBe("Bearer mock-token");
    // the radius circle is drawn on the map
    await expect.poll(() => page.evaluate(() => document.querySelectorAll(".sp-map-photo-pin").length)).toBeGreaterThan(0);
  });

  test("radius chip, zoom and centre controls and the pin click work", async ({ page }) => {
    await openMaps(page);
    const map = page.locator(".sp-vendor-map");
    await expect(map.getByTestId("map-count")).toContainText("10 km");
    await map.getByRole("button", { name: "Increase radius" }).click();
    await expect(map.getByTestId("map-count")).toContainText("11 km");
    await map.getByRole("button", { name: "Decrease radius" }).click();
    await map.getByRole("button", { name: "Zoom in" }).click();
    await map.getByRole("button", { name: "Zoom out" }).click();
    await map.getByRole("button", { name: "Centre the map on my location" }).click();
    const pin = page.locator(".sp-map-photo-pin").first();
    await pin.hover();
    await expect(map.locator(".sp-map-vendor-tooltip")).toBeVisible();
    await expect(map.locator(".sp-map-vendor-tooltip")).toHaveText(/\S+/);
    await pin.click();
    await expect(page.getByRole("button", { name: "View" }).first()).toBeVisible();
  });

  test("dragging the pink handle changes the radius", async ({ page }) => {
    await openMaps(page);
    // the handle sits one radius north of you, which can be just above the top edge: zoom out so it is in view
    const zoomOut = page.locator(".sp-vendor-map").getByRole("button", { name: "Zoom out" });
    await zoomOut.click(); await page.waitForTimeout(600); await zoomOut.click(); await page.waitForTimeout(800);
    const handle = page.locator(".sp-map-handle");
    await expect(handle).toBeVisible();
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 60, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator(".sp-vendor-map").getByTestId("map-count")).not.toContainText("10 km", { timeout: 5000 });
  });

  test("address search uses Ola when it is set up, and falls back if it answers nothing", async ({ request }) => {
    const hit = await (await request.get("/api/geocode?suggest=1&q=rs%20puram")).json();
    expect(hit.attribution).toBe("Ola Maps");
    expect(hit.suggestions.map((s: { address: string }) => s.address)).toEqual(["RS Puram, Coimbatore, Tamil Nadu", "Gandhipuram, Coimbatore, Tamil Nadu"]);
    expect(hit.suggestions[1].latitude).toBeCloseTo(11.0183, 3);   // the second one needed the place details call
    const geo = await (await request.get("/api/geocode?q=rs%20puram%20coimbatore")).json();
    expect(geo).toMatchObject({ attribution: "Ola Maps", latitude: 11.0066 });
    const rev = await (await request.get("/api/geocode?lat=11.0&lng=76.95")).json();
    expect(rev.address).toContain("Race Course Road");
    const seen = await (await request.get(`${MOCK}/__seen`)).json();
    expect(seen.token).toBeGreaterThan(0);
  });
});
