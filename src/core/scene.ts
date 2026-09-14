import { z } from "zod";

// SOURCE OF TRUTH: the spatial viewport is a black void; host surface paint remains unchanged.
export const SCENE_BACKGROUND = "#000000" as const;

/** SOURCE OF TRUTH: SceneSchema, NodeSchema, TransformSchema, SCENE_BACKGROUND.
 * WHAT: versioned spatial data, black void backdrop and validation; types derive here.
 * WHY: renderer and future project adapters must accept the same contract.
 * WHERE: core/spatial.ts evaluates it; react/ binds live components without serializing them.
 */
const finite = z.number().finite();
const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/, "Use a stable alphanumeric ID.");
export const TransformSchema = z.strictObject({
  x: finite.default(0),
  y: finite.default(0),
  z: finite.default(0),
  rotateX: finite.default(0),
  rotateY: finite.default(0),
  rotateZ: finite.default(0),
  scale: finite.positive().max(100).default(1),
});
export const NodeSchema = z.strictObject({
  id,
  parentId: id.optional(),
  transform: TransformSchema.prefault({}),
});
export const CameraSchema = z.strictObject({
  x: finite.default(0),
  y: finite.default(0),
  z: finite.default(0),
  perspective: finite.min(100).max(10000).default(1400),
  rotateX: finite.default(0),
  rotateY: finite.default(0),
  rotateZ: finite.default(0),
});
/** SOURCE OF TRUTH: camera depth-of-field controls. Distance and focalLength
 * share scene units; fStop controls aperture. The renderer owns kernel quality. */
export const FocusSchema = z.strictObject({
  distance: finite.positive().default(1400),
  fStop: finite.min(0.7).max(128).default(8),
  focalLength: finite.min(1).max(300).default(50),
  maxBlur: finite.min(0).max(32).default(6),
});
export const SceneSchema = z
  .strictObject({
    version: z.literal(3).default(3),
    camera: CameraSchema.prefault({}),
    focus: FocusSchema.prefault({}),
    nodes: z.array(NodeSchema).max(1000),
  })
  .superRefine((scene, ctx) => {
    if (scene.focus.distance > 0 && scene.focus.distance <= scene.focus.focalLength)
      ctx.addIssue({code:"custom",path:["focus","distance"],message:"Focus distance must exceed focal length."});
    const nodes = new Map<string, (typeof scene.nodes)[number]>();
    for (const [index, node] of scene.nodes.entries()) {
      if (nodes.has(node.id))
        ctx.addIssue({
          code: "custom",
          path: ["nodes", index, "id"],
          message: "Duplicate surface ID: " + node.id,
        });
      nodes.set(node.id, node);
    }
    for (const [index, node] of scene.nodes.entries()) {
      if (node.parentId && !nodes.has(node.parentId))
        ctx.addIssue({
          code: "custom",
          path: ["nodes", index, "parentId"],
          message: "Missing parent: " + node.parentId,
        });
      const seen = new Set([node.id]);
      let parent = node.parentId;
      while (parent && nodes.has(parent)) {
        if (seen.has(parent)) {
          ctx.addIssue({
            code: "custom",
            path: ["nodes", index, "parentId"],
            message: "Cyclic surface hierarchy at " + node.id,
          });
          break;
        }
        seen.add(parent);
        parent = nodes.get(parent)?.parentId;
      }
    }
  });
export type SceneDefinition = z.output<typeof SceneSchema>;
export type SceneInput = z.input<typeof SceneSchema>;
export type NodeDefinition = z.output<typeof NodeSchema>;
export type Transform = z.output<typeof TransformSchema>;
export type TransformInput = z.input<typeof TransformSchema>;
export type CameraInput = z.input<typeof CameraSchema>;
export type FocusInput = z.input<typeof FocusSchema>;
export type SceneIssue = { path: string; message: string };
export function validateScene(
  input: unknown,
):
  | { success: true; data: SceneDefinition }
  | { success: false; issues: SceneIssue[] } {
  const result = SceneSchema.safeParse(input);
  return result.success
    ? { success: true, data: result.data }
    : {
        success: false,
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      };
}
