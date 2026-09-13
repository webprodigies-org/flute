import { test, expect, type Page } from "@playwright/test";
async function setRange(page: Page, name: string, value: number) {
  await page.getByRole("slider", { name, exact: true }).fill(String(value));
}
const node = (page: Page, id: string) =>
  page.locator(`[data-flute-id="${id}"]`);
test("real pointer and keyboard interactions preserve API data, host DOM and state through focus and motion", async ({
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
  await page
    .getByTestId("revenue-card")
    .evaluate((e) => e.setAttribute("data-original", "yes"));
  await page.getByRole("button", { name: "Inspect trend" }).click();
  await expect(page.getByTestId("revenue-card")).toContainText("Day 7");
  await page.getByLabel("Revenue period").selectOption("Last month");
  await setRange(page, "Focus horizontal", -120);
  await setRange(page, "Camera horizontal", 40);
  await expect(page.getByTestId("revenue-card")).toHaveAttribute(
    "data-original",
    "yes",
  );
  await expect(page.getByTestId("revenue-card")).toContainText("Day 7");
  await expect(page.getByLabel("Revenue period")).toHaveValue("Last month");
  await page.getByRole("button", { name: "Reset composition" }).click();
  await page.getByRole("button", { name: "View customers" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Alex, Morgan and Jamie")).toContainText(
    "Last month",
  );
  expect(requests).toBe(1);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "test-results/storage-focus.png",
    fullPage: true,
  });
});
test("deterministic seeking moves camera/layers, reveals chart, and independently moves/tightens focus", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("revenue-card")).toBeVisible();
  await expect(page.getByTestId("revenue-bar").first()).toHaveAttribute(
    "height",
    "0",
  );
  const before = await node(page, "folder-front").getAttribute(
    "data-flute-depth",
  );
  await setRange(page, "Scene time", 4000);
  await expect(page.locator("[data-flute-stage]")).toHaveCSS(
    "transform",
    /matrix3d/,
  );
  expect(
    await node(page, "folder-front").getAttribute("data-flute-depth"),
  ).not.toBe(before);
  expect(
    Number(
      await page.getByTestId("revenue-bar").first().getAttribute("height"),
    ),
  ).toBeGreaterThan(0);
  const atFour = await node(page, "folder-front").getAttribute("style");
  await setRange(page, "Scene time", 1000);
  await setRange(page, "Scene time", 4000);
  expect(await node(page, "folder-front").getAttribute("style")).toBe(atFour);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Let focus wander/ }).click();
  const beforeMask = await page
    .locator("feFuncA")
    .first()
    .getAttribute("tableValues");
  await setRange(page, "Scene time", 4000);
  expect(
    await page.locator("feFuncA").first().getAttribute("tableValues"),
  ).not.toBe(beforeMask);
  await expect(node(page, "composition")).toHaveCSS("filter", "none");
  await expect(node(page, "composition")).toHaveCSS(
    "transform-style",
    "preserve-3d",
  );
  await page.getByRole("button", { name: "Reset composition" }).click();
  await expect(page.getByRole("slider", { name: "Scene time" })).toHaveValue(
    "0",
  );
});
test("manual camera/depth controls and disabled blur update real geometry", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("revenue-card")).toBeVisible();
  const before = await node(page, "revenue").getAttribute("data-flute-depth");
  await setRange(page, "Camera depth", 100);
  expect(await node(page, "revenue").getAttribute("data-flute-depth")).not.toBe(
    before,
  );
  await setRange(page, "Maximum blur", 0);
  await expect(
    node(page, "revenue").locator("[data-flute-content]").first(),
  ).toHaveCSS("filter", "none");
  await page.getByRole("button", { name: "Reset composition" }).click();
  await expect(page.getByRole("slider", { name: "Maximum blur" })).toHaveValue(
    "10",
  );
});
test("host baseline performs one request and keeps native interaction", async ({
  page,
}) => {
  let requests = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/dashboard") requests++;
  });
  await page.goto("/?fixture=baseline");
  await expect(page.getByTestId("revenue-card")).toContainText("48,294");
  expect(requests).toBe(1);
  await page.getByRole("button", { name: "Inspect trend" }).click();
  await expect(page.getByTestId("revenue-card")).toContainText("Day 7");
});
test("API failure retries while scene controls stay available", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/dashboard", (route) =>
    ++attempts === 1
      ? route.fulfill({ status: 503, body: "Unavailable" })
      : route.continue(),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("reconnect");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByTestId("revenue-card")).toContainText("48,294");
  await expect(
    page.getByRole("slider", { name: "Horizontal tilt" }),
  ).toBeVisible();
});
test("invalid focus and duplicate IDs recover in the same scene", async ({
  page,
}) => {
  await page.goto("/?fixture=invalid");
  await expect(page.locator("[data-flute-diagnostics]")).toContainText(
    "focus.radius",
  );
  await page
    .getByRole("button", { name: "Restore valid scene" })
    .first()
    .click();
  await expect(page.locator("[data-flute-diagnostics]")).toHaveCount(0);
  await page.goto("/?fixture=duplicate");
  await expect(page.locator("[data-flute-diagnostics]")).toContainText(
    "Duplicate surface ID",
  );
  await page
    .getByRole("button", { name: "Restore valid scene" })
    .first()
    .click();
  await expect(page.locator("[data-flute-diagnostics]")).toHaveCount(0);
});
test("mobile and reduced motion support paused playback, seeking and pause on preference change", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /A different/ }),
  ).toBeVisible();
  await expect(page.getByRole("slider", { name: "Scene time" })).toHaveValue(
    "0",
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await setRange(page, "Scene time", 4000);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-storage.png",
    fullPage: true,
  });
});
