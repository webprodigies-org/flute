import { CaptureManifestSchema, type CaptureBridge } from "../core/export";
import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
/** SOURCE OF TRUTH: useSceneCapture.
 * WHAT: expose a single explicitly registered live viewport to local frame capture.
 * WHY: exports seek the same controller/Scene clock; no second animation evaluator.
 * WHERE: Node export services read this bridge; callers mark their capture viewport.
 * No network listener, file access, or authentication lives in this browser adapter.
 */
export function useSceneCapture({durationMs,seek,selector='[data-flute-capture="scene"]'}:
  {durationMs:number;seek:(elapsedMs:number)=>void;selector?:string}) {
  const current=useRef(seek);
  current.current=seek;
  useEffect(()=>{
    const host=window as typeof window & {__FLUTE_CAPTURE__?:unknown};
    if(host.__FLUTE_CAPTURE__) throw new Error("Only one capture viewport can be registered per page.");
    const bridge:CaptureBridge={...CaptureManifestSchema.parse({version:1,durationMs,selector}),seek:(elapsedMs:number)=>{
      if(!Number.isFinite(elapsedMs)||elapsedMs<0||elapsedMs>durationMs) throw new Error("Capture time is outside the scene.");
      flushSync(()=>current.current(elapsedMs));
      const viewport=document.querySelector(selector);
      if(viewport?.matches('[data-flute-valid="false"]') || viewport?.querySelector('[data-flute-valid="false"]'))
        throw new Error("Correct scene diagnostics before exporting; some content may bypass depth of field.");
    }};
    host.__FLUTE_CAPTURE__=bridge;
    return ()=>{if(host.__FLUTE_CAPTURE__===bridge)delete host.__FLUTE_CAPTURE__};
  },[durationMs,selector]);
}
