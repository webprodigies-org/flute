import { TransformSchema, validateScene, type Transform, type TransformInput, type SceneIssue } from './scene';

/** SOURCE OF TRUTH: evaluateScene, transformToCss.
 * WHAT: world transforms and bounded depth blur for every renderer consumer.
 * WHY: one mathematical definition keeps DOM preview and future output adapters consistent.
 * WHERE: React registration provides untransformed layout measurements; no DOM or transport is imported here.
 */
export type Matrix = readonly number[];
export type Measurement = { width: number; height: number; offsetX?: number; offsetY?: number };
export type Measurements = Readonly<Record<string, Measurement>>;
export type EvaluatedNode = { id: string; world: Matrix; worldPosition: { x: number; y: number; z: number }; blur: number; width: number; height: number };
export type Evaluation = { nodes: EvaluatedNode[]; focusDepth: number; issues: SceneIssue[] };
const identity = (): Matrix => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
export function multiply(a: Matrix, b: Matrix): Matrix {
  return Array.from({ length: 16 }, (_, index) => {
    const row = Math.floor(index / 4), col = index % 4;
    return [0,1,2,3].reduce((sum, k) => sum + a[row * 4 + k] * b[k * 4 + col], 0);
  });
}
function matrixFor(t: Transform): Matrix {
  const rad = Math.PI / 180;
  const [sx,cx,sy,cy,sz,cz] = [Math.sin(t.rotateX*rad),Math.cos(t.rotateX*rad),Math.sin(t.rotateY*rad),Math.cos(t.rotateY*rad),Math.sin(t.rotateZ*rad),Math.cos(t.rotateZ*rad)];
  const translate = [1,0,0,t.x, 0,1,0,t.y, 0,0,1,t.z, 0,0,0,1];
  const rx = [1,0,0,0, 0,cx,-sx,0, 0,sx,cx,0, 0,0,0,1];
  const ry = [cy,0,sy,0, 0,1,0,0, -sy,0,cy,0, 0,0,0,1];
  const rz = [cz,-sz,0,0, sz,cz,0,0, 0,0,1,0, 0,0,0,1];
  const scale = [t.scale,0,0,0, 0,t.scale,0,0, 0,0,t.scale,0, 0,0,0,1];
  return [rx,ry,rz,scale].reduce(multiply, translate);
}
export function transformToCss(input: TransformInput = {}): string {
  const t = TransformSchema.parse(input);
  return `translate3d(${t.x}px, ${t.y}px, ${t.z}px) rotateX(${t.rotateX}deg) rotateY(${t.rotateY}deg) rotateZ(${t.rotateZ}deg) scale(${t.scale})`;
}
export function evaluateScene(input: unknown, measurements: Measurements = {}): Evaluation {
  const parsed = validateScene(input);
  if (!parsed.success) return { nodes: [], focusDepth: 0, issues: parsed.issues };
  const scene = parsed.data;
  const nodeMap = new Map(scene.nodes.map(node => [node.id, node]));
  const cache = new Map<string, Matrix>();
  const issues: SceneIssue[] = [];
  const camera = matrixFor(TransformSchema.parse(scene.camera ? { rotateX: scene.camera.rotateX, rotateY: scene.camera.rotateY, rotateZ: scene.camera.rotateZ } : {}));
  const getWorld = (id: string): Matrix => {
    const cached = cache.get(id);
    if (cached) return cached;
    const node = nodeMap.get(id)!;
    const size = measurements[id];
    const offsetX = size?.offsetX ?? 0, offsetY = size?.offsetY ?? 0;
    const validOffset = Number.isFinite(offsetX) && Number.isFinite(offsetY);
    if (!validOffset) issues.push({path: id, message: 'Invalid layout measurement for ' + id});
    const local = matrixFor({ ...node.transform, x: node.transform.x + (validOffset ? offsetX : 0), y: node.transform.y + (validOffset ? offsetY : 0) });
    const world = multiply(node.parentId ? getWorld(node.parentId) : camera, local);
    cache.set(id, world);
    return world;
  };
  for (const node of scene.nodes) getWorld(node.id);
  const focusDepth = scene.focus.targetId ? getWorld(scene.focus.targetId)[11] : scene.focus.depth;
  const nodes = scene.nodes.map(node => {
    const world = getWorld(node.id), z = world[11];
    const m = measurements[node.id];
    if (m && (!Number.isFinite(m.width) || !Number.isFinite(m.height) || m.width <= 0 || m.height <= 0)) issues.push({ path: node.id, message: 'Surface has no measurable area: ' + node.id });
    if (z >= scene.camera.perspective - 1) issues.push({ path: node.id, message: 'Surface reaches the camera plane: move ' + node.id + ' farther back.' });
    return { id: node.id, world, worldPosition: { x: world[3], y: world[7], z },
      blur: Math.min(scene.focus.maxBlur, Math.max(0, Math.abs(z - focusDepth) - scene.focus.range) / scene.focus.falloff),
      width: m?.width ?? 0, height: m?.height ?? 0 };
  });
  return { nodes, focusDepth, issues };
}
