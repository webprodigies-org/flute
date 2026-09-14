import { useMemo, useState, type ReactNode } from "react";
import { Surface } from "../react";
import type { PreviewDefinitionInput } from "../core";
import { ScenePreview } from "./ScenePreview";
import {SceneModuleLibrary,type SceneModules} from "./modules";
export {SceneLibrary} from "./SceneLibrary";
export type {SceneLibraryProps} from "./SceneLibrary";
export type {SceneModules} from "./modules";
import type { PreviewHot } from "./connection";
export { ScenePreview } from "./ScenePreview";
export type { ScenePreviewProps } from "./ScenePreview";
export type { PreviewHot } from "./connection";

/** SOURCE OF TRUTH: ProjectPreview installed application adapter.
 * WHAT: retain the explicit development/query guard around original host children.
 * WHY: the real product shell frames live UI without copying data or changing normal routes.
 * WHERE: CLI injects this adapter; ScenePreview owns all playback and chrome.
 */
export type ProjectPreviewProps = {children?: ReactNode; projectId: string; enabled: boolean; hot?: PreviewHot; sceneModules?: SceneModules};
const initialDefinition: PreviewDefinitionInput = {
  scene: {camera: {perspective:1800,rotateX:4,rotateY:-7},focus:{distance:1800,fStop:8,maxBlur:6},nodes:[{id:"flute-application"}]},
};
export function ProjectPreview({children, projectId, enabled, hot, sceneModules}: ProjectPreviewProps) {
  const [entry] = useState(() => {
    if (typeof window === "undefined") return null;
    const url = new URL(window.location.href);
    const requested = url.searchParams.get("flute-preview") === "1";
    url.searchParams.delete("flute-preview");
    url.searchParams.delete("flute-scene");
    return {requested, back: url.pathname + url.search + url.hash};
  });
  const content = useMemo(() => <Surface id="flute-application" style={{width:"100%",minHeight:980}}>{children}</Surface>, [children]);
  if (!enabled || !entry?.requested) return children;
  if(sceneModules) return <div data-flute-project={projectId}><SceneModuleLibrary modules={sceneModules} hot={hot} backHref={entry.back}/></div>;
  return <div data-flute-project={projectId}><ScenePreview title="Your application" definition={initialDefinition} backHref={entry.back} hot={hot}>
    {content}
  </ScenePreview></div>;
}
