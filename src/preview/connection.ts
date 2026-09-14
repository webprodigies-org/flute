import { useEffect, useState } from "react";

/** SOURCE OF TRUTH: Vite preview connection adapter.
 * WHAT: translate host development events into connection/recovery messages.
 * WHY: an installed production bundle cannot capture the host's import.meta.hot.
 * WHERE: callers explicitly pass their hot context; no server or polling is created.
 */
export type PreviewHot = {
  on(event: string, listener: (payload: any) => void): void;
  off(event: string, listener: (payload: any) => void): void;
};
export function usePreviewConnection(hot: PreviewHot | undefined, pause: () => void) {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState({connected: true, updating: false, error: ""});
  useEffect(() => {
    if (!hot) return;
    const handlers: Record<string, (payload: any) => void> = {
      "vite:ws:disconnect": () => { pause(); setState({connected: false, updating: false, error: ""}); },
      "vite:ws:connect": () => setState({connected: true, updating: false, error: ""}),
      "vite:beforeUpdate": () => { pause(); setState({connected: true, updating: true, error: ""}); },
      "vite:afterUpdate": () => {setState({connected: true, updating: false, error: ""});setGeneration(value => value + 1);},
      "vite:error": payload => { pause(); setState({connected: true, updating: false,
        error: typeof payload?.err?.message === "string" ? payload.err.message : "The source could not be updated."}); },
    };
    for (const [event, callback] of Object.entries(handlers)) hot.on(event, callback);
    return () => { for (const [event, callback] of Object.entries(handlers)) hot.off(event, callback); };
  }, [hot, pause]);
  return {...state, generation};
}
