import { z } from "zod";

/** SOURCE OF TRUTH: ExportVideoSchema, CaptureManifestSchema.
 * WHAT: runtime contracts for local video requests and the live browser capture bridge.
 * WHY: adapters and operations share validation without importing Node or motion policy.
 * WHERE: export/commands validates; export/services captures; React supplies the bridge.
 */
export const SUPPORTED_EXPORT_FPS = Object.freeze([30, 60, 120] as const);
export const ExportFrameRateSchema = z.union(SUPPORTED_EXPORT_FPS.map(fps => z.literal(fps)));
export const ExportVideoSchema = z.strictObject({
  url: z.url().regex(/^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?(?:[/?#]|$)/, "Use an HTTP loopback URL without credentials."),
  output: z.string().min(1).endsWith(".mp4").refine(value =>
    !value.includes("\\") && !value.includes("\0") && !/^[A-Za-z]:/.test(value)
    && value.split("/").every(part => part !== "" && part !== "." && part !== ".."),
  "Use a project-relative .mp4 path without traversal."),
  fps: ExportFrameRateSchema.default(60),
  width: z.number().int().min(64).max(3840).multipleOf(2).default(1440),
  height: z.number().int().min(64).max(3840).multipleOf(2).default(1000),
});
export const CaptureManifestSchema = z.strictObject({
  version: z.literal(1),
  durationMs: z.number().nonnegative().max(120_000),
  selector: z.literal('[data-flute-capture="scene"]'),
});
export const ExportVideoResultSchema = z.discriminatedUnion("success", [
  z.strictObject({ success: z.literal(true), data: z.strictObject({
    output: z.string(), fps: z.number(), frames: z.number().int(), durationMs: z.number(),
  }) }),
  z.strictObject({ success: z.literal(false), issues: z.array(z.strictObject({ code: z.string(), message: z.string() })) }),
]);
export type ExportVideo = z.output<typeof ExportVideoSchema>;
export type CaptureManifest = z.output<typeof CaptureManifestSchema>;
export type CaptureBridge = CaptureManifest & { seek: (elapsedMs: number) => void };
export type ExportVideoResult = z.output<typeof ExportVideoResultSchema>;
