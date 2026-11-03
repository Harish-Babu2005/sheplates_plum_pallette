import { test } from "@playwright/test";
import { buildDemoState } from "./fixtures/demo-state";

// Screenshots of every staff page (vendor, operations, super admin) at website and phone widths for design review.
const SESSIONS = {
  vendor: { email: "v-meena@sheplates.demo", name: "Meena", role: "vendor", toursCompleted: ["vendor_v1"] },
  operations: { email: "operations@sheplates.demo", name: "Ops", role: "operations", toursCompleted: ["operations_v1"] },
  admin: { email: "admin@sheplates.demo", name: "Admin", role: "admin", toursCompleted: ["admin_v1"] },
};
for (const who of ["vendor", "operations", "admin"] as const) {
  test(`${who} pages`, async ({ page }, info) => {
    test.setTimeout(300_000);
    const state = buildDemoState();
    await page.addInitScript(([s, u]) => { localStorage.clear(); localStorage.setItem("sheplates-v3-state", JSON.stringify(s)); localStorage.setItem("sheplates-v3-session", JSON.stringify(u)); }, [state, SESSIONS[who]] as const);
    await page.goto("/");
    await page.waitForSelector(".k-app", { timeout: 30_000 });
    const mobile = (page.viewportSize()?.width ?? 1280) < 1024;
    const toggle = page.getByRole("button", { name: "Toggle navigation" });
    if (mobile) await toggle.click();
    await page.waitForTimeout(300);
    const names = [...new Set((await page.locator("aside.k-side nav button").allInnerTexts()).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean))];
    let i = 0;
    for (const name of names) {
      if (mobile && !(await page.locator(".k-app.menu-open").count())) await toggle.click();
      await page.locator("aside.k-side nav").getByRole("button", { name, exact: true }).click().catch(() => undefined);
      await page.waitForTimeout(450);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 28);
      await page.screenshot({ path: `qa-screenshots/redesign/${info.project.name}-${who}-${String(i++).padStart(2, "0")}-${slug}.png`, fullPage: info.project.name === "chromium" });
    }
  });
}
