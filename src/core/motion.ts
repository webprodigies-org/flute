import { z } from "zod";
import type { SceneIssue } from "./scene";

/** SOURCE OF TRUTH: MotionSchema, evaluateMotion, explicit scene time.
 * WHAT: typed motion tracks, target/property validation and deterministic interpolation.
 * WHY: all callers must evaluate the same frame without clocks or mutable playback state.
 * WHERE: core/motion.ts owns motion; core/scene.ts validates merged scene values;
 * React/runtime adapters resolve registered surfaces and consume these partial overrides.
 */
const finite = z.number().finite();
const spatialProperties = {
  x: finite, y: finite, z: finite,
  rotateX: finite, rotateY: finite, rotateZ: finite,
};
const SurfaceMotionSchema = z.strictObject({
  ...spatialProperties,
  scale: finite.positive().max(100),
  opacity: finite.min(0).max(1),
});
const CameraMotionSchema = z.strictObject(spatialProperties);
const FocusMotionSchema = z.strictObject({
  x: finite, y: finite, z: finite,
  radius: finite.nonnegative(),
  falloff: finite.positive(),
  maxBlur: finite.min(0).max(32),
});
export const MotionKeyframeSchema = z.strictObject({
  timeMs: finite.nonnegative(),
  value: finite,
  // Easing applies from this keyframe to the next; omission means linear.
  easing: z.enum(["linear", "easeInOut"]).optional(),
});
const keyframes = z.array(MotionKeyframeSchema).min(1);
export const MotionTrackSchema = z.union([
  z.strictObject({
    target: z.strictObject({ kind: z.literal("surface"), id: z.string().min(1) }),
    property: SurfaceMotionSchema.keyof(), keyframes,
  }),
  z.strictObject({
    target: z.strictObject({ kind: z.literal("camera") }),
    property: CameraMotionSchema.keyof(), keyframes,
  }),
  z.strictObject({
    target: z.strictObject({ kind: z.literal("focus") }),
    property: FocusMotionSchema.keyof(), keyframes,
  }),
]).superRefine((track, ctx) => {
  const properties = track.target.kind === "surface" ? SurfaceMotionSchema
    : track.target.kind === "camera" ? CameraMotionSchema : FocusMotionSchema;
  for (const [index, frame] of track.keyframes.entries()) {
    const value = properties.partial().safeParse({ [track.property]: frame.value });
    if (!value.success) {
      for (const issue of value.error.issues) ctx.addIssue({
        code: "custom", path: ["keyframes", index, "value"], message: issue.message,
      });
    }
    if (index > 0 && frame.timeMs <= track.keyframes[index - 1].timeMs) ctx.addIssue({
      code: "custom", path: ["keyframes", index, "timeMs"],
      message: "Keyframe times must be strictly increasing and distinct.",
    });
  }
});
export const MotionSchema = z.strictObject({
  durationMs: finite.nonnegative(),
  tracks: z.array(MotionTrackSchema),
}).superRefine((motion, ctx) => {
  const seen = new Set<string>();
  for (const [index, track] of motion.tracks.entries()) {
    const key = JSON.stringify([track.target.kind,
      track.target.kind === "surface" ? track.target.id : null, track.property]);
    if (seen.has(key)) ctx.addIssue({
      code: "custom", path: ["tracks", index],
      message: "Duplicate target/property track.",
    });
    seen.add(key);
    for (const [frameIndex, frame] of track.keyframes.entries()) {
      if (frame.timeMs > motion.durationMs) ctx.addIssue({
        code: "custom", path: ["tracks", index, "keyframes", frameIndex, "timeMs"],
        message: "Keyframe time exceeds scene duration.",
      });
    }
  }
});
export type MotionInput = z.input<typeof MotionSchema>;
export type MotionDefinition = z.output<typeof MotionSchema>;
export type MotionTrack = z.output<typeof MotionTrackSchema>;
export type MotionState = {
  surfaces: Record<string, Partial<z.output<typeof SurfaceMotionSchema>>>;
  camera: Partial<z.output<typeof CameraMotionSchema>>;
  focus: Partial<z.output<typeof FocusMotionSchema>>;
  issues: SceneIssue[];
};

function interpolate(frames: MotionTrack["keyframes"], timeMs: number): number {
  if (timeMs <= frames[0].timeMs) return frames[0].value;
  for (let index = 1; index < frames.length; index++) {
    const end = frames[index];
    if (timeMs > end.timeMs) continue;
    if (timeMs === end.timeMs) return end.value;
    const start = frames[index - 1];
    const progress = (timeMs - start.timeMs) / (end.timeMs - start.timeMs);
    const weight = start.easing === "easeInOut"
      ? progress * progress * (3 - 2 * progress) : progress;
    // Same-sign deltas preserve positive subnormals; convex weights avoid overflow
    // when opposite finite extremes make (end.value - start.value) infinite.
    if ((start.value >= 0 && end.value >= 0) || (start.value <= 0 && end.value <= 0)) {
      return start.value + (end.value - start.value) * weight;
    }
    return (1 - weight) * start.value + weight * end.value;
  }
  return frames[frames.length - 1].value;
}

/** Invalid input yields diagnostics and no overrides; finite time clamps to the scene.
 * Tracks hold their endpoints outside their own keyframe interval. Rotations interpolate
 * numerically in degrees (so authored multi-turn rotations retain their intent).
 */
export function evaluateMotion(input: unknown, timeMs: number): MotionState {
  const result: MotionState = { surfaces: {}, camera: {}, focus: {}, issues: [] };
  const parsed = MotionSchema.safeParse(input);
  if (!parsed.success) result.issues.push(...parsed.error.issues.map(issue => ({
    path: issue.path.join("."), message: issue.message,
  })));
  if (!Number.isFinite(timeMs)) result.issues.push({
    path: "timeMs", message: "Scene time must be a finite number.",
  });
  if (!parsed.success || result.issues.length) return result;
  const time = Math.min(parsed.data.durationMs, Math.max(0, timeMs));
  for (const track of parsed.data.tracks) {
    const value = interpolate(track.keyframes, time);
    if (track.target.kind === "surface") {
      const id = track.target.id;
      // Own data properties support arbitrary IDs without reading/writing Object.prototype.
      const prior = Object.hasOwn(result.surfaces, id) ? result.surfaces[id] : {};
      Object.defineProperty(result.surfaces, id, {
        value: { ...prior, [track.property]: value },
        enumerable: true, configurable: true, writable: true,
      });
    } else if (track.target.kind === "camera") {
      result.camera = { ...result.camera, [track.property]: value };
    } else {
      result.focus = { ...result.focus, [track.property]: value };
    }
  }
  return result;
}
