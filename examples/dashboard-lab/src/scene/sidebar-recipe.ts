import { matrixFor, TransformSchema, motionDuration, createCascadeTracks, cinematicTimeAtProgress, type MotionInput } from "@flute/scene"
import { sidebarSlots } from "./sidebar-layer"

// SOURCE OF TRUTH: this shot binds the live sidebar to shared cinematic defaults.
// Camera and entrances share one soft travel curve; core owns easing/speed/cascade.
const authoredDurationMs = 11000
export const durationMs = motionDuration({durationMs:authoredDurationMs,tracks:[]})
export const dashboardTilt = TransformSchema.parse({ rotateX: 12, rotateY: -38, rotateZ: -14 })
const matrix = matrixFor(dashboardTilt)
function rail(y: number, compact: boolean) {
  const x = -504
  return {
    x: matrix[0]! * x + matrix[1]! * y - (compact ? 100 : 0),
    y: matrix[4]! * x + matrix[5]! * y + 90,
    z: matrix[8]! * x + matrix[9]! * y - (compact ? 360 : 620),
  }
}
export function createSidebarShot(compact = false, cascade = true) {
  const start = rail(-485, compact), end = rail(425, compact)
  const camera = { ...start, perspective: 1600 }
  const focus = { distance: compact ? 1240 : 980, fStop:5.6, maxBlur:6 }
  const entrances = createCascadeTracks({
    items: Object.values(sidebarSlots).map(slot=>({id:slot.id,
      atMs: Math.max(0, cinematicTimeAtProgress((slot.y+485)/910)*authoredDurationMs-1800),
    })), cascade, depth:65, depthStep:9, entranceMs:1800,
  })
  const motion: MotionInput = {
    durationMs: authoredDurationMs,
    tracks: [
      ...(["x", "y", "z"] as const).map(property => ({
        target: { kind: "camera" as const }, property,
        keyframes: [{ timeMs: 0, value: start[property] },{ timeMs: authoredDurationMs, value: end[property] }],
      })), ...entrances,
    ],
  }
  return {camera,focus,motion}
}
