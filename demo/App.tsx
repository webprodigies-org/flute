import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Scene, Surface, SceneErrorBoundary } from "../src/react";
import type { SceneIssue, FocusInput, CameraInput } from "../src/core";
import type { MotionInput } from "../src/core/motion";
import { DashboardProvider, useDashboard } from "./data";
import { RevenueCard, CustomersCard, ActivityCard } from "./cards";

/** SOURCE OF TRUTH KEYWORDS: StorageStudy, storageMotion, explicit scene time.
 * WHAT: demo composition and user-controlled playback of canonical motion recipes.
 * WHY: show independent camera and focal movement without reimplementing evaluation.
 * WHERE: ../src/core/motion evaluates tracks; ../src/react owns live DOM binding;
 * ./data and ./cards retain the existing host provider, API and component identity.
 */
const durationMs = 8000;
const initialFocus = { x: 40, y: -70, z: 0, radius: 150, falloff: 280, maxBlur: 10 } satisfies FocusInput;
const initialCamera = { x: 0, y: 0, z: 0, rotateX: 12, rotateY: -20, rotateZ: -5, perspective: 1600 } satisfies CameraInput;
type Recipe = "fixed" | "travel" | "manual";

function storageMotion(recipe: Recipe): MotionInput {
  const keyframes = (start: number, middle: number, end = start) => [
    { timeMs: 0, value: start }, { timeMs: 4000, value: middle, easing: "easeInOut" as const },
    { timeMs: durationMs, value: end, easing: "easeInOut" as const },
  ];
  if (recipe === "fixed") return { durationMs, tracks: [
    { target: { kind: "camera" }, property: "x", keyframes: keyframes(0, 115, -55) },
    { target: { kind: "camera" }, property: "y", keyframes: keyframes(0, -35, 25) },
    { target: { kind: "camera" }, property: "rotateY", keyframes: keyframes(-20, 8, -12) },
    { target: { kind: "surface", id: "folder-front" }, property: "x", keyframes: keyframes(-35, 100, 30) },
    { target: { kind: "surface", id: "folder-front" }, property: "z", keyframes: keyframes(260, -70, 180) },
    { target: { kind: "surface", id: "folder-rear" }, property: "y", keyframes: keyframes(0, -65, 15) },
    { target: { kind: "surface", id: "customers" }, property: "z", keyframes: keyframes(95, 165, 60) },
  ] };
  if (recipe === "travel") return { durationMs, tracks: [
    { target: { kind: "focus" }, property: "x", keyframes: keyframes(40, -230, 150) },
    { target: { kind: "focus" }, property: "y", keyframes: keyframes(-70, -90, 100) },
    { target: { kind: "focus" }, property: "z", keyframes: keyframes(0, 260, 30) },
    { target: { kind: "focus" }, property: "radius", keyframes: keyframes(150, 45, 80) },
  ] };
  return { durationMs, tracks: [] };
}

function Slider({ label, value, min, max, unit = "px", onChange }: {
  label: string; value: number; min: number; max: number; unit?: string; onChange: (value: number) => void;
}) {
  return <label className="slider-label"><span>{label}<output>{value}{unit}</output></span>
    <input type="range" aria-label={label} min={min} max={max} value={value}
      onChange={event => onChange(Number(event.target.value))} /></label>;
}
function HostDataState({ children }: { children: ReactNode }) {
  const { data, error, retry } = useDashboard();
  if (error) return <div className="data-state" role="alert"><h2>Let’s reconnect your dashboard.</h2>
    <p>{error}</p><button className="primary-button" onClick={retry}>Try again</button></div>;
  if (!data) return <div className="data-state" role="status"><span className="loading-orbit" /><p>Loading your components…</p></div>;
  return children;
}
function Folder({ title, detail, front = false }: { title: string; detail: string; front?: boolean }) {
  return <div className={"folder " + (front ? "folder-front" : "")}>
    <svg viewBox="0 0 150 116" fill="none" aria-hidden="true">
      <path d="M8 19a9 9 0 0 1 9-9h38l15 14h63a9 9 0 0 1 9 9v66a9 9 0 0 1-9 9H17a9 9 0 0 1-9-9Z" fill={front ? "#9183bb" : "#72758d"} />
      <path d="M8 40a9 9 0 0 1 9-9h116a9 9 0 0 1 9 9v59a9 9 0 0 1-9 9H17a9 9 0 0 1-9-9Z" fill={front ? "#b6a9db" : "#a5a8bb"} />
      <path d="M18 33h113" stroke="white" strokeOpacity=".35" />
    </svg><strong>{title}</strong><small>{detail}</small></div>;
}
function StorageStudy() {
  const fixture = new URLSearchParams(window.location.search).get("fixture");
  const [focus, setFocus] = useState(initialFocus);
  const [camera, setCamera] = useState(initialCamera);
  const [recipe, setRecipe] = useState<Recipe>("fixed");
  const [timeMs, setTimeMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [fault, setFault] = useState(fixture === "duplicate" ? "duplicate" : fixture === "invalid" || fixture === "missing" ? "invalid" : "");
  const [issues, setIssues] = useState<SceneIssue[]>([]);
  const [revision, setRevision] = useState(0);
  const motion = useMemo(() => storageMotion(recipe), [recipe]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => { setReduced(media.matches); if (media.matches) setPlaying(false); };
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    if (!playing) return;
    let request = 0;
    let previous: number | undefined;
    // The browser only advances time. Scene owns all interpolation and validation.
    const tick = (now: number) => {
      const elapsed = previous === undefined ? 0 : now - previous;
      setTimeMs(value => Math.min(durationMs, value + elapsed));
      previous = now;
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing]);
  useEffect(() => { if (timeMs >= durationMs) setPlaying(false); }, [timeMs]);
  const reset = () => {
    setPlaying(false); setTimeMs(0); setRecipe("fixed"); setFocus(initialFocus); setCamera(initialCamera);
    setFault(""); setRevision(value => value + 1);
  };
  const manual = () => { setPlaying(false); setRecipe("manual"); setTimeMs(0); };
  const chooseRecipe = (value: Recipe) => {
    setPlaying(false); setTimeMs(0); setRecipe(value); setFocus(initialFocus); setCamera(initialCamera);
  };
  return <div className="app-shell">
    <header className="topbar"><a className="wordmark" href="/">flute<span> / </span><small>Spatial studies</small></a>
      <span className="local-badge"><i /> LOCAL PREVIEW</span></header>
    <main className="main-layout">
      <section className="canvas-area">
        <div className="canvas-title"><div><p className="eyebrow">STUDY 002 — INDEPENDENT FOCUS</p>
          <h1>A different<br /><em>point of view.</em></h1>
          <p className="intro">Move the scene. Let focus have a life of its own.</p></div>
          <span className="study-number">LIVE DOM<br />008.00 SEC</span></div>
        <div className="stage-viewport">
          <div className="stage-frame">
            <div className="stage-grid" aria-hidden="true" />
            <span className="stage-label">NORTHSTAR / STORAGE</span>
            <HostDataState><SceneErrorBoundary resetKey={revision}>
              <Scene className="scene" camera={camera} focus={{ ...focus, radius: fault === "invalid" ? -1 : focus.radius }}
                motion={motion} timeMs={timeMs} onDiagnostics={setIssues}>
                <Surface id="composition" className="composition">
                  <Surface id="storage" className="storage-surface" transform={{ z: -85 }}
                    content={<div className="storage-panel"><div className="storage-nav"><span className="storage-logo">n /</span><span>Workspace</span><b>▣ Storage</b><span>Overview</span><span>Activity</span><small>NORTHSTAR</small></div>
                      <div className="storage-heading"><span>WORKSPACE / FILES</span><h2>Storage</h2><p>A little space for your next big thing.</p><div className="storage-rule" /></div></div>}>
                    <Surface id="folder-rear" className="rear-folder" content={<Folder title="Projects" detail="12 collections" />} />
                    <Surface id="folder-middle" className="middle-folder" transform={{ z: 45 }} content={<Folder title="Resources" detail="Everything you need" />} />
                  </Surface>
                  <Surface id="folder-front" className="foreground-folder" transform={{ x: -35, z: 260, rotateZ: -7 }} content={<Folder title="Ideas" detail="Room to explore" front />} />
                  <Surface id="revenue" className="revenue-surface"><RevenueCard /></Surface>
                  <Surface id={fault === "duplicate" ? "revenue" : "customers"} className="customers-surface" transform={{ z: 95 }}><CustomersCard /></Surface>
                  <Surface id="activity" className="activity-surface" transform={{ z: -45 }}><ActivityCard /></Surface>
                </Surface>
              </Scene>
            </SceneErrorBoundary></HostDataState>
            <div className="stage-bottom"><span><i /> CONNECTED COMPONENTS</span><span>PERSPECTIVE / DEPTH / FOCUS</span></div>
          </div>
        </div>
        <div className="transport">
          <button className="play-button" aria-label={playing ? "Pause" : timeMs >= durationMs ? "Replay" : "Play"}
            onClick={() => { if (timeMs >= durationMs) setTimeMs(0); setPlaying(value => !value); }}>{playing ? "Ⅱ" : "▶"} <span>{playing ? "Pause" : timeMs >= durationMs ? "Replay" : "Play"}</span></button>
          <label className="timeline"><span className="sr-only">Scene time</span><input type="range" aria-label="Scene time" min={0} max={durationMs} step={10} value={timeMs} onChange={event => { setPlaying(false); setTimeMs(Number(event.target.value)); }} /></label>
          <output className="timecode" data-testid="scene-time">{(timeMs / 1000).toFixed(2)}<span> / 8.00 s</span></output>
          <button className="reset-button" onClick={reset} aria-label="Reset composition">↺</button>
        </div>
        <div className="canvas-footer"><span>{recipe === "fixed" ? "Focus stays still. Camera and layers move through it." : recipe === "travel" ? "Camera stays still. Focus travels and tightens." : "Manual composition. Every control is independent."}</span>
          <span>{reduced ? "Reduced motion · starts paused" : "Drag the timeline to explore"}</span></div>
        <details className="proof-details"><summary>About this live scene</summary><p>The Revenue, Customers and Activity cards use the original host provider and API. Try their controls, then move the scene: their state stays connected.</p>
          <div className="proof-actions"><button onClick={() => { setPlaying(false); setFault("invalid"); }}>Try invalid focus</button><button onClick={() => { setPlaying(false); setFault("duplicate"); }}>Try duplicate ID</button><button onClick={() => setFault("")}>Restore valid scene</button><a href="?fixture=baseline">Open host baseline ↗</a></div>
        </details>
      </section>
      <aside className="inspector" aria-label="Scene controls">
        <p className="eyebrow">THE COMPOSITION</p><h2>Find your focus.</h2><p className="inspector-intro">One scene. Two independent movements.</p>
        <section className="control-section"><h3>Choreography <span>01</span></h3>
          <div className="recipe-options">{([{ id: "fixed", title: "Move through focus", detail: "Fixed focus · camera & layers move" }, { id: "travel", title: "Let focus wander", detail: "Still camera · focus travels & tightens" }] as const).map(item =>
            <button key={item.id} aria-pressed={recipe === item.id} onClick={() => chooseRecipe(item.id)}><span className="radio-dot" /><span>{item.title}<small>{item.detail}</small></span></button>)}</div>
          <p className="control-hint">Adjusting a slider pauses the recipe and opens manual composition.</p>
        </section>
        <section className="control-section"><h3>Focal point <span>02</span></h3>
          <div className="slider-grid">{([{ key: "x", label: "Focus horizontal", min: -350, max: 350 }, { key: "y", label: "Focus vertical", min: -250, max: 250 }, { key: "z", label: "Focus depth", min: -350, max: 400 }, { key: "radius", label: "Clear radius", min: 0, max: 500 }, { key: "falloff", label: "Blur falloff", min: 1, max: 600 }, { key: "maxBlur", label: "Maximum blur", min: 0, max: 16 }] as const).map(item =>
            <Slider key={item.key} {...item} value={focus[item.key]} onChange={value => { manual(); setFocus(current => ({ ...current, [item.key]: value })); }} />)}</div>
          <p className="control-hint">Centered in the view. Positive depth comes toward you.</p>
        </section>
        <section className="control-section"><h3>Camera <span>03</span></h3>
          <div className="slider-grid">{([{ key: "x", label: "Camera horizontal", min: -250, max: 250 }, { key: "y", label: "Camera vertical", min: -180, max: 180 }, { key: "z", label: "Camera depth", min: -250, max: 250 }, { key: "rotateY", label: "Horizontal tilt", min: -40, max: 40 }, { key: "rotateX", label: "Vertical tilt", min: -30, max: 30 }] as const).map(item =>
            <Slider key={item.key} {...item} unit={item.key.startsWith("rotate") ? "°" : "px"} value={camera[item.key]} onChange={value => { manual(); setCamera(current => ({ ...current, [item.key]: value })); }} />)}</div>
        </section>
        {issues.length > 0 && <div className="diagnostics" role="status"><strong>Scene needs a correction.</strong>{issues.map((issue, index) => <p key={index}>{issue.message}</p>)}<button onClick={() => setFault("")}>Restore valid scene</button></div>}
      </aside>
    </main><footer className="bottom-bar"><span><i /> Rendered locally</span><span>Real components. A new dimension.</span><span>FLUTE / 002</span></footer>
  </div>;
}
export default function App() {
  const baseline = new URLSearchParams(window.location.search).get("fixture") === "baseline";
  return <DashboardProvider>{baseline ? <HostDataState><div className="baseline"><RevenueCard /><CustomersCard /><ActivityCard /></div></HostDataState> : <StorageStudy />}</DashboardProvider>;
}
