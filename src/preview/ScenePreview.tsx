import { useCallback, useEffect, useMemo, useRef, useState, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SUPPORTED_EXPORT_FPS, ExportFrameRateSchema, type PreviewDefinitionInput } from "../core";
import { Scene, SceneErrorBoundary, useSceneCapture } from "../react";
import { usePreviewSession } from "./session";
import { usePreviewConnection, type PreviewHot } from "./connection";
import { BrandAttribution } from "./BrandAttribution";
import { GettingStarted } from "./GettingStarted";
import { previewTheme } from "./theme";

/** SOURCE OF TRUTH: ScenePreview.
 * WHAT: the product's shared browser viewport, playback, source recovery and export entry.
 * WHY: installed projects and the product entry share actual controls, not demo replicas.
 * WHERE: session owns lifecycle; core validates/evaluates; Scene renders original children.
 * Stable portals place the canvas inside the viewport and canonical recovery outside capture.
 * data-flute-preview-chrome marks overlay pixels for the export service to hide in its page.
 * Export opens upward in the scrollable overlay; no viewport space is reserved for controls.
 * Keep children referentially stable during playback. No clone, snapshot or host CSS reset.
 */
export type ScenePreviewProps = {
  definition?: PreviewDefinitionInput;
  children?: ReactNode;
  title?: string;
  backHref?: string;
  /** Intercept ordinary back navigation; modified link clicks keep backHref. */
  onBack?: () => void;
  revision?: unknown;
  hot?: PreviewHot;
};
const timeLabel = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2,"0")}`;
function Glyph({kind}: {kind: "play" | "pause" | "restart" | "export"}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    {kind === "play" ? <path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/> :
      kind === "pause" ? <path d="M8 5v14M16 5v14" strokeWidth="4"/> :
      kind === "restart" ? <path d="M5 9a8 8 0 1 1 0 7M5 3v6h6"/> : <path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>}
  </svg>;
}
function Capture({durationMs, seek}: {durationMs: number; seek: (ms: number) => void}) {
  useSceneCapture({durationMs, seek});
  return null;
}
function ExportMenu({disabled, panelHost}: {disabled: boolean; panelHost: HTMLDivElement | null}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  useEffect(() => {
    if (disabled) setOpen(false);
    else if (open) panelHost?.querySelector("select")?.focus();
  }, [disabled, open, panelHost]);
  const details = useRef<HTMLDetailsElement>(null);
  const [fps, setFps] = useState(60);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  // Shell quoting is presentation only; the CLI owns request validation and file effects.
  const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
  const command = `npx flute export --url ${quote(typeof location === "undefined" ? "http://localhost:5173" : location.href)} --output scene-${fps}.mp4 --fps ${fps}`;
  return disabled ? <button className="flute-control" disabled><Glyph kind="export"/>Export</button> :
    <details className="flute-export" ref={details} onToggle={event => setOpen(event.currentTarget.open)}><summary className="flute-control flute-primary" aria-controls={panelId}><Glyph kind="export"/>Export</summary>
      {open && panelHost && createPortal(<div id={panelId} role="region" aria-label="Export your scene" className="flute-export-panel flute-chrome" onKeyDown={event => {
        if (event.key === "Escape" && details.current) {
          details.current.open = false;
          setOpen(false);
          details.current.querySelector("summary")?.focus();
        }
      }}><strong>Export your scene</strong>
        <p>Run this in your project to save an MP4. Use a new filename for each export.</p>
        <label>Frame rate<select aria-label="Export frame rate" value={fps} onChange={event => {setFps(ExportFrameRateSchema.parse(Number(event.target.value)));setCopied(false);}}>
          {SUPPORTED_EXPORT_FPS.map(value => <option key={value} value={value}>{value} fps</option>)}
        </select></label><code>{command}</code>
        <button className="flute-control flute-primary" onClick={async () => {
          try { await navigator.clipboard.writeText(command);setCopied(true);setCopyError(false); }
          catch { setCopyError(true); }
        }}>{copied ? "Copied" : "Copy command"}</button>
        <p role="status">{copyError ? "Select and copy the command above." : "Requires Chromium and FFmpeg on your machine."}</p>
      </div>, panelHost)}
    </details>;
}

export function ScenePreview({definition: input, children, title = "Untitled scene", backHref, onBack, revision, hot}: ScenePreviewProps) {
  const session = usePreviewSession(input, revision);
  const connection = usePreviewConnection(hot, session.pause);
  const [renderError, setRenderError] = useState("");
  const [size, setSize] = useState({width: 0, height: 0});
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [exportPanel, setExportPanel] = useState<HTMLDivElement | null>(null);
  const resetKey = useMemo(() => ({revision, input, generation: connection.generation}), [revision, input, connection.generation]);
  const failure = useCallback((error: unknown) => {
    session.pause(); setRenderError(error instanceof Error ? error.message : String(error));
  }, [session.pause]);
  useEffect(() => {
    const element = viewport;
    if (!element) return;
    const measure = () => setSize({width: element.clientWidth, height: element.clientHeight});
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element); measure();
    return () => observer?.disconnect();
  }, [viewport]);
  const definition = session.definition;
  const blocked = !session.valid || !connection.connected || !!connection.error || !!renderError;
  const captureSeek = useCallback((ms: number) => {
    if (blocked) throw new Error("Correct the scene before exporting.");
    session.seek(ms);
  }, [blocked, session.seek]);
  const scale = definition && size.width && size.height ? Math.max(size.width / definition.width, size.height / definition.height) : 1;
  const stateText = !connection.connected ? "Reconnecting to your app…" : connection.error ? "Source needs a correction" :
    connection.updating ? "Updating scene…" : renderError || session.issues.length ? "Scene needs a correction" :
    !definition ? "Waiting for a scene" : session.playing ? "Playing" : "Live preview";
  return <main data-flute-preview="" data-flute-state={blocked ? "unavailable" : "ready"}>
    <style>{previewTheme}</style>
    <div className="flute-viewport" ref={setViewport} aria-label="Scene preview">
      {!definition && <div className="flute-empty flute-chrome">
        <span className="flute-empty-symbol" aria-hidden="true">↗</span>
        <h1>A new perspective<br/>on your product.</h1>
        <p>Your live scene will appear here. Open Flute inside your app, then ask your coding agent to compose its first scene.</p>
      </div>}
    </div>
    <div className="flute-bottom-blur" data-flute-preview-chrome="" aria-hidden="true"><i/><i/><i/></div>
    <footer className="flute-footer flute-chrome" data-flute-preview-chrome="" aria-label="Scene controls">
      <div className="flute-controls">
        <div className="flute-export-slot" ref={setExportPanel}/>
        {(session.issues.length > 0 || connection.error || !connection.connected) && <section className="flute-message flute-chrome" role="alert">
          <strong>{stateText}</strong>
          {session.issues.length > 0 && <><p>Your last valid scene settings are retained. Correct the source to continue.</p>
            <ul>{session.issues.map((issue,index) => <li key={index}>{issue.path}: {issue.message}</li>)}</ul></>}
          {connection.error && <p>{connection.error}</p>}
          {!connection.connected && <p>Keep your development server running. The preview reconnects automatically.</p>}
        </section>}
        {/* Recovery stays in the controls; only live scene content enters the capture viewport. */}
        <SceneErrorBoundary resetKey={resetKey} onError={failure} onReset={() => setRenderError("")}>
          {definition && viewport && createPortal(
            <div className="flute-canvas" data-flute-capture="scene" data-flute-valid={blocked ? "false" : "true"}
              style={{width: "100%", height: "100%"}}>
              {/* One aspect-preserving cover frame fills preview and capture; overflow is cropped, never stretched. */}
              <div style={{position: "absolute", left: "50%", top: "50%", width: definition.width, height: definition.height, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center"}}>
                <Scene camera={definition.scene.camera} focus={definition.scene.focus} motion={definition.motion}
                  timeMs={session.timeMs} onDiagnostics={session.onDiagnostics} style={{width: definition.width, height: definition.height}}>
                  {children}
                </Scene>
              </div>
              <Capture durationMs={session.durationMs} seek={captureSeek}/>
            </div>, viewport)}
        </SceneErrorBoundary>
        <div className="flute-header">
          <div className="flute-heading">
            {backHref ? <a className="flute-control" href={backHref} onClick={event => {
              if (onBack && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                event.preventDefault(); onBack();
              }
            }}>{onBack ? "Back to scenes" : "Back to app"}</a> : onBack && <button className="flute-control" onClick={onBack}>Back to scenes</button>}
            <h1 className="flute-title">{title}</h1>
          </div>
          <ExportMenu disabled={blocked || !session.durationMs} panelHost={exportPanel}/>
        </div>
        {!definition && <GettingStarted/>}
        <div className="flute-dock">
          <button className="flute-control flute-primary flute-icon" disabled={blocked || !session.durationMs}
            aria-label={session.playing ? "Pause" : session.timeMs >= session.durationMs && session.durationMs ? "Replay" : "Play"} onClick={session.toggle}>
            <Glyph kind={session.playing ? "pause" : "play"}/>
          </button>
          <button className="flute-control flute-icon" aria-label="Restart" disabled={!definition} onClick={() => session.seek(0)}><Glyph kind="restart"/></button>
          <input className="flute-timeline" aria-label="Scene time" aria-valuetext={timeLabel(session.timeMs)} type="range"
            min={0} max={session.durationMs || 1} step={10} value={session.timeMs} disabled={blocked || !session.durationMs}
            onChange={event => session.seek(Number(event.target.value))}/>
          <output className="flute-time" data-testid="scene-time">{timeLabel(session.timeMs)} / {timeLabel(session.durationMs)}</output>
        </div>
        <div className="flute-preview-meta"><span className="flute-status" role="status"><span className="flute-status-dot"/>{stateText}</span><BrandAttribution/></div>
      </div>
    </footer>
  </main>;
}
