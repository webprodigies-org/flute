import { useState, type ReactNode } from "react";
import type { CameraInput, FocusInput } from "../core";
import { Scene, SceneErrorBoundary, Surface } from "../react";

/** SOURCE OF TRUTH KEYWORDS: ProjectPreview, installed application preview.
 * WHAT: opt-in page framing around the host's original React children.
 * WHY: reuse live providers, events and state without copying or fetching host UI.
 * WHERE: the installed adapter supplies its development guard; ../react owns
 * registration/recovery and ../core owns all camera and progressive focus math.
 * Query activation is sampled once per mount; navigation back reloads the host.
 */
export type ProjectPreviewProps = {
  children?: ReactNode;
  projectId: string;
  enabled: boolean;
};

const camera = {
  perspective: 1800,
  rotateX: 4,
  rotateY: -7,
} satisfies CameraInput;
const focus = {
  x: 0, y: 0, z: 0,
  radius: 240, falloff: 700, maxBlur: 3,
} satisfies FocusInput;

export function ProjectPreview({ children, projectId, enabled }: ProjectPreviewProps) {
  const [entry] = useState(() => {
    if (typeof window === "undefined") return null;
    const url = new URL(window.location.href);
    const requested = url.searchParams.get("flute-preview") === "1";
    url.searchParams.delete("flute-preview");
    return { requested, back: url.pathname + url.search + url.hash };
  });
  if (!enabled || !entry?.requested) return children;

  return (
    <div data-flute-project={projectId} style={{
      minHeight: "100vh", width: "100%", boxSizing: "border-box", background: "#edf1f5",
    }}>
      <header style={{
        display: "flex", flexWrap: "wrap", alignItems: "center",
        justifyContent: "space-between", gap: 16, padding: "20px 24px",
        color: "#17243a", background: "#fff",
        borderBottom: "1px solid #d8e0ea",
        fontFamily: "system-ui, sans-serif", fontSize: 14, lineHeight: 1.5,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <strong style={{ fontSize: 20, letterSpacing: "-0.04em" }}>Flute</strong>
          <span style={{
            border: "1px solid #a6d8c4", borderRadius: 999,
            padding: "4px 10px", color: "#145840", background: "#e8f7ef",
          }}>Live preview</span>
        </div>
        <a href={entry.back} style={{
          color: "#244b83", padding: "10px 0", textUnderlineOffset: 4,
        }}>Back to app</a>
        <p style={{ flexBasis: "100%", margin: 0, color: "#4b5b70" }}>
          Your app is live. Interact with it here, and edit your existing code to see changes.
        </p>
      </header>
      <section aria-label="Application preview" style={{ padding: "32px clamp(12px, 4vw, 64px) 64px" }}>
        <SceneErrorBoundary resetKey={projectId}>
          <Scene camera={camera} focus={focus} style={{ width: "100%", minHeight: "60vh" }}>
            <Surface id="flute-application" style={{ width: "100%", minHeight: "60vh" }}>
              {children}
            </Surface>
          </Scene>
        </SceneErrorBoundary>
      </section>
    </div>
  );
}
