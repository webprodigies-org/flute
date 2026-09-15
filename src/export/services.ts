import { lstat, mkdir, mkdtemp, link, rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import type { Browser, Page } from "playwright";
import type { CaptureBridge, CaptureManifest, ExportVideo } from "../core/export";
import { canonicalRoot, relativeTarget, scopedPath, readText, atomicWrite } from "../project/services";
import { fault } from "../project/errors";

/** SOURCE OF TRUTH: video capture effects.
 * WHAT: scoped no-overwrite publication, live browser screenshots and bounded FFmpeg streaming.
 * WHY: effects stay outside adapters and trusted export policy; motion remains in the scene.
 * WHERE: export/commands supplies validated requests/manifest; project/services owns path guards.
 */
export const validateTarget = relativeTarget;
export async function prepareScope(root: string, output: string) {
  const canonical = await canonicalRoot(root);
  const target = await scopedPath(canonical, output);
  try { await lstat(target); throw fault("output-exists", "Output already exists. Choose another .mp4 filename."); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  return { root: canonical, output };
}
export async function openCapture(input: Pick<ExportVideo,"url"|"width"|"height">, signal?: AbortSignal) {
  let browser: Browser | undefined;
  let page: Page;
  let aborted = signal?.aborted ?? false;
  let encoder: ReturnType<typeof spawn> | undefined;
  const abort = () => { aborted = true; encoder?.kill("SIGKILL"); void browser?.close(); };
  const check = () => { if (aborted) throw fault("export-cancelled", "Video export cancelled; no output was published."); };
  signal?.addEventListener("abort", abort, { once: true });
  process.once("SIGINT", abort); process.once("SIGTERM", abort);
  const close = async () => {
    signal?.removeEventListener("abort", abort);
    process.removeListener("SIGINT", abort); process.removeListener("SIGTERM", abort);
    encoder?.kill("SIGKILL"); await browser?.close().catch(() => {});
  };
  try {
    check();
    try {
      const { chromium } = await import("playwright");
      browser = await chromium.launch({ headless: true, channel: "chromium" });
    } catch { throw fault("missing-chromium", "Install Playwright and its browser: npm install playwright && npx playwright install chromium."); }
    page = await browser.newPage({ viewport: { width: input.width, height: input.height }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(10_000);
    await page.route("**/*", route => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.isNavigationRequest() && (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.protocol !== 'http:')) return route.abort();
      return route.continue();
    });
    await page.goto(input.url, { waitUntil: "load", timeout: 30_000 });
    // Product chrome can visually overlap the capture rectangle. Hide its semantic
    // marker and host development-tools portal only in this private export page; the user's preview stays untouched.
    await page.addStyleTag({content:'[data-flute-preview-chrome],nextjs-portal{visibility:hidden!important}'});
    try { await page.waitForFunction(() => typeof (window as unknown as { __FLUTE_CAPTURE__?: CaptureBridge }).__FLUTE_CAPTURE__?.seek === "function", undefined, { timeout: 5000 }); }
    catch { throw fault("missing-capture", "This page has no ready Flute capture bridge. Open a scene with capture enabled and retry."); }
    await page.evaluate(async () => {
      await Promise.race([
        Promise.all([document.fonts.ready, ...Array.from(document.images).map(image => image.decode().catch(() => {}))]),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Scene assets did not become ready.")), 10_000)),
      ]);
    });
    return {
      close,
      manifest: () => page.evaluate(() => {
        const bridge = (window as unknown as { __FLUTE_CAPTURE__: CaptureBridge }).__FLUTE_CAPTURE__;
        return { version: bridge.version, durationMs: bridge.durationMs, selector: bridge.selector };
      }),
      async snapshot(timeMs:number, manifest:CaptureManifest){
        check();
        await page.waitForLoadState("networkidle",{timeout:10_000});
        await page.evaluate(()=>document.fonts.ready.then(()=>{}));
        const locator=page.locator(manifest.selector);
        if(await locator.count()!==1)throw fault("invalid-capture","Capture must identify exactly one scene viewport.");
        await page.evaluate(elapsed=>(window as unknown as {__FLUTE_CAPTURE__:CaptureBridge}).__FLUTE_CAPTURE__.seek(elapsed),timeMs);
        const rect=await locator.boundingBox();
        if(!rect||rect.width<1||rect.height<1||rect.width>3840||rect.height>3840)throw fault("invalid-capture","Scene viewport must be visible and bounded.");
        const png=await page.screenshot({clip:rect,type:"png",animations:"disabled",timeout:10_000});check();
        return "data:image/png;base64,"+png.toString("base64");
      },
      async encode(scope: { root: string; output: string }, options: ExportVideo, manifest: CaptureManifest, frames: number) {
        let temporary: string | undefined;
        try {
          check();
          const locator = page.locator(manifest.selector);
          if (await locator.count() !== 1) throw fault("invalid-capture", "Capture must identify exactly one visible scene viewport.");
          await locator.scrollIntoViewIfNeeded();
          const rect = await locator.boundingBox();
          if (!rect || rect.width < 1 || rect.height < 1 || rect.width > 3840 || rect.height > 3840) throw fault("invalid-capture", "Scene viewport must be visible and at most 3840 pixels per side.");
          const target = await scopedPath(scope.root, scope.output);
          await mkdir(path.dirname(target), { recursive: true });
          await scopedPath(scope.root, scope.output);
          temporary = await mkdtemp(path.join(path.dirname(target), ".flute-export-"));
          const video = path.join(temporary, "video.mp4");
          encoder = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-f", "image2pipe", "-framerate", String(options.fps), "-vcodec", "png", "-i", "pipe:0", "-an", "-vf", `scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease,pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-frames:v", String(frames), "-n", video], { cwd: scope.root, shell: false, stdio: ["pipe", "ignore", "pipe"] });
          const timeout = setTimeout(() => encoder?.kill("SIGKILL"), 15 * 60_000);
          let stderr = "";
          encoder.stderr?.on("data", chunk => { stderr = (stderr + chunk.toString()).slice(-4096); });
          const finished = new Promise<void>((resolve, reject) => {
            encoder!.once("error", () => { clearTimeout(timeout); reject(fault("missing-ffmpeg", "Install FFmpeg and ensure ffmpeg is available on PATH.")); });
            encoder!.once("close", code => { clearTimeout(timeout); code === 0 ? resolve() : reject(fault("encoding-failed", `FFmpeg failed. ${stderr.slice(-1000)}`)); });
          });
          void finished.catch(() => {});
          encoder.stdin!.on("error", () => {});
          for (let i = 0; i < frames; i++) {
            check();
            await page.evaluate(elapsed => (window as unknown as { __FLUTE_CAPTURE__: CaptureBridge }).__FLUTE_CAPTURE__.seek(elapsed), i * 1000 / options.fps);
            const png = await page.screenshot({clip:rect, type: "png", animations: "disabled", timeout: 10_000 });
            if(i>0 && i % (options.fps*2)===0) process.stderr.write(`Captured ${i}/${frames} frames\n`);
            await Promise.race([new Promise<void>((resolve, reject) => encoder!.stdin!.write(png, error => error ? reject(error) : resolve())), finished.then(() => { throw fault("encoding-failed", "Encoder stopped before all scene frames were written."); })]);
          }
          encoder.stdin!.end();
          await finished; check();
          await scopedPath(scope.root, scope.output);
          try { await link(video, target); }
          catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw fault("output-exists", "Output appeared during export. Choose another filename."); throw error; }
        } catch (error) { check(); throw error; }
        finally { encoder?.kill("SIGKILL"); if (temporary) await rm(temporary, { recursive: true, force: true }); }
      },
    };
  } catch (error) { await close(); check(); throw error; }
}

// Reuse scoped, compare-before-write project effects for cached recipe imagery.
export const readRecipe=readText;
export const writeRecipe=atomicWrite;
export function textBytes(text:string){return Buffer.byteLength(text,"utf8")}
