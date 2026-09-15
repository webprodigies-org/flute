import {SnapshotSceneSchema,loadSceneRecipes,ListScenesSchema,LoadSceneSchema,OpenSceneSchema} from "./recipes";
import { presentPreview } from "./preview";
import { getAuthoringGuide, reviewAuthoring } from "./authoring";
import { ExportVideoSchema } from "./export";
import { InitProjectSchema, SyncProjectSchema, LoadProjectSchema, ValidateProjectSchema, OpenPreviewSchema } from "./project";
import { evaluateScene } from "./spatial";
import { evaluateMotion } from "./motion";
import { validateScene } from "./scene";
/** SOURCE OF TRUTH: RESOURCES operation identities.
 * WHAT: bind current scene operations to their canonical implementations.
 * WHY: adapters share one operation registry instead of inventing parallel policy.
 * WHERE: React calls these operations; Board contracts record the same identities.
 * This local renderer has no permissions, product account or navigation gates.
 */
export const RESOURCES = Object.freeze({
  "present-preview": presentPreview,
  "resolve-recipes":loadSceneRecipes,
  "list-scenes":ListScenesSchema,
  "load-scene":LoadSceneSchema,
  "open-scene":OpenSceneSchema,
  "snapshot-scene":SnapshotSceneSchema,
  "authoring-guide": getAuthoringGuide,
  "review-authoring": reviewAuthoring,
  "export-video": ExportVideoSchema,
  "init-project": InitProjectSchema,
  "sync-project": SyncProjectSchema,
  "load-project": LoadProjectSchema,
  "validate-project": ValidateProjectSchema,
  "open-preview": OpenPreviewSchema,
  "evaluate-spatial": evaluateScene,
  "evaluate-motion": evaluateMotion,
  "validate-definition": validateScene,
});
export type OperationId = keyof typeof RESOURCES;
