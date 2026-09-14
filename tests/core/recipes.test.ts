import { describe, expect, it } from "vitest";
import { loadSceneRecipes, SceneRecipeSchema } from "../../src/core/recipes";

const definition = { scene: { nodes: [{ id: "panel" }], focus: { distance: 1800, fStop: 4 } },
  motion: { durationMs: 1000, tracks: [{ target: { kind: "surface", id: "panel" }, property: "x", keyframes: [{ timeMs: 0, value: 0 }, { timeMs: 1000, value: 100 }] }] } };
const recipe = (id = "demo") => ({ version: 1, id, title: `Scene ${id}`, description: "Editable", definition });
const source = (id = "demo", document: unknown = recipe(id)) => ({ path: `src/flute/scenes/${id}.scene.json`, document });
const catalog = (sources: unknown[], sceneId?: string) => loadSceneRecipes({ sources, bindingPaths: ["demo", "alpha", "zebra"].map(id => `src/flute/scenes/${id}.tsx`), ...(sceneId === undefined ? {} : { sceneId }) });

describe("canonical local recipes", () => {
  it("reopens version, focus and motion with inferred canonical defaults", () => {
    const result = catalog([source()], "demo");
    expect(result.issues).toEqual([]);
    expect(result.selected).toEqual({ ...SceneRecipeSchema.parse(recipe()), source: "src/flute/scenes/demo.scene.json", binding: "src/flute/scenes/demo.tsx" });
    expect(result.selected?.definition.scene.focus.distance).toBe(1800);
    expect(result.selected?.definition.motion).toMatchObject(definition.motion);
  });
  it("sorts independently of discovery order", () => {
    const a = source("alpha"), z = source("zebra");
    expect(catalog([z, a])).toEqual(catalog([a, z]));
    expect(catalog([z, a]).scenes.map(scene => scene.id)).toEqual(["alpha", "zebra"]);
  });
  it.each([
    { ...recipe(), version: 2 }, { ...recipe(), id: "UPPER" }, { ...recipe(), id: "../demo" },
    { ...recipe(), id: "bad--slug" }, { ...recipe(), title: " " }, { ...recipe(), secret: "not metadata" },
    { ...recipe(), definition: { scene: { nodes: [{ id: "same" }, { id: "same" }] } } },
    { ...recipe(), definition: { ...definition, scene: { nodes: [] } } },
  ])("rejects invalid entries without hiding other scenes: %j", invalid => {
    const result = catalog([source("demo", invalid), source("alpha")]);
    expect(result.scenes.map(scene => scene.id)).toEqual(["alpha"]);
    expect(result.issues.length).toBeGreaterThan(0);
  });
  it("rejects filename mismatch and excludes all duplicate identities, including malformed duplicates", () => {
    expect(catalog([source("other", recipe())]).issues[0].message).toContain("must match");
    const result = catalog([source(), source("other", recipe()), source("alpha")]);
    expect(result.scenes.map(scene => scene.id)).toEqual(["alpha"]);
    expect(result.issues.every(issue => issue.message.includes("Duplicate"))).toBe(true);
    expect(catalog([source(), source("other", { ...recipe(), version: 9 })]).scenes).toEqual([]);
  });
  it("requires a matching local component path", () => {
    const result = loadSceneRecipes({ sources: [source()], bindingPaths: [] });
    expect(result.scenes).toEqual([]);
    expect(result.issues[0].message).toContain("demo.tsx");
  });
  it.each(["../demo.scene.json", "/src/flute/scenes/demo.scene.json", "src/flute/scenes/../demo.scene.json", "src/flute/scenes/nested/demo.scene.json", "src\\flute\\scenes\\demo.scene.json"])("denies noncanonical source %s", path => {
    const result = catalog([{ path, document: recipe() }]);
    expect(result.scenes).toEqual([]);
    expect(result.issues[0].path).toBe(path);
  });
  it("reports malformed entries and bindings while retaining unrelated valid records", () => {
    const result = loadSceneRecipes({ sources: [null, source()], bindingPaths: [null, "../demo.tsx", "src/flute/scenes/demo.tsx"] });
    expect(result.scenes).toHaveLength(1);
    expect(result.issues).toHaveLength(3);
  });
  it.each([null, [], {}, { sources: [], bindingPaths: "wrong" }, { sources: [], bindingPaths: [], sceneId: 1 }])("returns diagnostics for malformed catalog %j", input => {
    expect(loadSceneRecipes(input).issues.length).toBeGreaterThan(0);
  });
  it("keeps valid choices when selection is missing or malformed and recovers after correction", () => {
    for (const id of ["missing", "../demo"]) {
      const result = catalog([source()], id);
      expect(result.selected).toBeUndefined();
      expect(result.scenes).toHaveLength(1);
      expect(result.issues).toContainEqual(expect.objectContaining({ path: "sceneId" }));
    }
    expect(catalog([source()], "demo").issues).toEqual([]);
  });
});
