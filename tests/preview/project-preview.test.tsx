// @vitest-environment jsdom
import { createContext, useContext, useEffect, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cameraToCss, evaluateScene } from "../../src/core";
import { ProjectPreview } from "../../src/preview";

let resize: () => void;
let width = 1000;
beforeEach(() => {
  window.history.replaceState({}, "", "/app?flute-preview=1");
  width = 1000;
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) {
      resize = () => callback([], this as unknown as ResizeObserver);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockImplementation(function (this: HTMLElement) {
    return this.parentElement?.closest("[data-flute-stage]") ?? null;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  [false, "?flute-preview=1"],
  [true, ""],
  [true, "?flute-preview=0"],
  [true, "?flute-preview=true"],
])("returns only the original host when enabled=%s and query=%s", (enabled, query) => {
  window.history.replaceState({}, "", "/app" + query);
  const view = render(<ProjectPreview projectId="host" enabled={enabled}><button>Original</button></ProjectPreview>);
  expect(view.container.innerHTML).toBe("<button>Original</button>");
});

it("uses canonical camera and progressive focus while preserving host context, events and identity", () => {
  const Context = createContext("missing");
  const requestData = vi.fn();
  function Host() {
    const value = useContext(Context);
    const [count, setCount] = useState(0);
    useEffect(() => { requestData(); }, []);
    return <button onClick={() => setCount(count + 1)}>{value}: {count}</button>;
  }
  const app = (projectId: string, value: string) => (
    <ProjectPreview projectId={projectId} enabled>
      <Context.Provider value={value}><Host /></Context.Provider>
    </ProjectPreview>
  );
  const view = render(app("host", "API data"));
  const button = screen.getByRole("button", {name: /API data:/});
  fireEvent.click(button);
  expect(button.textContent).toBe("API data: 1");
  expect(document.querySelectorAll("[data-flute-scene]")).toHaveLength(1);
  expect(document.querySelectorAll("[data-flute-id]")).toHaveLength(1);
  const camera = { perspective: 1800, rotateX: 4, rotateY: -7 };
  const focus = { distance:1800, fStop:8, maxBlur:6 };
  const expected = evaluateScene({ camera, focus, nodes: [{ id: "flute-application" }] }, {
    "flute-application": { width, height: 600, offsetX: 0, offsetY: 0 },
  });
  const stage = document.querySelector<HTMLElement>("[data-flute-stage]")!;
  const surface = document.querySelector<HTMLElement>("[data-flute-id]")!;
  expect(stage.style.transform).toBe(cameraToCss(camera));
  expect(stage.parentElement!.style.perspective).toBe("1800px");
  expect(Number(surface.dataset.fluteBlur)).toBe(expected.nodes[0].blur);
  expect(surface.querySelector<HTMLElement>("[data-flute-content]")!.style.filter).toMatch(/^url\(#flute-focus-/);
  expect(document.querySelector("feGaussianBlur")).not.toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  view.rerender(app("renamed-host", "Updated API data"));
  width = 390;
  act(() => resize());
  expect(screen.getByRole("button", {name: /API data:/})).toBe(button);
  expect(button.textContent).toBe("Updated API data: 1");
  expect(requestData).toHaveBeenCalledTimes(1);
  expect(document.querySelector("[data-flute-project]")!.getAttribute("data-flute-project")).toBe("renamed-host");
  expect(document.querySelectorAll("[data-flute-id]")).toHaveLength(1);
});

it("removes only the preview parameter from the back destination", () => {
  window.history.replaceState({}, "", "/nested/app?tag=a&flute-preview=1&tag=b&name=hello%20world&flute-preview=1#details");
  render(<ProjectPreview projectId="host" enabled>App</ProjectPreview>);
  const link = screen.getByRole("link", { name: "Back to app" }) as HTMLAnchorElement;
  const destination = new URL(link.href);
  expect(destination.pathname).toBe("/nested/app");
  expect(destination.searchParams.has("flute-preview")).toBe(false);
  expect(destination.searchParams.getAll("tag")).toEqual(["a", "b"]);
  expect(destination.searchParams.get("name")).toBe("hello world");
  expect(destination.hash).toBe("#details");
});

it("keeps page-entry query choice stable during host rerenders", () => {
  const view = render(<ProjectPreview projectId="host" enabled><input defaultValue="kept" /></ProjectPreview>);
  const input = screen.getByRole("textbox");
  window.history.replaceState({}, "", "/app");
  view.rerender(<ProjectPreview projectId="host" enabled><input defaultValue="kept" /></ProjectPreview>);
  expect(screen.getByRole("textbox")).toBe(input);
  expect(screen.getByText("Live preview")).toBeTruthy();
});

it("keeps back navigation available on render failure and uses canonical retry recovery", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let broken = true;
  function Host() {
    if (broken) throw new Error("Host failed");
    return <button>Recovered host</button>;
  }
  render(<ProjectPreview projectId="host" enabled><Host /></ProjectPreview>);
  expect(screen.getByRole("alert").textContent).toContain("Host failed");
  expect(screen.getByRole("link", { name: "Back to app" })).toBeTruthy();
  broken = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry scene" }));
  expect(screen.getByRole("button", { name: "Recovered host" })).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});
