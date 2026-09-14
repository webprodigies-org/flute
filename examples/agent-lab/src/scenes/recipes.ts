import {
  reviewAuthoring,
  type MotionInput,
  type SceneInput,
} from "@flute/scene";

// SOURCE OF TRUTH: recipes, scene identities, framing and authored motion.
// WHAT: independent host compositions using installed contracts. WHY: review and
// rendered registration share metadata. WHERE: gallery.tsx binds real components.
type Track = NonNullable<MotionInput["tracks"]>[number];
const frames = (a: number, b: number, end = 5000) => [
  { timeMs: 0, value: a },
  { timeMs: end, value: b },
];
const camera = (
  property: "x" | "y" | "z" | "rotateX" | "rotateY" | "rotateZ",
  a: number,
  b: number,
): Track => ({ target: { kind: "camera" }, property, keyframes: frames(a, b) });
const surface = (
  id: string,
  property: "x" | "y" | "z" | "rotateX" | "rotateY" | "rotateZ",
  a: number,
  b: number,
): Track => ({
  target: { kind: "surface", id },
  property,
  keyframes: frames(a, b, 3600),
});
const focus = (
  property: "x" | "y" | "z" | "radius",
  a: number,
  b: number,
): Track => ({ target: { kind: "focus" }, property, keyframes: frames(a, b) });
export type Recipe = {
  id: string;
  title: string;
  description: string;
  scene: SceneInput;
  motion: MotionInput;
  panels: {
    id: string;
    component: "dashboard" | "metrics" | "chart" | "table";
    left: number;
    top: number;
    width: number;
    height?: number;
  }[];
};
export const recipes: Recipe[] = [
  {
    id: "pullback",
    title: "01 / The bigger picture",
    description: "A close, oblique view opens into the complete dashboard.",
    scene: {
      camera: { perspective: 1800 },
      focus: { radius: 900, falloff: 400, maxBlur: 2 },
      nodes: [{ id: "dashboard" }],
    },
    motion: {
      durationMs: 5000,
      tracks: [
        camera("z", -150, 470),
        camera("rotateX", 8, 0),
        camera("rotateY", -12, 0),
        camera("y", -120, 0),
        focus("radius", 450, 1000),
      ],
    },
    panels: [
      {
        id: "dashboard",
        component: "dashboard",
        left: 60,
        top: 20,
        width: 1280,
        height: 940,
      },
    ],
  },
  {
    id: "assembly",
    title: "02 / Pieces of the picture",
    description:
      "Metrics, traffic and documents settle from separate depths into one working view.",
    scene: {
      camera: { perspective: 1800, z: 320, rotateX: 7, rotateY: -9 },
      focus: { radius: 850, falloff: 500, maxBlur: 3 },
      nodes: [{ id: "metrics" }, { id: "chart" }, { id: "table" }],
    },
    motion: {
      durationMs: 5000,
      tracks: [
        surface("metrics", "z", 160, 0),
        surface("metrics", "y", -55, 0),
        surface("chart", "z", -220, 0),
        surface("chart", "x", -100, 0),
        surface("table", "z", -460, 0),
        surface("table", "x", 150, 0),
        camera("rotateY", -9, 0),
        camera("rotateX", 7, 0),
      ],
    },
    panels: [
      { id: "metrics", component: "metrics", left: 100, top: 90, width: 1200 },
      { id: "chart", component: "chart", left: 124, top: 320, width: 680 },
      {
        id: "table",
        component: "table",
        left: 824,
        top: 320,
        width: 450,
        height: 470,
      },
    ],
  },
  {
    id: "orbit",
    title: "03 / Follow the signal",
    description:
      "The visitor chart takes the foreground as the camera glides and attention travels across it.",
    scene: {
      camera: { perspective: 1800, z: 260 },
      focus: { x: -260, y: 20, z: 0, radius: 300, falloff: 550, maxBlur: 4 },
      nodes: [
        { id: "metrics", transform: { z: -180, rotateX: 9 } },
        { id: "chart", transform: { z: 90, rotateY: -7 } },
      ],
    },
    motion: {
      durationMs: 5000,
      tracks: [
        camera("x", -100, 100),
        camera("rotateY", -7, 7),
        focus("x", -260, 260),
        focus("radius", 300, 540),
      ],
    },
    panels: [
      { id: "metrics", component: "metrics", left: 100, top: 130, width: 1200 },
      { id: "chart", component: "chart", left: 220, top: 410, width: 960 },
    ],
  },
];
export const reviews = recipes.map((recipe) =>
  reviewAuthoring({ scene: recipe.scene, motion: recipe.motion }),
);
