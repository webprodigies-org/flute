import {RESOURCES} from "../core/resources";
import { SCENE_RECIPE_DIRECTORY, type SceneCatalog } from "../core/recipes";
import type { SceneIssue } from "../core/scene";
import { executeProjectCommand } from "./commands";
import * as services from "./services";

/** SOURCE OF TRUTH: executeRecipeCommand scoped scene discovery and reopening.
 * WHAT: read fixed-directory recipes, validate the shared catalog and open a selected scene.
 * WHY: CLI adapters cannot bypass recipe validation or existing dev-server identity checks.
 * WHERE: core/recipes owns recipe policy; project/services alone reads files and opens browsers.
 * Lists succeed with individual diagnostics; load/open fail when selection is unavailable.
 * Discovery stops at 256 directory entries; each JSON read is limited to 256000 bytes.
 */
export type RecipeCommandResult = { success: true; data: SceneCatalog & { url?: string } }
  | { success: false; issues: SceneIssue[] };
function diagnostic(error: unknown, target = ""): SceneIssue {
  const known = error instanceof Error && "code" in error && "target" in error;
  return { path: known && typeof error.target === "string" ? error.target : target,
    message: known ? error.message : "Unable to read the local scene source. Check files and permissions, then retry." };
}
async function discover(root: string, sceneId?: string): Promise<SceneCatalog> {
  const paths = await services.scanDirectory(root, SCENE_RECIPE_DIRECTORY, 256);
  const sources: { path: string; document: unknown }[] = [];
  const bindingPaths: string[] = [];
  const issues: SceneIssue[] = [];
  for (const path of paths) {
    if (path.endsWith(".tsx")) {
      try { if (await services.isRegularFile(root, path)) bindingPaths.push(path); }
      catch (error) { issues.push(diagnostic(error, path)); }
    } else if (path.endsWith(".scene.json")) {
      try {
        const text = await services.readText(root, path, 256_000);
        if (text === undefined) {
          issues.push({ path, message: "Recipe disappeared during discovery. Restore it or refresh the scene list." });
          continue;
        }
        let document: unknown;
        try { document = JSON.parse(text); }
        catch {
          issues.push({ path, message: "Invalid recipe JSON. Correct its syntax and reload the scene list." });
          continue;
        }
        sources.push({ path, document });
      } catch (error) { issues.push(diagnostic(error, path)); }
    }
  }
  const catalog = RESOURCES["resolve-recipes"]({ sources, bindingPaths, ...(sceneId === undefined ? {} : { sceneId }) });
  return { ...catalog, issues: [...issues, ...catalog.issues].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) };
}
export async function executeRecipeCommand(
  operation: "list-scenes" | "load-scene" | "open-scene", input: unknown, context: { root: string },
): Promise<RecipeCommandResult> {
  const schema = operation === "list-scenes" ? RESOURCES["list-scenes"] : operation === "load-scene" ? RESOURCES["load-scene"]
    : operation === "open-scene" ? RESOURCES["open-scene"] : undefined;
  if (!schema) return { success: false, issues: [{ path: "operation", message: "Unknown scene operation." }] };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, issues: parsed.error.issues.map(issue => ({
    path: issue.path.join("."), message: issue.message,
  })) };
  try {
    if (!context || typeof context.root !== "string") return { success: false, issues: [{ path: "root", message: "Provide an absolute local project directory." }] };
    const root = await services.canonicalRoot(context.root);
    const sceneId = "sceneId" in parsed.data ? parsed.data.sceneId : undefined;
    const catalog = await discover(root, sceneId);
    if (operation !== "list-scenes" && !catalog.selected) return { success: false, issues: catalog.issues };
    if (operation === "open-scene" && "url" in parsed.data) {
      const opened = await executeProjectCommand("open-preview", { url: parsed.data.url, launch: false }, { root });
      if (!opened.success) return { success: false, issues: opened.issues.map(issue => ({ path: issue.path ?? "url", message: issue.message })) };
      if (!opened.data.url) return { success: false, issues: [{ path: "url", message: "Preview verification returned no URL. Run flute validate and retry." }] };
      const url = new URL(opened.data.url);
      url.searchParams.set("flute-scene", catalog.selected!.id);
      if (parsed.data.launch) await services.openBrowser(root, url.href);
      return { success: true, data: { ...catalog, url: url.href } };
    }
    return { success: true, data: catalog };
  } catch (error) { return { success: false, issues: [diagnostic(error)] }; }
}
