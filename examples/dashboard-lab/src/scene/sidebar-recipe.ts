import { matrixFor, TransformSchema, type MotionInput } from "@flute/scene"
import { sidebarSlots } from "./sidebar-layer"

// SOURCE OF TRUTH: authored sidebar shot. WHAT: tilt, camera rail and row entrances.
// WHY: moving along the dashboard's local Y axis keeps the camera following its
// tilted sidebar. WHERE: Flute owns matrix order, interpolation and focal rendering.
export const durationMs = 11000
export const dashboardTilt = TransformSchema.parse({ rotateX: 12, rotateY: -38, rotateZ: -14 })
const matrix = matrixFor(dashboardTilt)
function rail(y: number) {
  const x = -504
  return {
    x: matrix[0]! * x + matrix[1]! * y,
    y: matrix[4]! * x + matrix[5]! * y + 90,
    z: matrix[8]! * x + matrix[9]! * y - 620,
  }
}
const start = rail(-350), end = rail(345)
export const camera = { ...start, perspective: 1600 }
export const focus = { x: 0, y: -90, z: 620, radius: 105, falloff: 260, maxBlur: 7 }
export const sidebarMotion: MotionInput = {
  durationMs,
  tracks: [
    ...(["x", "y", "z"] as const).map(property => ({
      target: { kind: "camera" as const }, property,
      keyframes: [
        { timeMs: 0, value: start[property] },
        { timeMs: 700, value: start[property], easing: "linear" as const },
        { timeMs: 10200, value: end[property] },
        { timeMs: durationMs, value: end[property] },
      ],
    })),
    ...Object.values(sidebarSlots).map(slot => ({
      target: { kind: "surface" as const, id: slot.id }, property: "z" as const,
      keyframes: [
        { timeMs: 0, value: 190 },
        { timeMs: slot.at, value: 190, easing: "easeInOut" as const },
        { timeMs: slot.at + 900, value: 0 },
      ],
    })),
  ],
}
