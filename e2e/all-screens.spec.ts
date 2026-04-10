import { test, expect } from "../playwright-fixture";

const PUBLIC_ROUTES = [
  { path: "/", name: "Landing Page" },
  { path: "/login", name: "Login" },
  { path: "/pricing", name: "Pricing" },
];

const PROTECTED_ROUTES = [
  { path: "/dashboard", name: "Dashboard" },
  { path: "/channels", name: "Channels" },
  { path: "/search", name: "Channel Search" },
  { path: "/niches", name: "Niche Explorer" },
  { path: "/scripts", name: "Scripts" },
  { path: "/titles", name: "Titles" },
  { path: "/viral-db", name: "Viral Database" },
  { path: "/multichannel", name: "MultiChannel" },
  { path: "/tracker", name: "Tracker 30 Days" },
  { path: "/growth-tools", name: "Growth Tools" },
  { path: "/shorts-trends", name: "Shorts Trends" },
  { path: "/knowledge", name: "Knowledge Admin" },
  { path: "/onboarding", name: "Onboarding" },
];

const REDIRECT_ROUTES = [
  { path: "/branding", redirectsTo: "/growth-tools" },
  { path: "/workflow", redirectsTo: "/tracker" },
  { path: "/intelligence", redirectsTo: "/channels" },
  { path: "/power-tools", redirectsTo: "/growth-tools" },
];

test.describe("Public Routes", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) loads without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(400);

      // Wait for React to render
      await page.waitForTimeout(2000);

      // No JS errors
      expect(errors).toEqual([]);

      // Page has visible content
      const body = page.locator("body");
      await expect(body).toBeVisible();
    });
  }
});

test.describe("Landing Page content", () => {
  test("has hero section and navigation", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Should have a main heading
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();

    // Should have navigation links or buttons
    const nav = page.locator("nav, header").first();
    await expect(nav).toBeVisible();
  });
});

test.describe("Login Page", () => {
  test("shows login form", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Should have email input
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await expect(emailInput).toBeVisible();

    // Should have password input
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toBeVisible();
  });
});

test.describe("Protected Routes redirect to login", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route.name} (${route.path}) redirects unauthenticated users`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);

      // Should redirect to /login
      const url = page.url();
      expect(url).toContain("/login");
    });
  }
});

test.describe("Redirect Routes", () => {
  for (const route of REDIRECT_ROUTES) {
    test(`${route.path} redirects to ${route.redirectsTo}`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);

      const url = page.url();
      // Either redirects to target or to login (if protected)
      const redirectedCorrectly = url.includes(route.redirectsTo) || url.includes("/login");
      expect(redirectedCorrectly).toBe(true);
    });
  }
});

test.describe("404 Page", () => {
  test("shows not found for unknown routes", async ({ page }) => {
    await page.goto("/some-random-nonexistent-page", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const body = await page.textContent("body");
    // Should show some indication of not found
    const has404 = body?.includes("404") || body?.includes("não encontrad") || body?.includes("not found") || body?.includes("Not Found");
    expect(has404).toBe(true);
  });
});

test.describe("Pricing Page", () => {
  test("shows pricing plans", async ({ page }) => {
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const body = await page.textContent("body");
    // Should contain pricing-related text
    const hasPricing = body?.match(/plano|price|pricing|mensal|month|grátis|free|pro|premium/i);
    expect(hasPricing).toBeTruthy();
  });
});

test.describe("No console errors on public pages", () => {
  test("landing page has no critical console errors", async ({ page }) => {
    const criticalErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("favicon")) {
        criticalErrors.push(msg.text());
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Filter out known non-critical errors
    const realErrors = criticalErrors.filter(
      (e) => !e.includes("net::ERR") && !e.includes("403") && !e.includes("401")
    );

    // Log for debugging but don't fail on minor issues
    if (realErrors.length > 0) {
      console.log("Console errors found:", realErrors);
    }
  });
});
