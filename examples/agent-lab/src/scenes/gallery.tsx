import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Scene,
  SCENE_BACKGROUND,
  Surface,
  SceneErrorBoundary,
  motionDuration,
  useSceneCapture,
  type SceneIssue,
} from "@flute/scene";
import { Dashboard } from "@/components/dashboard";
import { SectionCards } from "@/components/section-cards";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import data from "@/app/dashboard/data.json";
import { recipes, reviews, type Recipe } from "./recipes";
import "./scenes.css";

// SOURCE OF TRUTH: ScenePlayer elapsed presentation clock and live host bindings.
// WHAT: play, pause, seek and capture share one clock. WHY: deterministic inspection
// without duplicating Flute evaluation. WHERE: recipes.ts owns all spatial motion.
function Panel({ kind }: { kind: Recipe["panels"][number]["component"] }) {
  if (kind === "dashboard") return <Dashboard animate={false} />;
  if (kind === "metrics") return <SectionCards />;
  if (kind === "chart") return <ChartAreaInteractive animate={false} />;
  return <DataTable data={data} />;
}
function ScenePlayer({ recipe }: { recipe: Recipe }) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [issues, setIssues] = useState<SceneIssue[]>([]);
  const [scale, setScale] = useState(1);
  const [fullSize, setFullSize] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const duration = motionDuration(recipe.motion);
  // Keep host components outside per-frame reconciliation; Scene still updates spatial state.
  const panels = useMemo(() => recipe.panels.map((panel) => (
                <Surface
                  key={panel.id}
                  id={panel.id}
                  transform={
                    recipe.scene.nodes.find((node) => node.id === panel.id)
                      ?.transform
                  }
                  style={{
                    position: "absolute",
                    left: panel.left,
                    top: panel.top,
                    width: panel.width,
                  }}
                >
                  <div
                    className="scene-panel @container/main"
                    data-panel={panel.id}
                    style={{
                      height: panel.height,
                      overflow: panel.height ? "auto" : undefined,
                    }}
                  >
                    <Panel kind={panel.component} />
                  </div>
                </Surface>
              )), [recipe]);
  const seek = useCallback(
    (value: number) => {
      setPlaying(false);
      setTime(Math.max(0, Math.min(duration, value)));
    },
    [duration],
  );
  useSceneCapture({ durationMs: duration, seek });
  useEffect(() => {
    const el = viewport.current!;
    const observer = new ResizeObserver(() => setScale(el.clientWidth / 1400));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = now - previous;
      previous = now;
      setTime((value) => Math.min(duration, value + delta));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration]);
  useEffect(() => {
    if (time >= duration) setPlaying(false);
  }, [time, duration]);
  return (
    <>
      <div className="scene-controls">
        <Button
          onClick={() => {
            if (time >= duration) setTime(0);
            setPlaying((v) => !v);
          }}
        >
          {playing ? "Pause" : "Play"}
        </Button>
        <Button variant="outline" onClick={() => seek(0)}>
          Restart
        </Button>
        <Button
          variant="outline"
          aria-pressed={fullSize}
          onClick={() => setFullSize((v) => !v)}
        >
          {fullSize ? "Fit scene" : "Inspect at full size"}
        </Button>
        <label className="scene-seek">
          Scene time
          <input
            aria-label="Scene time"
            type="range"
            min="0"
            max={duration}
            step="10"
            value={time}
            onChange={(e) => seek(Number(e.target.value))}
          />
        </label>
        <output data-testid="time">
          {(time / 1000).toFixed(2)} / {duration / 1000}s
        </output>
      </div>
      <div
        ref={viewport}
        className={`scene-viewport ${fullSize ? "scene-full-size" : ""}`}
        tabIndex={0}
        aria-label="Scene viewport; scroll to inspect in full-size mode"
        data-flute-capture="scene"
      >
        <div
          style={{
            width: 1400,
            height: 980,
            transform: `scale(${fullSize ? 1 : scale})`,
            transformOrigin: "top left",
          }}
        >
          <SceneErrorBoundary resetKey={recipe.id}>
            <Scene
              camera={recipe.scene.camera}
              focus={recipe.scene.focus}
              motion={recipe.motion}
              timeMs={time}
              style={{ width: 1400, height: 980 }}
              onDiagnostics={setIssues}
            >
              {panels}
            </Scene>
          </SceneErrorBoundary>
        </div>
      </div>
      <p className="text-sm text-muted-foreground" data-testid="diagnostics">
        {issues.length
          ? issues.map((issue) => issue.message).join("; ")
          : "Ready to inspect"}
      </p>
    </>
  );
}
export function SceneGallery() {
  const requested = new URLSearchParams(location.search).get("scene");
  const recipe = recipes.find((item) => item.id === requested);
  return (
    <main className="scene-gallery" style={{"--flute-void":SCENE_BACKGROUND,background:SCENE_BACKGROUND} as CSSProperties}>
      <a href="./index.html" className="text-sm underline">
        ← Dashboard
      </a>
      <h1 className="text-3xl font-semibold tracking-tight mt-6">
        One dashboard. Three perspectives.
      </h1>
      <nav aria-label="Scenes" className="scene-nav">
        {recipes.map((item) => (
          <a
            key={item.id}
            href={`?scene=${item.id}`}
            aria-current={item === recipe ? "page" : undefined}
          >
            {item.title}
          </a>
        ))}
      </nav>
      {!recipe ? (
        <p>Scene not found. Choose one of the three scenes above.</p>
      ) : (
        <>
          <h2 className="text-xl font-medium">{recipe.title}</h2>
          <p className="text-muted-foreground mb-5">{recipe.description}</p>
          {reviews[recipes.indexOf(recipe)].valid ? (
            <ScenePlayer key={recipe.id} recipe={recipe} />
          ) : (
            <p role="alert">This scene could not be validated.</p>
          )}
        </>
      )}
    </main>
  );
}
