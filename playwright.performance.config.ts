import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "./tests/performance",
  timeout: 45000,
  projects: [
    {
      name: "hardware-chromium",
      use: {
        browserName: "chromium",
        channel: "chromium",
        viewport: { width: 1440, height: 1100 },
      },
    },
  ],
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/performance.json" }],
  ],
});
