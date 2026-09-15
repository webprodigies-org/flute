import { z } from "zod";
import {OpenPreviewSchema} from "./project";
import { PreviewDefinitionSchema, presentPreview } from "./preview";
import type { SceneIssue } from "./scene";

/** SOURCE OF TRUTH: SceneRecipeSchema, loadSceneRecipes, SCENE_RECIPE_DIRECTORY,
 * ListScenesSchema, LoadSceneSchema, OpenSceneSchema, SnapshotSceneSchema, SceneSnapshotSchema.
 * WHAT: versioned JSON recipes and deterministic local scene catalog validation.
 * WHY: CLI and browser reopen identical metadata without executing component source.
 * WHERE: project/recipes supplies scoped files; the browser supplies JSON and binding paths.
 */
export const SCENE_RECIPE_DIRECTORY = "src/flute/scenes";
export const SceneRecipeIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase scene slug containing letters, digits and single hyphens.");
/** SOURCE OF TRUTH: ListScenesSchema, LoadSceneSchema, OpenSceneSchema.
 * WHAT: runtime contracts for trusted recipe operations.
 * WHY: CLI and command adapters consume the same RESOURCES entries.
 * WHERE: project/recipes executes these operations through scoped services.
 */
export const ListScenesSchema=z.strictObject({});
export const LoadSceneSchema=z.strictObject({sceneId:SceneRecipeIdSchema});
export const OpenSceneSchema=z.strictObject({...OpenPreviewSchema.shape,sceneId:SceneRecipeIdSchema});
export const SnapshotSceneSchema=z.strictObject({
 sceneId:SceneRecipeIdSchema,url:OpenPreviewSchema.shape.url,
 timeMs:z.number().finite().nonnegative().max(120_000).optional(),
});
// A bounded, inert PNG is local cached imagery, not an executing scene or remote URL.
export const SceneSnapshotSchema=z.strictObject({
 image:z.string().max(128_000).regex(/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/,"Use a Flute-generated PNG snapshot."),
 timeMs:z.number().finite().nonnegative().max(120_000),
});
export const SceneRecipeSchema = z.strictObject({
  version: z.literal(1),
  id: SceneRecipeIdSchema,
  title: z.string().trim().min(1),
  description: z.string().optional(),
  definition: PreviewDefinitionSchema,
  snapshot:SceneSnapshotSchema.optional(),
});
export type SceneRecipe = z.output<typeof SceneRecipeSchema>;
const BoundRecipeSchema = SceneRecipeSchema.extend({ source: z.string(), binding: z.string() });
type BoundRecipe = z.output<typeof BoundRecipeSchema>;
export type SceneCatalog = { scenes: BoundRecipe[]; selected?: BoundRecipe; issues: SceneIssue[] };
const CatalogInputSchema = z.strictObject({
  sources: z.array(z.unknown()).max(1024),
  bindingPaths: z.array(z.unknown()).max(1024),
  sceneId: z.string().optional(),
});
const SourceSchema = z.strictObject({ path: z.string(), document: z.unknown() });
const sourcePattern = /^src\/flute\/scenes\/([a-z0-9]+(?:-[a-z0-9]+)*)\.scene\.json$/;
const bindingPattern = /^src\/flute\/scenes\/[a-z0-9]+(?:-[a-z0-9]+)*\.[jt]sx$/;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function loadSceneRecipes(input: unknown): SceneCatalog {
  const parsed = CatalogInputSchema.safeParse(input);
  if (!parsed.success) return { scenes: [], issues: parsed.error.issues.map(issue => ({
    path: issue.path.join("."), message: issue.message,
  })) };
  const issues: SceneIssue[] = [];
  const bindings = new Set<string>();
  for (const [index, binding] of parsed.data.bindingPaths.entries()) {
    if (typeof binding === "string" && bindingPattern.test(binding)) bindings.add(binding);
    else issues.push({ path: `bindingPaths.${index}`, message: `Use a component path ${SCENE_RECIPE_DIRECTORY}/<id>.tsx.` });
  }
  // Count declared IDs before entry validation so a malformed duplicate cannot win by order.
  const ids = new Map<string, number>();
  for (const source of parsed.data.sources) {
    const entry = SourceSchema.safeParse(source);
    if (!entry.success) continue;
    const identity = z.object({ id: SceneRecipeIdSchema }).safeParse(entry.data.document);
    if (identity.success) ids.set(identity.data.id, (ids.get(identity.data.id) ?? 0) + 1);
  }
  const scenes: BoundRecipe[] = [];
  for (const [index, source] of parsed.data.sources.entries()) {
    const entry = SourceSchema.safeParse(source);
    if (!entry.success) {
      issues.push({ path: `sources.${index}`, message: "Supply a recipe source with a string path and JSON document." });
      continue;
    }
    const { path, document } = entry.data;
    const match = sourcePattern.exec(path);
    if (!match) {
      issues.push({ path, message: `Use ${SCENE_RECIPE_DIRECTORY}/<id>.scene.json without traversal or nested directories.` });
      continue;
    }
    const recipe = SceneRecipeSchema.safeParse(document);
    if (!recipe.success) {
      issues.push(...recipe.error.issues.map(issue => ({ path: `${path}:${issue.path.join(".")}`, message: issue.message })));
      continue;
    }
    const value = recipe.data;
    if ((ids.get(value.id) ?? 0) > 1) {
      issues.push({ path, message: `Duplicate scene ID "${value.id}". Give each recipe a unique ID and matching filename; all duplicates are excluded.` });
      continue;
    }
    if (value.id !== match[1]) {
      issues.push({ path, message: `Scene ID "${value.id}" must match filename "${match[1]}".` });
      continue;
    }
    const candidates = ["tsx", "jsx"].map(extension => `${SCENE_RECIPE_DIRECTORY}/${value.id}.${extension}`).filter(path => bindings.has(path));
    if (candidates.length > 1) {
      issues.push({path,message:"Keep only one JSX or TSX component for this scene."});
      continue;
    }
    const binding = candidates[0] ?? `${SCENE_RECIPE_DIRECTORY}/${value.id}.tsx`;
    if (!bindings.has(binding)) {
      issues.push({ path, message: `Missing local component ${binding}. Add its default component export to reopen this recipe.` });
      continue;
    }
    const preview = presentPreview(value.definition);
    if (!preview.valid) {
      issues.push(...preview.issues.map(issue => ({ path: `${path}:definition.${issue.path}`, message: issue.message })));
      continue;
    }
    scenes.push({ ...value, definition: preview.definition, source: path, binding });
  }
  scenes.sort((a, b) => compare(a.source, b.source) || compare(a.id, b.id));
  const sceneId = parsed.data.sceneId;
  const selected = sceneId === undefined ? undefined : scenes.find(scene => scene.id === sceneId);
  if (sceneId !== undefined && !selected) issues.push({ path: "sceneId", message: SceneRecipeIdSchema.safeParse(sceneId).success
    ? `Scene "${sceneId}" is unavailable. Check its recipe and component diagnostics or choose an available scene.`
    : "Use a lowercase scene slug containing letters, digits and single hyphens." });
  issues.sort((a, b) => compare(a.path, b.path) || compare(a.message, b.message));
  return { scenes, ...(selected ? { selected } : {}), issues };
}
