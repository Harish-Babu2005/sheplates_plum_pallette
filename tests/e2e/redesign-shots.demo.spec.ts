import { test } from "@playwright/test";
import { buildDemoState, DEMO_CUSTOMER } from "./fixtures/demo-state";

// Visual checkpoints for the 2.0 redesign: screenshots of customer pages at website and phone widths, saved to
// qa-screenshots/redesign/. Compare them with the approved boards. Run: npx playwright test -c playwright.demo.config.ts redesign-shots
const PAGES: [string, string][] = [["Marketplace", "home"], ["Search", "search"], ["Food Drops", "food-drops"], ["Stories", "stories"], ["Maps", "maps"], ["Orders", "orders"], ["My schedule", "schedules"], ["My quotations", "quotations"], ["Wishlist", "wishlist"], ["Profile", "profile"], ["Cart", "cart"]];

for (const [name, slug] of PAGES) {
  test(`customer ${slug}`, async ({ page }, info) => {
    const state = buildDemoState();
    const session = { email: DEMO_CUSTOMER.email, name: DEMO_CUSTOMER.name, role: "customer", toursCompleted: ["customer_v1"] };
    await page.addInitScript(([s, u]) => { localStorage.clear(); localStorage.setItem("sheplates-v3-state", JSON.stringify(s)); localStorage.setItem("sheplates-v3-session", JSON.stringify(u)); }, [state, session] as const);
    await page.goto("/");
    await page.waitForSelector("header.k-head", { timeout: 20_000 });
    const w = page.viewportSize()!.width;
    const trigger = w >= 768 ? page.locator(".k-menurow button", { hasText: new RegExp(`^${name === "Marketplace" ? "Home" : name === "Search" ? "Marketplace" : name === "My schedule" ? "Schedules" : name === "My quotations" ? "Quotations" : name}$`) }) : null;
    if (name === "Wishlist") await page.getByRole("button", { name: "Wishlist" }).first().click({ force: true }).catch(() => undefined);
    else if (name === "Cart") await page.locator('[data-tour="cart"]').click();
    else if (name === "Profile" && w < 768) await page.getByRole("button", { name: "Profile", exact: true }).click();
    else if (name === "Profile") await page.locator('[data-tour="account"]').click();
    else if (trigger) await trigger.click();
    else if (name !== "Marketplace") await page.getByRole("button", { name: name === "My schedule" ? "Orders" : name === "My quotations" ? "Profile" : name, exact: true }).first().click().catch(() => undefined);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `qa-screenshots/redesign/${info.project.name}-${slug}.png`, fullPage: false });
  });
}
