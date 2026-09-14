import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";
import { reviewAuthoring, getAuthoringGuide } from "@flute/scene";
import { execFileSync } from "node:child_process";
import { recipes, reviews } from "../src/scenes/recipes.ts";

// SOURCE OF TRUTH: installed-authoring-trial browser evidence.
// WHAT: checks live registration, state continuity, seeking, playback and responsive
// entry/recovery. WHY: metadata alone cannot demonstrate actual UI. WHERE: output
// screenshots in ignored artifacts/ support human inspection; no library internals.
const root = fileURLToPath(new URL("../", import.meta.url));
const cli = JSON.parse(
  execFileSync("npx", ["flute", "guide", "--json"], {
    cwd: root,
    encoding: "utf8",
  }),
);
await mkdir(root + "artifacts", { recursive: true });
await writeFile(
  root + "artifacts/cli-guide.json",
  JSON.stringify(cli, null, 2),
);
assert.deepEqual(cli, getAuthoringGuide());
for (const review of reviews) { assert.equal(review.valid, true); assert.deepEqual(review.advice, []); }
for (const recipe of recipes) {
  assert.ok(recipe.motion.tracks.some(t=>t.target.kind==='camera'&&['x','y','z'].includes(t.property)&&t.keyframes[0].value!==t.keyframes.at(-1).value));
  assert.ok(!recipe.motion.tracks.some(t=>t.target.kind==='camera'&&t.property.startsWith('rotate')), 'survey angle remains steady');
  assert.ok(recipe.scene.focus.maxBlur<=6 && recipe.scene.focus.fStop>=5.6 && recipe.scene.focus.distance>0);
  if(recipe.id!=='plating') assert.ok(recipe.motion.tracks.every(t=>t.target.kind==='camera'),'stationary subjects, moving camera');
}
assert.equal(
  reviewAuthoring({
    scene: recipes[0].scene,
    motion: {
      durationMs: 100,
      tracks: [
        {
          target: { kind: "surface", id: "missing" },
          property: "x",
          keyframes: [{ timeMs: 0, value: 1 }],
        },
      ],
    },
  }).valid,
  false,
);
assert.equal(
  reviewAuthoring({
    scene: { nodes: [{ id: "same" }, { id: "same" }] },
    motion: { durationMs: 1, tracks: [] },
  }).valid,
  false,
);
const base = process.env.TRIAL_BASE || "/";
const server = process.env.TRIAL_URL ? undefined : await createServer({
  root, base, server: {host:"127.0.0.1", port:0, strictPort:true},
});
await server?.listen();
const browser = await chromium.launch({ headless: true, channel:"chromium" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1200 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const origin = process.env.TRIAL_URL || server.resolvedUrls.local[0];
const report = [];
const seek = async (value) => {
  const slider = page.getByRole("slider", { name: "Scene time" });
  await slider.fill(String(value));
  await slider.dispatchEvent("input");
  await page.waitForTimeout(160);
};
try {
  await page.goto(origin);
  await page.getByText("Total Revenue", { exact: true }).waitFor();
  const baseline = await page
    .getByText("Total Revenue", { exact: true })
    .evaluate((el) => ({
      font: getComputedStyle(el).fontFamily,
      color: getComputedStyle(el).color,
    }));
  await page.screenshot({
    path: root + "artifacts/dashboard.png",
    fullPage: true,
  });
  for (const [id, count] of [
    ["surface-travel", 1],
    ["plating", 6],
    ["floating", 6],
  ]) {
    await page.goto(origin + "?scene=" + id);
    await page.getByText("Ready to inspect", { exact: true }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Play", exact: true }).count(),
      1,
    );
    assert.equal(await page.locator("[data-panel]").count(), count);
    assert.equal(await page.locator("[data-flute-scene]").evaluate(e=>getComputedStyle(e).backgroundColor),"rgb(0, 0, 0)");
    assert.equal(await page.locator(".scene-viewport").evaluate(e=>getComputedStyle(e).backgroundColor),"rgb(0, 0, 0)");
    assert.equal(
      await page.getByText("Total Revenue", { exact: true }).count(),
      1,
    );
    assert.equal(
      await page.getByText("Total Visitors", { exact: true }).count(),
      1,
    );
    assert.deepEqual(
      await page
        .getByText("Total Revenue", { exact: true })
        .evaluate((el) => ({
          font: getComputedStyle(el).fontFamily,
          color: getComputedStyle(el).color,
        })),
      baseline,
    );
    await page
      .getByText("Total Revenue", { exact: true })
      .evaluate((el) => (window.__trialLeaf = el));
    const transforms = [];
    for (const t of [0, 3000, 6000, 9000, 12000]) {
      await seek(t);
      assert.equal(
        await page.getByTestId("diagnostics").textContent(),
        "Ready to inspect",
      );

      const framePixels=await page.locator('[data-flute-scene]').screenshot();
      const visibleContent=await page.evaluate(async encoded=>{
        const image=new Image();image.src='data:image/png;base64,'+encoded;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
        const context=canvas.getContext('2d');context.drawImage(image,0,0);
        const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
        let lit=0;for(let i=0;i<pixels.length;i+=4)if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>40)lit++;
        return lit/(pixels.length/4);
      },framePixels.toString('base64'));
      assert.ok(visibleContent>.01,'real UI pixels must remain visible in the black void, including negative-z surfaces');
      transforms.push(
        await page
          .locator("[data-panel]")
          .first()
          .evaluate((el) => {
            let current = el;
            const values = [];
            while (current) {
              values.push(getComputedStyle(current).transform);
              current = current.parentElement;
            }
            return values;
          }),
      );
      await page.screenshot({
        path: root + `artifacts/${id}-${t}.png`,
        fullPage: true,
      });
    }
    assert.notDeepEqual(transforms[0], transforms.at(-1));
    assert.equal(
      await page
        .getByText("Total Revenue", { exact: true })
        .evaluate((el) => window.__trialLeaf === el),
      true,
    );
    await seek(5000);
    const state = await page.getByTestId("time").textContent();
    await page.waitForTimeout(250);
    assert.equal(await page.getByTestId("time").textContent(), state);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForTimeout(350);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    assert.notEqual(await page.getByTestId("time").textContent(), state);
    await page.getByRole("button", { name: "Restart", exact: true }).click();
    assert.match(await page.getByTestId("time").textContent(), /^0.00/);
    await seek(12000);
    await page.getByRole("button", {name:"Inspect flat page",exact:true}).click();
    const chartSelect = page.getByRole("combobox", { name: "Select a value" });
    if (await chartSelect.isVisible()) {
      await chartSelect.click();
      await page
        .getByRole("option", { name: "Last 30 days", exact: true })
        .click();
      await seek(5000);
      assert.match(await chartSelect.textContent(), /Last 30 days/);
    } else {
      await page
        .getByRole("radio", { name: "Last 30 days", exact: true })
        .click();
      await seek(5000);
      assert.equal(
        await page
          .getByRole("radio", { name: "Last 30 days", exact: true })
          .getAttribute("aria-checked"),
        "true",
      );
    }

    await page.getByRole("button", {name:"Return to shot",exact:true}).click();
    assert.equal(await page.getByText("Total Revenue", {exact:true}).evaluate(el=>window.__trialLeaf===el),true);
    if(process.env.TRIAL_PERFORMANCE==='1') {
      await seek(0);
      await page.getByRole('button',{name:'Play',exact:true}).click();
      const intervals=await page.evaluate(()=>new Promise(resolve=>{const values=[];let start,last;function frame(now){if(start===undefined){start=last=now}else if(now-start>500)values.push(now-last);last=now;if(now-start<4500)requestAnimationFrame(frame);else resolve(values)}requestAnimationFrame(frame)}));
      await page.getByRole('button',{name:'Pause',exact:true}).click();
      intervals.sort((a,b)=>a-b);
      const performance={id,fps:1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length),p95:intervals[Math.floor(intervals.length*.95)],over33:intervals.filter(t=>t>33.4).length/intervals.length};
      console.log('Trial playback',JSON.stringify(performance));
      assert.ok(performance.fps>=55,'trial average FPS >=55');assert.ok(performance.p95<20,'trial p95 <20ms');assert.ok(performance.over33<.02,'trial missed frames <2%');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.screenshot({
      path: root + `artifacts/${id}-mobile.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Inspect at full size", exact: true })
      .click();
    const viewport = page.getByLabel(
      "Scene viewport; scroll to inspect in full-size mode",
    );
    assert.equal(
      await viewport.evaluate((el) => el.scrollWidth > el.clientWidth),
      true,
    );
    await viewport.evaluate((el) => {
      el.scrollLeft = 300;
      el.scrollTop = 200;
    });
    assert.equal(await viewport.evaluate((el) => el.scrollLeft), 300);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: root + `artifacts/${id}-mobile-inspect.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Fit scene", exact: true }).click();
    report.push({
      id,
      panels: count,
      sampledFrames: 5,
      liveIdentity: true,
      playPauseSeek: true,
      mobileWidth: 390,
    });
    await page.setViewportSize({ width: 1440, height: 1200 });
  }
  await page.goto(origin + "?scene=missing");
  await page.getByText("Scene not found.", { exact: false }).waitFor();
  await page.getByRole("link", { name: "← Dashboard" }).click();
  await page.getByText("Total Revenue", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  await writeFile(
    root + "artifacts/report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
  await server?.close();
}
