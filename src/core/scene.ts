import { z } from 'zod';

/** SOURCE OF TRUTH: SceneSchema, NodeSchema, TransformSchema.
 * WHAT: versioned spatial data, defaults and validation; exported types derive here.
 * WHY: renderer and future project adapters must accept the same contract.
 * WHERE: core/spatial.ts evaluates it; react/ binds live components without serializing them.
 */
const finite = z.number().finite();
const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/, 'Use a stable alphanumeric ID.');
export const TransformSchema = z.strictObject({
  x: finite.default(0), y: finite.default(0), z: finite.default(0),
  rotateX: finite.default(0), rotateY: finite.default(0), rotateZ: finite.default(0),
  scale: finite.positive().max(100).default(1),
});
export const NodeSchema = z.strictObject({
  id, parentId: id.optional(), transform: TransformSchema.prefault({}),
});
export const CameraSchema = z.strictObject({
  perspective: finite.min(100).max(10000).default(1400),
  rotateX: finite.default(0), rotateY: finite.default(0), rotateZ: finite.default(0),
});
export const FocusSchema = z.strictObject({
  targetId: id.optional(), depth: finite.default(0),
  range: finite.nonnegative().default(24),
  falloff: finite.positive().default(55),
  maxBlur: finite.min(0).max(32).default(10),
});
export const SceneSchema = z.strictObject({
  version: z.literal(1).default(1),
  camera: CameraSchema.prefault({}),
  focus: FocusSchema.prefault({}),
  nodes: z.array(NodeSchema).max(1000),
}).superRefine((scene, ctx) => {
  const nodes = new Map<string, (typeof scene.nodes)[number]>();
  for (const [index, node] of scene.nodes.entries()) {
    if (nodes.has(node.id)) ctx.addIssue({ code: 'custom', path: ['nodes', index, 'id'], message: 'Duplicate surface ID: ' + node.id });
    nodes.set(node.id, node);
  }
  for (const [index, node] of scene.nodes.entries()) {
    if (node.parentId && !nodes.has(node.parentId)) ctx.addIssue({ code: 'custom', path: ['nodes', index, 'parentId'], message: 'Missing parent: ' + node.parentId });
    const seen = new Set([node.id]);
    let parent = node.parentId;
    while (parent && nodes.has(parent)) {
      if (seen.has(parent)) { ctx.addIssue({ code: 'custom', path: ['nodes', index, 'parentId'], message: 'Cyclic surface hierarchy at ' + node.id }); break; }
      seen.add(parent);
      parent = nodes.get(parent)?.parentId;
    }
  }
  if (scene.focus.targetId && !nodes.has(scene.focus.targetId)) ctx.addIssue({ code: 'custom', path: ['focus', 'targetId'], message: 'Focus target is not registered: ' + scene.focus.targetId });
});
export type SceneDefinition = z.output<typeof SceneSchema>;
export type SceneInput = z.input<typeof SceneSchema>;
export type NodeDefinition = z.output<typeof NodeSchema>;
export type Transform = z.output<typeof TransformSchema>;
export type TransformInput = z.input<typeof TransformSchema>;
export type CameraInput = z.input<typeof CameraSchema>;
export type FocusInput = z.input<typeof FocusSchema>;
export type SceneIssue = { path: string; message: string };
export function validateScene(input: unknown): { success: true; data: SceneDefinition } | { success: false; issues: SceneIssue[] } {
  const result = SceneSchema.safeParse(input);
  return result.success ? { success: true, data: result.data } : {
    success: false, issues: result.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })),
  };
}
