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
    const field = focusForSurface(getWorld(node.id), scene.focus, scene.camera.perspective);
    if (
      !Object.values(field).every(Number.isFinite) ||
      field.scale < 1e-8 ||
      !Number.isFinite(field.distance / field.scale)
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
  const focusDepth = scene.camera.perspective - scene.focus.distance;
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
      focus: focusForSurface(world, scene.focus, scene.camera.perspective),
      blur: sampleFocus(focusForSurface(world, scene.focus, scene.camera.perspective), 0, 0),
      width: m?.width ?? 0,
      height: m?.height ?? 0,
    };
  });
  return { nodes, focusDepth, issues };
}

/** SOURCE OF TRUTH: FocusField, focusForSurface, sampleFocus, focusMask, uniformFocusBlur.
 * WHAT: camera-axis depth and thin-lens circle of confusion for each live plane.
 * WHY: equal depth has equal focus regardless of screen position or surface ID.
 * WHERE: React filters approximate an aperture kernel with Gaussian basis samples.
 * Camera projection sits at +perspective; distance/focalLength share scene units.
 * The Gaussian kernel is a realtime approximation, not Blender aperture ray tracing.
 */
export type FocusField = {
  depth:number; depthX:number; depthY:number; scale:number;
  distance:number; fStop:number; focalLength:number; maxBlur:number; perspective:number;
};
export function focusForSurface(m:Matrix, f:SceneDefinition["focus"], perspective=1400):FocusField {
  return {depth:perspective-m[11],depthX:-m[8],depthY:-m[9],scale:Math.hypot(m[0],m[4],m[8]),...f,perspective};
}
// Match the variance of a circular aperture: Gaussian sigma = CoC diameter / 4.
export function sampleFocus(f:FocusField,x:number,y:number):number {
  if(f.maxBlur===0) return 0;
  const depth=f.depth+f.depthX*x+f.depthY*y;
  if(depth<=0 || f.distance<=f.focalLength) return f.maxBlur;
  // Express the kernel on the local plane. CSS projection supplies perspective/depth;
  // applying that factor here again would double-amplify near-camera blur.
  const sigma=f.focalLength/(4*f.fStop*(f.distance-f.focalLength))*Math.abs(depth-f.distance);
  return Math.min(f.maxBlur,sigma);
}
function depthBounds(f:FocusField,width:number,height:number) {
  const pad=3*f.maxBlur/f.scale;
  const extent=Math.abs(f.depthX)*(width/2+pad)+Math.abs(f.depthY)*(height/2+pad);
  return {min:f.depth-extent,max:f.depth+extent,pad};
}
export function uniformFocusBlur(f:FocusField,width:number,height:number):number|undefined {
  if(f.maxBlur===0) return 0;
  const {min,max}=depthBounds(f,width,height);
  if(min===max) return sampleFocus(f,0,0)/f.scale;
  const at=(depth:number)=>sampleFocus({...f,depth,depthX:0,depthY:0},0,0);
  if((max<f.distance||min>f.distance)&&Math.min(at(min),at(max))===f.maxBlur) return f.maxBlur/f.scale;
  return undefined;
}
export const FOCUS_BANDS=6;
// Blend adjacent blur samples with normalized weights. A linear depth texture
// represents a tilted plane exactly; only the blur-kernel basis is approximate.
export function focusMask(f:FocusField,width:number,height:number,band:number) {
  const {min,max,pad}=depthBounds(f,width,height);
  const span=max-min;
  return {pad,xWeight:span===0?1:Math.abs(f.depthX)*(width+2*pad)/span,
    yWeight:span===0?0:Math.abs(f.depthY)*(height+2*pad)/span,
    reverseX:f.depthX<0,reverseY:f.depthY<0,
    stops:Array.from({length:129},(_,i)=>{
      const sigma=sampleFocus({...f,depth:min+span*i/128,depthX:0,depthY:0},0,0);
      const level=f.maxBlur===0?0:sigma/f.maxBlur*FOCUS_BANDS;
      return Math.max(0,1-Math.abs(level-band));
    })};
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
