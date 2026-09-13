import { RESOURCES } from "../core/resources";
import { CaptureManifestSchema, type ExportVideoResult } from "../core/export";
import { fault } from "../project/errors";
import * as services from "./services";

/** SOURCE OF TRUTH: executeVideoExport trusted operation.
 * WHAT: validate requests, local scope and capture state before publishing video.
 * WHY: CLI and other callers must share the same export policy and canonical scene clock.
 * WHERE: cli/index adapts arguments; services owns all browser/filesystem/process effects.
 */
export async function executeVideoExport(input: unknown, context: { root: string; signal?: AbortSignal }): Promise<ExportVideoResult> {
  let session: Awaited<ReturnType<typeof services.openCapture>> | undefined;
  try {
    const parsed = RESOURCES["export-video"].safeParse(input);
    if (!parsed.success) return { success: false, issues: parsed.error.issues.map(i => ({ code: "invalid-export", message: `${i.path.join(".")}: ${i.message}` })) };
    services.validateTarget(parsed.data.output);
    const scope = await services.prepareScope(context.root, parsed.data.output);
    session = await services.openCapture(parsed.data, context.signal);
    const manifest = CaptureManifestSchema.safeParse(await session.manifest());
    if (!manifest.success) throw fault("invalid-capture", "Scene capture bridge must use version 1, the scene viewport selector and a duration between 0 and 120 seconds.");
    const frames = Math.ceil(manifest.data.durationMs * parsed.data.fps / 1000);
    await session.encode(scope, parsed.data, manifest.data, frames);
    return { success: true, data: { output: parsed.data.output, fps: parsed.data.fps, frames, durationMs: frames * 1000 / parsed.data.fps } };
  } catch (error) {
    const known = error as { code?: string; message?: string };
    return { success: false, issues: [{ code: known.code ?? "export-failed", message: known.code && known.message ? known.message : "Video export failed. Check the local scene server and retry." }] };
  } finally { await session?.close(); }
}
