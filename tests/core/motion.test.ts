import { describe, expect, it } from "vitest";
import {
  evaluateMotion,
  MotionSchema,
  MotionTrackSchema,
  type MotionInput,
} from "../../src/core/motion";

const surface = { kind: "surface", id: "panel" } as const;
function track(target: unknown = surface, property = "x", from = 0, to = 100) {
  return {
    target,
    property,
    keyframes: [
      { timeMs: 100, value: from, easing: "linear" },
      { timeMs: 900, value: to },
    ],
  };
}
function motion(tracks: unknown[] = [track()]) {
  return { durationMs: 1000, speed: 1, tracks };
}
function expectInvalid(input: unknown, time = 500) {
  const state = evaluateMotion(input, time);
  expect(state.issues.length).toBeGreaterThan(0);
  expect(state.surfaces).toEqual({});
  expect(state.camera).toEqual({});
  expect(state.focus).toEqual({});
  return state.issues;
}

describe("explicit scene time motion", () => {
  it("interpolates every surface property, preserving partial overrides and independent IDs", () => {
    const tracks = ["x", "y", "z", "rotateX", "rotateY", "rotateZ"].map(
      (property) => track(surface, property),
    );
    tracks.push(
      track(surface, "scale", 1, 3),
      track(surface, "opacity", 0, 1),
      track({ kind: "surface", id: "other" }, "x", -20, 20),
    );
    expect(evaluateMotion(motion(tracks), 500)).toEqual({
      surfaces: {
        panel: {
          x: 50,
          y: 50,
          z: 50,
          rotateX: 50,
          rotateY: 50,
          rotateZ: 50,
          scale: 2,
          opacity: 0.5,
        },
        other: { x: 0 },
      },
      camera: {},
      focus: {},
      issues: [],
    });
  });

  it("evaluates camera and spatial focus position/width independently", () => {
    const tracks = ["x", "y", "z", "rotateX", "rotateY", "rotateZ"].map(
      (property) => track({ kind: "camera" }, property, -100, 100),
    );
    tracks.push(
      track({kind:"focus"},"distance",1000,1400),
      track({kind:"focus"},"fStop",4,12),
      track({kind:"focus"},"focalLength",40,60),
      track({ kind: "focus" }, "maxBlur", 0, 32),
    );
    expect(evaluateMotion(motion(tracks), 500)).toEqual({
      surfaces: {},
      camera: { x: 0, y: 0, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0 },
      focus: { distance:1200, fStop:8, focalLength:50, maxBlur:16 },
      issues: [],
    });
  });

  it("uses outgoing smoothstep easing and a separate linear next segment", () => {
    const input: MotionInput = {
      durationMs: 2000, speed: 1,
      tracks: [
        {
          target: surface,
          property: "x",
          keyframes: [
            { timeMs: 0, value: 0, easing: "easeInOut" },
            { timeMs: 1000, value: 100, easing: "linear" },
            { timeMs: 2000, value: 200 },
          ],
        },
      ],
    };
    expect(evaluateMotion(input, 250).surfaces.panel.x).toBe(15.625);
    expect(evaluateMotion(input, 500).surfaces.panel.x).toBe(50);
    expect(evaluateMotion(input, 750).surfaces.panel.x).toBe(84.375);
    expect(evaluateMotion(input, 1000).surfaces.panel.x).toBe(100);
    expect(evaluateMotion(input, 1250).surfaces.panel.x).toBe(125);
  });

  it.each([
    [-100, 0],
    [0, 0],
    [50, 0],
    [100, 0],
    [900, 100],
    [950, 100],
    [1000, 100],
    [2000, 100],
  ])("clamps scene time and holds endpoints at %s ms", (time, value) => {
    expect(evaluateMotion(motion(), time).surfaces.panel).toEqual({ x: value });
  });

  it("supports empty tracks, static keyframes and zero duration", () => {
    expect(evaluateMotion({ durationMs: 0, speed: 1, tracks: [] }, 20)).toEqual({
      surfaces: {},
      camera: {},
      focus: {},
      issues: [],
    });
    const input = {
      durationMs: 0, speed: 1,
      tracks: [
        {
          target: surface,
          property: "x",
          keyframes: [{ timeMs: 0, value: 12 }],
        },
      ],
    };
    for (const time of [-10, 0, 10])
      expect(evaluateMotion(input, time).surfaces.panel.x).toBe(12);
  });

  it("is deterministic across scrubbing, leaves frozen input intact, and returns fresh state", () => {
    const input = motion();
    const snapshot = JSON.stringify(input);
    function freeze(value: unknown) {
      if (value && typeof value === "object") {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
      }
    }
    freeze(input);
    const first = evaluateMotion(input, 500);
    evaluateMotion(input, 900);
    evaluateMotion(input, 0);
    expect(evaluateMotion(input, 500)).toEqual(first);
    first.surfaces.panel.x = 999;
    first.issues.push({ path: "test", message: "changed" });
    expect(evaluateMotion(input, 500).surfaces.panel.x).toBe(50);
    expect(evaluateMotion(input, 500).issues).toEqual([]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("handles prototype-like surface IDs as ordinary scoped data", () => {
    const state = evaluateMotion(
      motion([
        track({ kind: "surface", id: "__proto__" }),
        track({ kind: "surface", id: "constructor" }),
      ]),
      500,
    );
    expect(Object.hasOwn(state.surfaces, "__proto__")).toBe(true);
    expect(state.surfaces.__proto__).toEqual({ x: 50 });
    expect(state.surfaces.constructor).toEqual({ x: 50 });
    expect(Object.getPrototypeOf(state.surfaces)).toBe(Object.prototype);
    expect(Object.hasOwn(Object.prototype, "x")).toBe(false);
  });

  it("interpolates opposite finite extremes without overflowing", () => {
    const input = motion([
      track(surface, "x", -Number.MAX_VALUE, Number.MAX_VALUE),
    ]);
    expect(evaluateMotion(input, 500).surfaces.panel.x).toBe(0);
    expect(Number.isFinite(evaluateMotion(input, 700).surfaces.panel.x)).toBe(
      true,
    );
  });

  it("preserves strictly positive bounds even for the smallest finite value", () => {
    const state = evaluateMotion(
      motion([
        track(surface, "scale", Number.MIN_VALUE, Number.MIN_VALUE),
        track({ kind: "focus" }, "distance", Number.MIN_VALUE, Number.MIN_VALUE),
      ]),
      500,
    );
    expect(state.surfaces.panel.scale).toBe(Number.MIN_VALUE);
    expect(state.focus.distance).toBe(Number.MIN_VALUE);
  });
});

describe("motion validation boundary", () => {
  it.each([NaN, Infinity, -Infinity, "500", null, undefined])(
    "rejects invalid explicit time %s",
    (time) => {
      expect(evaluateMotion(motion(), time as number)).toEqual({
        surfaces: {},
        camera: {},
        focus: {},
        issues: [
          { path: "timeMs", message: "Scene time must be a finite number." },
        ],
      });
    },
  );

  it.each([
    null,
    {},
    { durationMs: -1, tracks: [] },
    { durationMs: Infinity, tracks: [] },
    { durationMs: NaN, tracks: [] },
    { durationMs: "1000", tracks: [] },
    { durationMs: 1000, speed: 1, tracks: [], extra: true },
  ])("rejects malformed config %#", (input) => {
    expectInvalid(input);
  });

  it.each([
    [surface, "scale", 0],
    [surface, "scale", -1],
    [surface, "scale", 101],
    [surface, "opacity", -0.01],
    [surface, "opacity", 1.01],
    [{ kind: "focus" }, "radius", -1],
    [{ kind: "focus" }, "distance", 0],
    [{ kind: "focus" }, "distance", -1],
    [{ kind: "focus" }, "maxBlur", -1],
    [{ kind: "focus" }, "maxBlur", 33],
    [surface, "x", NaN],
    [{ kind: "camera" }, "z", Infinity],
    [{ kind: "focus" }, "x", -Infinity],
  ])(
    "rejects invalid values %# in schema and operation",
    (target, property, value) => {
      const invalid = track(
        target,
        property as string,
        value as number,
        value as number,
      );
      expect(MotionTrackSchema.safeParse(invalid).success).toBe(false);
      expectInvalid(motion([track(), invalid]));
    },
  );

  it.each([
    [{ kind: "camera" }, "opacity"],
    [{ kind: "camera" }, "radius"],
    [{ kind: "focus" }, "rotateX"],
    [{ kind: "focus" }, "depth"],
    [surface, "radius"],
    [surface, "unknown"],
    [{ kind: "surface", id: "" }, "x"],
    [{ kind: "element", id: "panel" }, "x"],
    [{ kind: "focus", id: "panel" }, "x"],
  ])("rejects incompatible target/property %#", (target, property) => {
    expectInvalid(motion([track(target, property as string)]));
  });

  it.each(
    [
      [],
      [{ timeMs: -1, value: 0 }],
      [{ timeMs: Infinity, value: 0 }],
      [{ timeMs: 1001, value: 0 }],
      [{ timeMs: 0, value: 0, easing: "bounce" }],
      [
        { timeMs: 0, value: 0 },
        { timeMs: 0, value: 1 },
      ],
      [
        { timeMs: 500, value: 0 },
        { timeMs: 100, value: 1 },
      ],
      [{ timeMs: 0, value: 0, unknown: true }],
    ].map((keyframes) => ({ keyframes })),
  )("rejects invalid keyframe sequences %#", ({ keyframes }) => {
    expectInvalid(motion([{ target: surface, property: "x", keyframes }]));
  });

  it.each([surface, { kind: "camera" }, { kind: "focus" }])(
    "rejects duplicate target/property tracks %#",
    (target) => {
      const duplicate = track(target);
      expectInvalid(motion([duplicate, duplicate]));
      expect(
        MotionSchema.safeParse(motion([duplicate, duplicate])).success,
      ).toBe(false);
    },
  );

  it("reports actionable validation paths and can recover on the next evaluation", () => {
    const issues = expectInvalid(
      motion([
        {
          target: surface,
          property: "scale",
          keyframes: [{ timeMs: 0, value: 0 }],
        },
      ]),
    );
    expect(
      issues.some((issue) => issue.path === "tracks.0.keyframes.0.value"),
    ).toBe(true);
    expect(evaluateMotion(motion(), 500).issues).toEqual([]);
  });
});
