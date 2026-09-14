// @vitest-environment jsdom
import {
  StrictMode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateScene, transformToCss } from "../../src/core";
import { Motion, Scene, SceneErrorBoundary, Surface } from "../../src/react";

function createObserver(callback: ResizeObserverCallback) {
  const targets = new Set<Element>();
  const observer = {
    targets,
    observe: (element: Element) => { targets.add(element); },
    unobserve: (element: Element) => { targets.delete(element); },
    disconnect: () => { targets.clear(); },
    flush: () => { callback([], observer as unknown as ResizeObserver); },
  };
  return observer;
}
let observerInstances: ReturnType<typeof createObserver>[] = [];
function Observer(callback: ResizeObserverCallback) {
  const observer = createObserver(callback);
  observerInstances.push(observer);
  return observer;
}
const node = (id: string) =>
  document.querySelector<HTMLDivElement>(`[data-flute-id="${id}"]`)!;
beforeEach(() => {
  observerInstances = [];
  vi.stubGlobal("ResizeObserver", Observer);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.hasAttribute("data-flute-stage")
        ? 800
        : parseFloat(this.style.width) || 200;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.hasAttribute("data-flute-stage")
        ? 400
        : parseFloat(this.style.height) || 100;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
    function (this: HTMLElement) {
      return parseFloat(this.style.left) || 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(
    function (this: HTMLElement) {
      return parseFloat(this.style.top) || 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockImplementation(
    function (this: HTMLElement) {
      return (
        this.parentElement?.closest("[data-flute-id], [data-flute-stage]") ??
        null
      );
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("live React spatial adapter", () => {
  it("preserves provider data, events, DOM identity and component state across focus and transform changes", () => {
    const Host = createContext("missing");
    let mounts = 0;
    function ExistingComponent() {
      const data = useContext(Host);
      const [count, setCount] = useState(0);
      useEffect(() => {
        mounts++;
      }, []);
      return (
        <button onClick={() => setCount((value) => value + 1)}>
          {data}: {count}
        </button>
      );
    }
    const app = (focus: string, z: number) => (
      <Host.Provider value="API result">
        <Scene
          focus={{
            distance: focus === "front" ? 1200 : 1500,
          }}
        >
          <Surface id="back" transform={{ z }}>
            <ExistingComponent />
          </Surface>
          <Surface id="front" transform={{ z: 200 }}>
            Front
          </Surface>
        </Scene>
      </Host.Provider>
    );
    const view = render(app("back", -100));
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(button.textContent).toBe("API result: 1");
    view.rerender(app("front", -150));
    expect(screen.getByRole("button")).toBe(button);
    expect(button.textContent).toBe("API result: 1");
    expect(mounts).toBe(1);
    expect(Number(node("back").dataset.fluteBlur)).toBeGreaterThan(0);
    expect(node("front").dataset.fluteBlur).toBe("0");
  });

  it("uses core transform order, camera rotation and measured parent-relative centers", () => {
    const camera = { rotateX: 10, rotateY: 35, rotateZ: 5, perspective: 1500 };
    const transform = { z: 80, rotateY: 25, rotateZ: 12 };
    const projected = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    render(
      <Scene camera={camera}>
        <Surface
          id="group"
          transform={transform}
          style={{
            position: "absolute",
            left: 100,
            top: 80,
            width: 400,
            height: 200,
          }}
        >
          <Motion
            id="child"
            transform={{ z: 40 }}
            style={{
              position: "absolute",
              left: 250,
              top: 20,
              width: 100,
              height: 50,
            }}
          >
            Live
          </Motion>
        </Surface>
      </Scene>,
    );
    // The mocked stage is 800x400; nodes use explicit untransformed border boxes.
    const stage = document.querySelector<HTMLElement>("[data-flute-stage]")!;
    const expected = evaluateScene(
      {
        camera,
        nodes: [
          { id: "group", transform },
          { id: "child", parentId: "group", transform: { z: 40 } },
        ],
      },
      {
        group: {
          width: 400,
          height: 200,
          offsetX: 100 + 200 - stage.offsetWidth / 2,
          offsetY: 80 + 100 - stage.offsetHeight / 2,
        },
        child: { width: 100, height: 50, offsetX: 100, offsetY: -55 },
      },
    );
    expect(Number(node("child").dataset.fluteDepth)).toBeCloseTo(
      expected.nodes[1].worldPosition.z,
    );
    expect(node("group").style.transform).toBe(transformToCss(transform));
    expect(stage.style.transform).toBe(
      transformToCss({ rotateX: 10, rotateY: 35, rotateZ: 5 }),
    );
    expect(projected).not.toHaveBeenCalled();
  });

  it("blurs plain leaves and optional content while preserving nested 3D groups", () => {
    function NestedHost() {
      return (
        <Surface id="child" transform={{ z: 100 }}>
          Nested
        </Surface>
      );
    }
    render(
      <Scene focus={{ distance:1400, fStop:0.7, focalLength:300, maxBlur:6 }}>
        <Surface
          id="group"
          transform={{ z: -100 }}
          content={<span>Backdrop</span>}
        >
          <NestedHost />
        </Surface>
        <Surface id="implicit-group" transform={{ z: 100 }}>
          <Motion id="motion">Motion</Motion>
        </Surface>
        <Surface id="leaf" transform={{ z: 100 }}>
          Leaf
        </Surface>
      </Scene>,
    );
    expect(node("group").style.filter).toBe("none");
    expect(
      node("group")
        .querySelector("[data-flute-content]")
        ?.getAttribute("style"),
    ).toContain("blur(6px)");
    expect(node("child").closest("[data-flute-content]")).toBeNull();
    expect(node("implicit-group").style.filter).toBe("none");
    expect(node("motion").parentElement?.style.filter).toBe("none");
    expect(
      node("leaf").querySelector<HTMLElement>("[data-flute-content]")?.style
        .filter,
    ).toBe("blur(6px)");
  });

  it("updates local geometry on ResizeObserver and releases measurements on unmount", () => {
    const view = render(
      <Scene camera={{ rotateY: 90 }}>
        <Surface id="a" style={{ width: 100, height: 50, left: 10 }}>
          A
        </Surface>
      </Scene>,
    );
    const before = Number(node("a").dataset.fluteDepth);
    node("a").style.width = "200px";
    act(() => {
      observerInstances.forEach((observer) => observer.flush());
    });
    expect(Number(node("a").dataset.fluteDepth)).toBeCloseTo(before - 50);
    const observers = observerInstances;
    view.unmount();
    expect(observers.every((observer) => observer.targets.size === 0)).toBe(
      true,
    );
  });

  it("scopes IDs to each Scene and cleans StrictMode registrations without duplicates", () => {
    const view = render(
      <StrictMode>
        <Scene>
          <Surface id="same">First</Surface>
        </Scene>
        <Scene>
          <Surface id="same">Second</Surface>
        </Scene>
      </StrictMode>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.querySelectorAll('[data-flute-id="same"]')).toHaveLength(2);
    view.rerender(
      <StrictMode>
        <Scene>
          <Surface id="same">Remaining</Surface>
        </Scene>
      </StrictMode>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.querySelectorAll('[data-flute-id="same"]')).toHaveLength(1);
  });

  it("reports duplicate IDs visibly and recovers without remounting the live subtree", () => {
    const app = (second: string) => (
      <Scene>
        <Surface id="a">
          <input defaultValue="host state" />
        </Surface>
        <Surface id={second}>Second</Surface>
      </Scene>
    );
    const view = render(app("a"));
    const input = screen.getByRole("textbox");
    expect(screen.getByRole("alert").textContent).toContain(
      "Duplicate surface ID: a",
    );
    view.rerender(app("b"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("textbox")).toBe(input);
  });

  it("reports invalid independent focus and recovers without replacing the host", () => {
    const app = (radius: number) => (
      <Scene focus={{ distance: radius }}>
        <Surface id="a">
          <input defaultValue="kept" />
        </Surface>
      </Scene>
    );
    const view = render(app(100));
    const input = screen.getByRole("textbox");
    view.rerender(app(-1));
    expect(screen.getByRole("alert").textContent).toContain("focus.distance");
    view.rerender(app(100));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("textbox")).toBe(input);
  });

  it("reports current diagnostics through an inline state callback without looping", () => {
    let calls = 0;
    function App({ target }: { target: string }) {
      const [count, setCount] = useState(-1);
      return (
        <>
          <output>{count}</output>
          <Scene
            focus={{ distance: target === "missing" ? -1 : 100 }}
            onDiagnostics={(issues) => {
              calls++;
              setCount(issues.length);
            }}
          >
            <Surface id="a">A</Surface>
          </Scene>
        </>
      );
    }
    const view = render(<App target="missing" />);
    expect(screen.getByRole("status").textContent).toBe("1");
    view.rerender(<App target="a" />);
    expect(screen.getByRole("status").textContent).toBe("0");
    expect(calls).toBeLessThan(5);
  });

  it.each([
    { camera: { perspective: 0 } },
    { focus: { fStop: 0 } },
    { transform: { scale: 0 } },
    { transform: { z: Infinity } },
  ])("validates runtime config through core and recovers: %j", (config) => {
    const view = render(
      <Scene camera={config.camera} focus={config.focus}>
        <Surface id="a" transform={config.transform}>
          A
        </Surface>
      </Scene>,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Correct the scene props",
    );
    expect(node("a").style.transform).not.toContain("Infinity");
    view.rerender(
      <Scene>
        <Surface id="a">A</Surface>
      </Scene>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("diagnoses zero-area measurements and recovers on resize", () => {
    const view = render(
      <Scene>
        <Surface id="a">A</Surface>
      </Scene>,
    );
    Object.defineProperty(node("a"), "offsetWidth", {
      configurable: true,
      value: 0,
    });
    act(() => {
      observerInstances.forEach((observer) => observer.flush());
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "no measurable area",
    );
    Object.defineProperty(node("a"), "offsetWidth", {
      configurable: true,
      value: 200,
    });
    act(() => {
      observerInstances.forEach((observer) => observer.flush());
    });
    expect(screen.queryByRole("alert")).toBeNull();
    view.unmount();
  });

  it("catches host render errors and supports retry and resetKey correction", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let broken = true;
    function Host() {
      if (broken) throw new Error("Host API view failed");
      return <button>Recovered</button>;
    }
    const view = render(
      <SceneErrorBoundary resetKey={0}>
        <Host />
      </SceneErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Host API view failed",
    );
    broken = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry scene" }));
    expect(screen.getByRole("button", { name: "Recovered" })).toBeTruthy();
    broken = true;
    view.rerender(
      <SceneErrorBoundary resetKey={0}>
        <Host />
      </SceneErrorBoundary>,
    );
    broken = false;
    view.rerender(
      <SceneErrorBoundary resetKey={1}>
        <Host />
      </SceneErrorBoundary>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each(["failed", null, undefined])("recovers a non-Error thrown value: %s", (failure) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let broken = true;
    function Host() {
      if (broken) throw failure;
      return <span>Restored host</span>;
    }
    const view = render(<SceneErrorBoundary resetKey={0}><Host /></SceneErrorBoundary>);
    expect(screen.getByRole("alert").textContent).toContain(String(failure));
    broken = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry scene" }));
    expect(screen.getByText("Restored host")).toBeTruthy();
    broken = true;
    view.rerender(<SceneErrorBoundary resetKey={0}><Host /></SceneErrorBoundary>);
    broken = false;
    view.rerender(<SceneErrorBoundary resetKey={1}><Host /></SceneErrorBoundary>);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps healthy host state and DOM when resetKey changes", () => {
    function Host() {
      const [count, setCount] = useState(0);
      return <button onClick={() => setCount(count + 1)}>Count {count}</button>;
    }
    const view = render(<SceneErrorBoundary resetKey={0}><Host /></SceneErrorBoundary>);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    view.rerender(<SceneErrorBoundary resetKey={1}><Host /></SceneErrorBoundary>);
    expect(screen.getByRole("button")).toBe(button);
    expect(button.textContent).toBe("Count 1");
  });

  it("makes out-of-scene usage actionable", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <SceneErrorBoundary>
        <Surface id="outside">Outside</Surface>
      </SceneErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "inside a Flute Scene",
    );
  });
});

it("applies deterministic camera, focus and surface tracks without replacing live UI; recovers missing targets", () => {
  const motion = {
    durationMs: 1000, speed: 1,
    tracks: [
      {
        target: { kind: "surface" as const, id: "a" },
        property: "x" as const,
        keyframes: [
          { timeMs: 0, value: 0 },
          { timeMs: 1000, value: 100 },
        ],
      },
      {
        target: { kind: "surface" as const, id: "a" },
        property: "opacity" as const,
        keyframes: [
          { timeMs: 0, value: 0 },
          { timeMs: 1000, value: 1 },
        ],
      },
      {
        target: { kind: "camera" as const },
        property: "x" as const,
        keyframes: [
          { timeMs: 0, value: 0 },
          { timeMs: 1000, value: 40 },
        ],
      },
      {
        target: { kind: "focus" as const },
        property: "distance" as const,
        keyframes: [
          { timeMs: 0, value: 10 },
          { timeMs: 1000, value: 100 },
        ],
      },
    ],
  };
  const app = (timeMs: number, show = true) => (
    <Scene motion={motion} timeMs={timeMs}>
      {show && (
        <Surface id="a">
          <input defaultValue="existing" />
        </Surface>
      )}
    </Scene>
  );
  const view = render(app(0));
  const input = screen.getByRole("textbox");
  view.rerender(app(500));
  expect(screen.getByRole("textbox")).toBe(input);
  expect(node("a").style.transform).toContain("translate3d(50px");
  expect(
    document.querySelector<HTMLElement>("[data-flute-stage]")!.style.transform,
  ).toContain("translate3d(-20px");
  expect(
    node("a").querySelector<HTMLElement>("[data-flute-content]")!.style.opacity,
  ).toBe("0.5");
  expect(node("a").style.opacity).toBe("1");
  view.rerender(app(500, false));
  expect(screen.getByRole("alert").textContent).toContain(
    "Motion target is not registered: a",
  );
  view.rerender(app(500));
  expect(screen.queryByRole("alert")).toBeNull();
});

it('keeps the scene void black without recoloring the live UI',()=>{
 render(<Scene style={{background:'pink',backgroundImage:'linear-gradient(red, blue)'}}><Surface id="host"><button style={{backgroundColor:'white',color:'black'}}>Original host</button></Surface></Scene>);
 const scene=document.querySelector('[data-flute-scene]') as HTMLElement;
 expect(scene.style.backgroundColor).toBe('rgb(0, 0, 0)');expect(scene.style.backgroundImage).toBe('none');
 expect(screen.getByRole('button',{name:'Original host'}).style.backgroundColor).toBe('white');
});

  it("diagnoses mixed group content and recovers when each region has a focus owner", async () => {
    const app=(covered:boolean)=><Scene><Surface id="group"><div>{covered ? <Surface id="label">Background label</Surface> : <span>Background label</span>}<Surface id="front">Foreground</Surface></div></Surface></Scene>;
    const view=render(app(false));
    await act(async()=>{});
    expect(screen.getByRole("alert").textContent).toContain("Unfiltered content");
    view.rerender(app(true));
    await act(async()=>{});
    expect(screen.queryByRole("alert")).toBeNull();
    expect(node("label").querySelector('[data-flute-content]')).not.toBeNull();
  });

it("diagnoses scene content outside any focus owner", async()=>{
 const app=(covered:boolean)=><Scene>{covered ? <Surface id="back">Background</Surface> : <span>Background</span>}<Surface id="front">Foreground</Surface></Scene>;
 const view=render(app(false));
 await act(async()=>{});
 expect(screen.getByRole("alert").textContent).toContain("Unfiltered scene content");
 view.rerender(app(true));
 await act(async()=>{});
 expect(screen.queryByRole("alert")).toBeNull();
});
