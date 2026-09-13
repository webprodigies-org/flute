import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
// A static normalized distance input, not a UI screenshot or an authored effect.
// Runtime focus position/radius/depth/weights remain in core/spatial.ts.
// Run through the project's browser-capable workflow when regenerating this asset.
const browser = await chromium.launch({ channel: "chromium" });
try {
  const page = await browser.newPage();
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await writeFile(
    new URL("../src/react/radial-mask.png", import.meta.url),
    Buffer.from(data, "base64"),
  );
} finally {
  await browser.close();
}
