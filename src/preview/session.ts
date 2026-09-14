import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RESOURCES, motionDuration, type PreviewDefinition, type PreviewDefinitionInput, type SceneIssue } from "../core";

/** SOURCE OF TRUTH: usePreviewSession.
 * WHAT: one presentation cursor, source revision retention and playback lifecycle.
 * WHY: UI and capture seek the same canonical motion clock without remounting host UI.
 * WHERE: ScenePreview owns presentation; core/presentPreview validates source revisions.
 */
export function usePreviewSession(input: PreviewDefinitionInput | undefined, revision: unknown) {
  const result = useMemo(() => input === undefined ? null : RESOURCES["present-preview"](input), [input]);
  const [accepted, setAccepted] = useState<PreviewDefinition | null>(() => result?.valid ? result.definition : null);
  const definition = result?.valid ? result.definition : input === undefined ? null : accepted;
  const [timeMs, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [renderIssues, setRenderIssues] = useState<SceneIssue[]>([]);
  const durationMs = definition?.motion ? motionDuration(definition.motion) : 0;
  const cursor = useRef(timeMs);
  cursor.current = timeMs;
  const issues = result && !result.valid ? result.issues : renderIssues;
  const valid = !!definition && !!result?.valid && issues.length === 0;
  const pause = useCallback(() => setPlaying(false), []);
  const seek = useCallback((value: number) => {
    if (!Number.isFinite(value)) return;
    setPlaying(false);
    setTime(Math.max(0, Math.min(durationMs, value)));
  }, [durationMs]);
  useEffect(() => {
    setPlaying(false);
    if (result?.valid) setAccepted(result.definition);
    if (input === undefined) { setAccepted(null); setTime(0); setRenderIssues([]); }
    else setTime(value => Math.min(value, durationMs));
  }, [result, input, revision, durationMs]);
  useEffect(() => { if (!valid) pause(); }, [valid, pause]);
  useEffect(() => {
    if (!playing || !valid || !durationMs) return;
    const started = performance.now() - cursor.current;
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(durationMs, now - started);
      setTime(next);
      if (next < durationMs) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, valid, durationMs]);
  useEffect(() => {
    const media = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
    const changed = () => { if (media?.matches) pause(); };
    const visibility = () => { if (document.hidden) pause(); };
    media?.addEventListener("change", changed);
    document.addEventListener("visibilitychange", visibility);
    return () => { media?.removeEventListener("change", changed); document.removeEventListener("visibilitychange", visibility); };
  }, [pause]);
  const toggle = () => {
    if (!valid || !durationMs) return;
    if (cursor.current >= durationMs) setTime(0);
    setPlaying(value => !value);
  };
  return {definition, timeMs, durationMs, playing, valid, issues, seek, pause, toggle, onDiagnostics: setRenderIssues};
}
