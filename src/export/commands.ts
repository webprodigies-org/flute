import { RESOURCES } from "../core/resources";
import { CaptureManifestSchema, type ExportVideoResult } from "../core/export";
import { SceneRecipeSchema, SceneSnapshotSchema } from "../core/recipes";
import {executeRecipeCommand} from "../project/recipes";
import { fault } from "../project/errors";
import * as services from "./services";

/** SOURCE OF TRUTH: executeVideoExport, executeSceneSnapshot trusted operations.
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
    if(manifest.data.durationMs===0)throw fault("invalid-capture","Video export needs a scene with a nonzero duration. Static scenes support snapshots.");
    const frames = Math.ceil(manifest.data.durationMs * parsed.data.fps / 1000);
    await session.encode(scope, parsed.data, manifest.data, frames);
    return { success: true, data: { output: parsed.data.output, fps: parsed.data.fps, frames, durationMs: frames * 1000 / parsed.data.fps } };
  } catch (error) {
    const known = error as { code?: string; message?: string };
    return { success: false, issues: [{ code: known.code ?? "export-failed", message: known.code && known.message ? known.message : "Video export failed. Check the local scene server and retry." }] };
  } finally { await session?.close(); }
}

/** Capture one canonical frame and save it with the recipe, never mount scenes in list tiles. */
export async function executeSceneSnapshot(input:unknown,context:{root:string;signal?:AbortSignal}){
 let session:Awaited<ReturnType<typeof services.openCapture>>|undefined;
 try{
  const parsed=RESOURCES["snapshot-scene"].safeParse(input);
  if(!parsed.success)return {success:false as const,issues:parsed.error.issues.map(i=>({code:"invalid-snapshot",message:`${i.path.join(".")}: ${i.message}`}))};
  const opened=await executeRecipeCommand("open-scene",{sceneId:parsed.data.sceneId,url:parsed.data.url,launch:false},context);
  if(!opened.success)return {success:false as const,issues:opened.issues.map(i=>({code:"invalid-scene",message:i.message}))};
  const selected=opened.data.selected!;
  const original=await services.readRecipe(context.root,selected.source,256_000);
  if(!original)throw fault("source-changed","Scene source disappeared. Restore it and retry.");
  const recipe=SceneRecipeSchema.parse(JSON.parse(original));
  if(recipe.id!==selected.id||JSON.stringify(recipe.definition)!==JSON.stringify(selected.definition))throw fault("source-changed","Scene source changed. Retry the snapshot.");
  // Small cached image; keep the authored aspect ratio and canonical playback clock.
  const width=320, height=Math.max(64,Math.min(640,Math.round(width*recipe.definition.height/recipe.definition.width)));
  session=await services.openCapture({url:opened.data.url!,width,height},context.signal);
  const manifest=CaptureManifestSchema.parse(await session.manifest());
  const timeMs=parsed.data.timeMs??manifest.durationMs/2;
  if(timeMs>manifest.durationMs)throw fault("invalid-snapshot","Snapshot time must be within the scene duration.");
  const snapshot=SceneSnapshotSchema.parse({image:await session.snapshot(timeMs,manifest),timeMs});
  if(context.signal?.aborted)throw fault("export-cancelled","Snapshot cancelled; no image was saved.");
  const content=JSON.stringify({...JSON.parse(original),snapshot},null,2)+"\n";
  if(services.textBytes(content)>256_000)throw fault("snapshot-too-large","Recipe and snapshot exceed 256000 bytes. Simplify the scene source before retrying.");
  await services.writeRecipe(context.root,selected.source,content,original);
  return {success:true as const,data:{sceneId:recipe.id,source:selected.source,timeMs}};
 }catch(error){
  const known=error as {code?:string;message?:string};
  return {success:false as const,issues:[{code:known.code??"snapshot-failed",message:known.code&&known.message?known.message:"Snapshot failed. Check the scene, browser installation and source, then retry."}]};
 }finally{await session?.close()}
}
