import { z } from "zod";
import { SceneSchema, type SceneIssue } from "./scene";
import { MotionSchema } from "./motion";
import { reviewAuthoring } from "./authoring";

/** SOURCE OF TRUTH: PreviewDefinitionSchema, presentPreview.
 * WHAT: validate a source-authored preview revision using existing scene/motion owners.
 * WHY: every preview entry accepts the same data and rejects an invalid revision.
 * WHERE: preview/session retains the last valid revision; React still registers live UI.
 */
export const PreviewDefinitionSchema = z.strictObject({
  scene: SceneSchema,
  motion: MotionSchema.optional(),
  width: z.number().finite().positive().max(7680).default(1400),
  height: z.number().finite().positive().max(7680).default(980),
});
export type PreviewDefinitionInput = z.input<typeof PreviewDefinitionSchema>;
export type PreviewDefinition = z.output<typeof PreviewDefinitionSchema>;
export function presentPreview(input: unknown):
  { valid: true; definition: PreviewDefinition; issues: SceneIssue[] } |
  { valid: false; issues: SceneIssue[] } {
  const parsed = PreviewDefinitionSchema.safeParse(input);
  if (!parsed.success) return { valid: false, issues: parsed.error.issues.map(issue => ({
    path: issue.path.join("."), message: issue.message,
  })) };
  const review = reviewAuthoring({scene: parsed.data.scene,
    motion: parsed.data.motion ?? {durationMs: 0, tracks: []}});
  return review.valid ? {valid: true, definition: parsed.data, issues: []}
    : {valid: false, issues: review.issues};
}
