import { useEffect, useRef, useState } from "react"
import { Scene, Surface, SceneErrorBoundary } from "@flute/scene"
import { Dashboard } from "@/components/dashboard"
import { SpatialSidebar } from "./sidebar-layer"
import { compactShot, desktopShot, dashboardTilt, durationMs } from "./sidebar-recipe"
import "./sidebar-scene.css"

// Presentation clock only: canonical Scene evaluates every frame from explicit time.
// The dashboard element stays stable; playback never clones or remounts live rows.
const dashboard = <SpatialSidebar value={true}><Dashboard /></SpatialSidebar>
export function SidebarScene() {
  const [compact, setCompact] = useState(() => matchMedia("(max-width: 600px)").matches)
  const shot = compact ? compactShot : desktopShot
  useEffect(() => {
    const query = matchMedia("(max-width: 600px)")
    const update = () => setCompact(query.matches)
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timeRef = useRef(time)
  timeRef.current = time
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)")
    const pause = () => { if (preference.matches) setPlaying(false) }
    preference.addEventListener("change", pause)
    return () => preference.removeEventListener("change", pause)
  }, [])
  useEffect(() => {
    if (!playing) return
    const started = performance.now() - timeRef.current
    let frame = 0
    const tick = (now: number) => {
      const next = Math.min(durationMs, now - started)
      setTime(next)
      if (next < durationMs) frame = requestAnimationFrame(tick)
      else setPlaying(false)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])
  return <main className="sidebar-study dark">
    <header className="study-header"><div><span className="study-eyebrow">FLUTE / DASHBOARD 01</span>
      <h1>A sidebar, in depth.</h1></div><a href="/">Open dashboard ↗</a></header>
    <div className="shot-viewport">
      <SceneErrorBoundary resetKey="sidebar-shot">
        <Scene className="sidebar-shot" camera={shot.camera} focus={shot.focus} motion={shot.motion} timeMs={time}>
          <Surface id="dashboard-plane" transform={dashboardTilt} style={{ position: "absolute", width: 1280, height: 920, left: "50%", top: "50%", marginLeft: -640, marginTop: -460 }}>
            {dashboard}
          </Surface>
        </Scene>
      </SceneErrorBoundary>
    </div>
    <footer className="study-controls">
      <button onClick={() => { if (time >= durationMs) setTime(0); setPlaying(!playing) }} aria-label={playing ? "Pause" : "Play"}>{playing ? "Pause" : "Play"}</button>
      <button onClick={() => { setTime(0); setPlaying(false) }}>Reset</button>
      <input aria-label="Scene time" type="range" min="0" max={durationMs} step="10" value={time} onChange={e => { setPlaying(false); setTime(Number(e.target.value)) }} />
      <output data-testid="scene-time">{(time / 1000).toFixed(1)} / 11s</output>
      <span className="study-caption">One dashboard. Fifteen live layers.</span>
    </footer>
  </main>
}
