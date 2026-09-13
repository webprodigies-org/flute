import {
  TransformSchema,
  validateScene,
  type Transform,
  type TransformInput,
  type SceneIssue,
  CameraSchema,
  type CameraInput,
  type SceneDefinition,
} from "./scene";

/** SOURCE OF TRUTH: evaluateScene, transformToCss, cameraToCss, focusForSurface, sampleFocus, focusMask, uniformFocusBlur.
 * WHAT: camera-space transforms and progressive spatial focus for every renderer consumer.
 * WHY: one mathematical definition keeps DOM preview and future output adapters consistent.
 * WHERE: React registration provides untransformed layout measurements; no DOM or transport is imported here.
 */
export type Matrix = readonly number[];
export type Measurement = {
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
};
export type Measurements = Readonly<Record<string, Measurement>>;
export type EvaluatedNode = {
  id: string;
  world: Matrix;
  worldPosition: { x: number; y: number; z: number };
  blur: number;
  focus: FocusField;
  width: number;
  height: number;
};
export type Evaluation = {
  nodes: EvaluatedNode[];
  focusDepth: number;
  issues: SceneIssue[];
};
export function multiply(a: Matrix, b: Matrix): Matrix {
  return Array.from({ length: 16 }, (_, index) => {
    const row = Math.floor(index / 4),
      col = index % 4;
    return [0, 1, 2, 3].reduce(
      (sum, k) => sum + a[row * 4 + k] * b[k * 4 + col],
      0,
    );
  });
}
export function matrixFor(t: Transform): Matrix {
  const rad = Math.PI / 180;
  const [sx, cx, sy, cy, sz, cz] = [
    Math.sin(t.rotateX * rad),
    Math.cos(t.rotateX * rad),
    Math.sin(t.rotateY * rad),
    Math.cos(t.rotateY * rad),
    Math.sin(t.rotateZ * rad),
    Math.cos(t.rotateZ * rad),
  ];
  const translate = [1, 0, 0, t.x, 0, 1, 0, t.y, 0, 0, 1, t.z, 0, 0, 0, 1];
  const rx = [1, 0, 0, 0, 0, cx, -sx, 0, 0, sx, cx, 0, 0, 0, 0, 1];
  const ry = [cy, 0, sy, 0, 0, 1, 0, 0, -sy, 0, cy, 0, 0, 0, 0, 1];
  const rz = [cz, -sz, 0, 0, sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const scale = [
    t.scale,
    0,
    0,
    0,
    0,
    t.scale,
    0,
    0,
    0,
    0,
    t.scale,
    0,
    0,
    0,
    0,
    1,
  ];
  return [rx, ry, rz, scale].reduce(multiply, translate);
}
export function transformToCss(input: TransformInput = {}): string {
  const t = TransformSchema.parse(input);
  return `translate3d(${t.x}px, ${t.y}px, ${t.z}px) rotateX(${t.rotateX}deg) rotateY(${t.rotateY}deg) rotateZ(${t.rotateZ}deg) scale(${t.scale})`;
}
export function evaluateScene(
  input: unknown,
  measurements: Measurements = {},
): Evaluation {
  const parsed = validateScene(input);
  if (!parsed.success)
    return { nodes: [], focusDepth: 0, issues: parsed.issues };
  const scene = parsed.data;
  const nodeMap = new Map(scene.nodes.map((node) => [node.id, node]));
  const cache = new Map<string, Matrix>();
  const issues: SceneIssue[] = [];
  const camera = matrixFor(
    TransformSchema.parse(
      scene.camera
        ? {
            x: -scene.camera.x,
            y: -scene.camera.y,
            z: -scene.camera.z,
            rotateX: scene.camera.rotateX,
            rotateY: scene.camera.rotateY,
            rotateZ: scene.camera.rotateZ,
          }
        : {},
    ),
  );
  const getWorld = (id: string): Matrix => {
    const cached = cache.get(id);
    if (cached) return cached;
    const node = nodeMap.get(id)!;
    const size = measurements[id];
    const offsetX = size?.offsetX ?? 0,
      offsetY = size?.offsetY ?? 0;
    const validOffset = Number.isFinite(offsetX) && Number.isFinite(offsetY);
    if (!validOffset)
      issues.push({
        path: id,
        message: "Invalid layout measurement for " + id,
      });
    const local = matrixFor({
      ...node.transform,
      x: node.transform.x + (validOffset ? offsetX : 0),
      y: node.transform.y + (validOffset ? offsetY : 0),
    });
    const world = multiply(
      node.parentId ? getWorld(node.parentId) : camera,
      local,
    );
    cache.set(id, world);
    return world;
  };
  for (const node of scene.nodes) {
    if (!getWorld(node.id).every(Number.isFinite)) {
      return {
        nodes: [],
        focusDepth: 0,
        issues: [
          {
            path: node.id,
            message:
              "World transform exceeds numeric limits: reduce nested scale or position.",
          },
        ],
      };
    }
  }
  for (const node of scene.nodes) {
    const field = focusForSurface(getWorld(node.id), scene.focus);
    if (
      !Object.values(field).every(Number.isFinite) ||
      field.scale < 1e-8 ||
      !Number.isFinite((field.radius + field.falloff) / field.scale)
    )
      return {
        nodes: [],
        focusDepth: 0,
        issues: [
          {
            path: node.id,
            message:
              "Focal geometry exceeds numeric limits: reduce scale, position or focus radius.",
          },
        ],
      };
  }
  const focusDepth = scene.focus.z;
  const nodes = scene.nodes.map((node) => {
    const world = getWorld(node.id),
      z = world[11];
    const m = measurements[node.id];
    if (
      m &&
      (!Number.isFinite(m.width) ||
        !Number.isFinite(m.height) ||
        m.width <= 0 ||
        m.height <= 0)
    )
      issues.push({
        path: node.id,
        message: "Surface has no measurable area: " + node.id,
      });
    if (z >= scene.camera.perspective - 1)
      issues.push({
        path: node.id,
        message:
          "Surface reaches the camera plane: move " +
          node.id +
          " farther back.",
      });
    return {
      id: node.id,
      world,
      worldPosition: { x: world[3], y: world[7], z },
      focus: focusForSurface(world, scene.focus),
      blur: sampleFocus(focusForSurface(world, scene.focus), 0, 0),
      width: m?.width ?? 0,
      height: m?.height ?? 0,
    };
  });
  return { nodes, focusDepth, issues };
}

/** SOURCE OF TRUTH: FocusField, focusForSurface, sampleFocus, focusMask, uniformFocusBlur.
 * WHAT: a camera-space xyz focus point sampled continuously across a live plane.
 * WHY: one distance law drives masks and tests; an element center cannot describe
 * progressive sharpness. Camera-attached focus stays still as scene content moves.
 * WHERE: react/FocusFilter presents these masks on SourceGraphic without UI clones.
 * Units are scene pixels, origin is the scene center; positive z faces the viewer.
 */
export type FocusField = {
  x: number;
  y: number;
  perpendicular: number;
  scale: number;
  radius: number;
  falloff: number;
  maxBlur: number;
};
export function focusForSurface(
  m: Matrix,
  f: SceneDefinition["focus"],
): FocusField {
  const scale = Math.hypot(m[0], m[4], m[8]);
  const dx = f.x - m[3],
    dy = f.y - m[7],
    dz = f.z - m[11];
  return {
    x: (dx * m[0] + dy * m[4] + dz * m[8]) / (scale * scale),
    y: (dx * m[1] + dy * m[5] + dz * m[9]) / (scale * scale),
    perpendicular: Math.abs((dx * m[2] + dy * m[6] + dz * m[10]) / scale),
    scale,
    radius: f.radius,
    falloff: f.falloff,
    maxBlur: f.maxBlur,
  };
}
export function sampleFocus(f: FocusField, x: number, y: number): number {
  const distance = Math.hypot(
    (x - f.x) * f.scale,
    (y - f.y) * f.scale,
    f.perpendicular,
  );
  const t = Math.max(0, Math.min(1, (distance - f.radius) / f.falloff));
  return f.maxBlur * t * t * (3 - 2 * t);
}
/** Uniform field fast path. A whole visual leaf outside the transition needs one
 * Gaussian, and a wholly sharp leaf needs none. Include the filter's support area
 * so a nearby gradient cannot be incorrectly discarded at the leaf's edges.
 * The progressive distance law remains sampleFocus; this only classifies bounds.
 */
export function uniformFocusBlur(f: FocusField, width: number, height: number): number | undefined {
  if (f.maxBlur === 0) return 0;
  const pad = 3 * f.maxBlur / f.scale;
  const halfWidth = width / 2 + pad, halfHeight = height / 2 + pad;
  const nearestX = Math.max(-halfWidth, Math.min(halfWidth, f.x));
  const nearestY = Math.max(-halfHeight, Math.min(halfHeight, f.y));
  if (sampleFocus(f, nearestX, nearestY) === f.maxBlur) return f.maxBlur / f.scale;
  const farthestX = f.x >= 0 ? -halfWidth : halfWidth;
  const farthestY = f.y >= 0 ? -halfHeight : halfHeight;
  if (sampleFocus(f, farthestX, farthestY) === 0) return 0;
  return undefined;
}
export const FOCUS_BANDS = 6;
// Adjacent Gaussian levels blend with weights summing to one. The spatial field
// is continuous; the finite Gaussian basis is an approximation, not optical DOF.
export function focusMask(
  f: FocusField,
  width: number,
  height: number,
  band: number,
) {
  const extent = Math.max(1, (f.radius + f.falloff) / f.scale);
  return {
    x: f.x + width / 2,
    y: f.y + height / 2,
    radius: extent,
    stops: Array.from({ length: 33 }, (_, i) => {
      const b =
        f.maxBlur === 0
          ? 0
          : (sampleFocus(f, f.x + (i / 32) * extent, f.y) / f.maxBlur) *
            FOCUS_BANDS;
      return Math.max(0, 1 - Math.abs(b - band));
    }),
  };
}
export function cameraToCss(input: CameraInput = {}): string {
  const c = CameraSchema.parse(input);
  return transformToCss({
    x: -c.x,
    y: -c.y,
    z: -c.z,
    rotateX: c.rotateX,
    rotateY: c.rotateY,
    rotateZ: c.rotateZ,
  });
}
