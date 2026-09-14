// @vitest-environment jsdom
import { createContext, useContext, useEffect, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Surface, type PreviewDefinitionInput } from "../../src";
import { ScenePreview } from "../../src/preview";
import type { CaptureBridge } from "../../src/core/export";

const definition: PreviewDefinitionInput = {
  width: 1000, height: 600,
  scene: { nodes: [{id: "host"}] },
  motion: {durationMs: 4000, tracks: [
    {target: {kind: "camera"}, property: "x", keyframes: [{timeMs: 0, value: 0}, {timeMs: 4000, value: 100}]},
  ]},
};
const bridge = () => (window as typeof window & {__FLUTE_CAPTURE__: CaptureBridge}).__FLUTE_CAPTURE__;
const controls = () => screen.getByRole("contentinfo", {name: "Scene controls"});
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(500);
  vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockImplementation(function(this: HTMLElement) {
    return this.parentElement?.closest("[data-flute-stage]") ?? null;
  });
});
afterEach(() => {cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();});

it("keeps every preview action in the bottom region and preserves host context, state, registration and capture across source recovery", () => {
  const Context = createContext("missing");
  const mounted = vi.fn();
  function Host() {
    const context = useContext(Context);
    const [count, setCount] = useState(0);
    useEffect(() => {mounted();}, []);
    return <button onClick={() => setCount(value => value + 1)}>{context}: {count}</button>;
  }
  const children = <Surface id="host"><Host/></Surface>;
  const app = (input: PreviewDefinitionInput) => <Context value="Host data">
    <ScenePreview definition={input} title="My scene" backHref="/app">{children}</ScenePreview>
  </Context>;
  const view = render(app(definition));
  const region = controls();
  expect(within(region).getByRole("heading", {name: "My scene"})).toBeTruthy();
  expect(within(region).getByRole("link", {name: "Back to app"}).getAttribute("href")).toBe("/app");
  expect(within(region).getByText("Export")).toBeTruthy();
  const host = screen.getByRole("button", {name: "Host data: 0"});
  fireEvent.click(host);
  const capture = document.querySelector(bridge().selector)!;
  expect(capture.contains(host)).toBe(true);
  expect(capture.contains(region)).toBe(false);
  const chrome = document.querySelectorAll("[data-flute-preview-chrome]");
  expect(chrome).toHaveLength(2);
  expect(Array.from(chrome).some(element => element === region)).toBe(true);
  expect(Array.from(chrome).every(element => !capture.contains(element))).toBe(true);
  const slider = within(region).getByRole("slider", {name: "Scene time"});
  fireEvent.change(slider, {target: {value: "2000"}});
  expect(within(region).getByTestId("scene-time").textContent).toBe("0:02 / 0:08");
  const stage = document.querySelector<HTMLElement>("[data-flute-stage]")!;
  const transform = stage.style.transform;
  view.rerender(app({...definition, width: -1}));
  expect(within(region).getByRole("alert").textContent).toContain("last valid");
  expect((within(region).getByRole("button", {name: "Play"}) as HTMLButtonElement).disabled).toBe(true);
  expect(() => bridge().seek(1000)).toThrow(/Correct/);
  expect(stage.style.transform).toBe(transform);
  view.rerender(app(definition));
  expect(within(region).queryByRole("alert")).toBeNull();
  expect(screen.getByRole("button", {name: "Host data: 1"})).toBe(host);
  expect(document.querySelector(bridge().selector)).toBe(capture);
  expect(document.querySelectorAll("[data-flute-id]")).toHaveLength(1);
  expect(mounted).toHaveBeenCalledTimes(1);
  fireEvent.click(within(region).getByRole("button", {name: "Restart"}));
  expect((slider as HTMLInputElement).value).toBe("0");
  fireEvent.click(within(region).getByRole("button", {name: "Play"}));
  expect(within(region).getByRole("button", {name: "Pause"})).toBeTruthy();
  fireEvent.click(within(region).getByRole("button", {name: "Pause"}));
});

it("renders the canonical error and retry outside capture in the controls region", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let broken = true;
  function Host() {if (broken) throw new Error("Host unavailable"); return <Surface id="host">Recovered</Surface>;}
  render(<ScenePreview definition={definition} backHref="/app"><Host/></ScenePreview>);
  const alert = within(controls()).getByRole("alert");
  expect(alert.textContent).toContain("Host unavailable");
  expect(document.querySelector(".flute-viewport")!.contains(alert)).toBe(false);
  expect(within(controls()).getByRole("link", {name: "Back to app"})).toBeTruthy();
  broken = false;
  fireEvent.click(within(alert).getByRole("button", {name: "Retry scene"}));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(document.querySelector(bridge().selector)!.textContent).toContain("Recovered");
  expect((screen.getByRole("button", {name: "Play"}) as HTMLButtonElement).disabled).toBe(false);
});

it("opens export above the action row, supports frame rate and copy recovery, and restores keyboard focus on Escape", async () => {
  const copy = vi.fn().mockRejectedValueOnce(new Error("Clipboard unavailable")).mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {configurable: true, value: {writeText: copy}});
  render(<ScenePreview definition={definition}><Surface id="host">Host</Surface></ScenePreview>);
  const summary = within(controls()).getByText("Export").closest("summary")!;
  fireEvent.click(summary);
  const panel = await within(controls()).findByRole("region", {name: "Export your scene"});
  const fps = within(panel).getByRole("combobox", {name: "Export frame rate"});
  expect(document.activeElement).toBe(fps);
  expect(panel.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(document.querySelector(bridge().selector)!.contains(panel)).toBe(false);
  fireEvent.change(fps, {target: {value: "30"}});
  expect(panel.textContent).toContain("--fps 30");
  fireEvent.click(within(panel).getByRole("button", {name: "Copy command"}));
  await waitFor(() => expect(within(panel).getByRole("status").textContent).toContain("Select and copy"));
  fireEvent.click(within(panel).getByRole("button", {name: "Copy command"}));
  await within(panel).findByRole("button", {name: "Copied"});
  expect(copy.mock.calls[1][0]).toContain("--fps 30");
  fireEvent.keyDown(fps, {key: "Escape"});
  await waitFor(() => expect(screen.queryByRole("region", {name: "Export your scene"})).toBeNull());
  expect(document.activeElement).toBe(summary);
});

it("uses the library callback for ordinary back clicks and retains native link destinations", () => {
  const onBack = vi.fn();
  const view = render(<ScenePreview onBack={onBack} backHref="#scenes"/>);
  const link = within(controls()).getByRole("link", {name: "Back to scenes"});
  expect(fireEvent.click(link)).toBe(false);
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(link.getAttribute("href")).toBe("#scenes");
  fireEvent.click(link, {ctrlKey: true});
  expect(onBack).toHaveBeenCalledTimes(1);
  view.rerender(<ScenePreview onBack={onBack}/>);
  fireEvent.click(within(controls()).getByRole("button", {name: "Back to scenes"}));
  expect(onBack).toHaveBeenCalledTimes(2);
  expect(within(controls()).getByText("Get started")).toBeTruthy();
});
