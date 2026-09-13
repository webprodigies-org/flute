import { test, expect, type Page } from "@playwright/test";

async function setRange(page: Page, name: string, value: number) {
  await page
    .getByRole("slider", { name, exact: true })
    .evaluate((element, value) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(element, String(value));
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
}
const node = (page: Page, id: string) =>
  page.locator('[data-flute-id="' + id + '"]');
test("renders API-backed components and changes focal sharpness without refetching or replacing state", async ({
  page,
}) => {
  let requests = 0;
  const errors: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/dashboard") requests++;
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByTestId("revenue-card")).toContainText("48,294");
  await expect(page.getByTestId("customers-card")).toContainText("2,847");
  await expect(page.getByTestId("revenue-card")).toHaveCount(1);
  await expect(node(page, "revenue")).toHaveAttribute("data-flute-blur", "0");
  expect(
    Number(await node(page, "customers").getAttribute("data-flute-blur")),
  ).toBeGreaterThan(0);
  const requestsBefore = requests;
  await page.getByRole("button", { name: "Inspect trend" }).click();
  await page.getByLabel("Revenue period").selectOption("Last month");
  await page.getByRole("button", { name: "Customer card" }).click();
  await expect(node(page, "customers")).toHaveAttribute("data-flute-blur", "0");
  expect(
    Number(await node(page, "revenue").getAttribute("data-flute-blur")),
  ).toBeGreaterThan(0);
  await expect(page.getByTestId("revenue-card")).toContainText("Day 7");
  await expect(page.getByLabel("Revenue period")).toHaveValue("Last month");
  await page.getByRole("button", { name: "View customers" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Alex, Morgan" }),
  ).toContainText("Last month");
  expect(requests).toBe(requestsBefore);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/focus-customers.png",
    fullPage: true,
  });
});
test("focus is visibly applied to content leaves and preserves nested 3D groups", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("revenue-card")).toBeVisible();
  const before = await page.screenshot();
  await page
    .getByRole("button", { name: "Recent activity", exact: false })
    .click();
  await expect(node(page, "activity")).toHaveAttribute("data-flute-blur", "0");
  const blurredLeaf = node(page, "revenue")
    .locator("[data-flute-content]")
    .first();
  await expect(blurredLeaf).toHaveCSS("filter", /blur\([1-9]/);
  await expect(node(page, "composition")).toHaveCSS("filter", "none");
  await expect(node(page, "composition")).toHaveCSS(
    "transform-style",
    "preserve-3d",
  );
  const after = await page.screenshot();
  expect(before.equals(after)).toBe(false);
  await page.screenshot({
    path: "test-results/focus-activity.png",
    fullPage: true,
  });
});
test("tilt and depth controls change actual transforms, and flat view removes blur", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("revenue-card")).toBeVisible();
  const before = Number(
    await node(page, "customers").getAttribute("data-flute-depth"),
  );
  await setRange(page, "Customer depth", -120);
  await expect
    .poll(async () =>
      Number(await node(page, "customers").getAttribute("data-flute-depth")),
    )
    .not.toBe(before);
  await page.getByRole("button", { name: "Flat", exact: true }).click();
  for (const id of ["revenue", "customers", "activity"])
    await expect(node(page, id)).toHaveAttribute("data-flute-blur", "0");
  await page.getByRole("button", { name: "Reset composition" }).click();
  await expect(
    page.getByRole("slider", { name: "Customer depth" }),
  ).toHaveValue("180");
});
test("host baseline makes the same API request and keeps native interactions", async ({
  page,
}) => {
  let requests = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/dashboard") requests++;
  });
  await page.goto("/?fixture=baseline");
  await expect(page.getByTestId("revenue-card")).toContainText("48,294");
  expect(requests).toBe(1);
  await page.getByRole("button", { name: "Inspect trend" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("revenue-card")).toContainText("Day 7");
});
test("API failure supports retry without replacing the surrounding controls", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/dashboard", (route) => {
    attempts++;
    return attempts === 1
      ? route.fulfill({ status: 503, body: "Unavailable" })
      : route.continue();
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("reconnect");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByTestId("revenue-card")).toContainText("48,294");
  await expect(
    page.getByRole("slider", { name: "Horizontal tilt" }),
  ).toBeVisible();
});
test("missing targets and duplicate IDs are diagnosed visibly", async ({
  page,
}) => {
  await page.goto("/?fixture=missing");
  await expect(
    page.getByText(/Focus target is not registered/).first(),
  ).toBeVisible();
  await page.goto("/?fixture=duplicate");
  await expect(page.getByText(/Duplicate surface ID/i).first()).toBeVisible();
});
test("narrow viewport and reduced motion remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Give your product/ }),
  ).toBeVisible();
  await expect(page.getByTestId("revenue-card")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Customer card" }).click();
  await expect(node(page, "customers")).toHaveAttribute("data-flute-blur", "0");
  await page.screenshot({
    path: "test-results/mobile-surface.png",
    fullPage: true,
  });
});
