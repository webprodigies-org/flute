import { ExportVideoSchema } from "./export";
import { InitProjectSchema, LoadProjectSchema, ValidateProjectSchema, OpenPreviewSchema } from "./project";
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
  "export-video": ExportVideoSchema,
  "init-project": InitProjectSchema,
  "load-project": LoadProjectSchema,
  "validate-project": ValidateProjectSchema,
  "open-preview": OpenPreviewSchema,
  "evaluate-spatial": evaluateScene,
  "evaluate-motion": evaluateMotion,
  "validate-definition": validateScene,
});
export type OperationId = keyof typeof RESOURCES;
