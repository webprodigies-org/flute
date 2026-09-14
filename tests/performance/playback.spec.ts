import { test, expect } from "@playwright/test";
for (const recipe of ["camera", "focus"])
  test(`${recipe}: sustained frame budget with progressive focus enabled`, async ({
    page,
    browser,
  }, testInfo) => {
    const session = await browser.newBrowserCDPSession();
    const info = await session.send("SystemInfo.getInfo");
    expect(
      info.gpu.featureStatus?.gpu_compositing,
      "Performance qualification requires hardware GPU compositing; use full Chromium, not headless-shell software rendering.",
    ).toBe("enabled");
    await page.goto("/tests/preview/fixture.html?mode=" + recipe);
    await expect(page.getByTestId("host")).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { maskMutations: number }).maskMutations = 0;
      new MutationObserver((records) => {
        (window as unknown as { maskMutations: number }).maskMutations +=
          records.filter(
            (r) =>
              r.target instanceof SVGFEImageElement &&
              r.attributeName === "href",
          ).length;
      }).observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ["href"],
      });
    });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    const samples = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const samples: number[] = [];
          let start: number | undefined,
            last = 0;
          function frame(now: number) {
            if (start === undefined) {
              start = now;
              last = now;
            } else if (now - start > 300) samples.push(now - last);
            last = now;
            if (now - start < 6300) requestAnimationFrame(frame);
            else resolve(samples);
          }
          requestAnimationFrame(frame);
        }),
    );
    samples.sort((a, b) => a - b);
    const report = {
      gpu: info.gpu.devices,
      recipe,
      samples: samples.length,
      p50: samples[Math.floor(samples.length * 0.5)],
      p95: samples[Math.floor(samples.length * 0.95)],
      averageFps: 1000 / (samples.reduce((a, b) => a + b, 0) / samples.length),
      over33ms: samples.filter((x) => x > 33.4).length,
    };
    await testInfo.attach("frame-budget", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });
    console.log(JSON.stringify(report));
    expect(report.averageFps).toBeGreaterThanOrEqual(55);
    expect(report.p95).toBeLessThan(20);
    expect(report.over33ms / samples.length).toBeLessThan(0.02);
    expect(
      await page.evaluate(
        () => (window as unknown as { maskMutations: number }).maskMutations,
      ),
    ).toBe(0);
    expect(
      await page
        .locator("feImage")
        .evaluateAll(
          (nodes) =>
            new Set(nodes.map((node) => node.getAttribute("href"))).size,
        ),
    ).toBe(2);
  });
