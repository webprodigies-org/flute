import { useState } from 'react';
import { BrandAttribution } from './BrandAttribution';

/** SOURCE OF TRUTH: GettingStarted, FIRST_SCENE_PROMPT.
 * WHAT: installed setup instructions and a copyable external-agent handoff.
 * WHY: empty library and standalone preview share the same honest authoring path.
 * WHERE: SceneLibrary and ScenePreview; CLI guide / generated FLUTE.md own authoring rules.
 */
const FIRST_SCENE_PROMPT = 'Read FLUTE.md and run npx flute guide. Inspect this app’s existing components, styles and providers. Ask me which UI to feature, then create a Flute scene using the real components, intentional perspective, focal depth and motion. Save the recipe and matching component in src/flute/scenes/ so they appear in the scene library. Keep the app’s original design and data context.';

export function GettingStarted({label = 'Get started'}: {label?: string}) {
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  return <details className="flute-onboarding">
    <summary className="flute-control">{label}</summary>
    <div className="flute-onboarding-content">
      <ol>
        <li>In your app’s terminal, run <code>npx flute init</code> once to set up Flute.</li>
        <li>Keep your app’s dev server running. Give your coding agent the generated <code>FLUTE.md</code> and <code>npx flute guide</code>.</li>
        <li>Ask your agent to create a scene from your existing UI. Save each recipe in <code>src/flute/scenes/</code> with its matching component. Flute discovers the files automatically.</li>
      </ol>
      <p className="flute-prompt-label">Start in your coding agent</p>
      <p className="flute-prompt">{FIRST_SCENE_PROMPT}</p>
      <button className="flute-control" disabled={copyState === 'copying'} onClick={async () => {
        setCopyState('copying');
        try { await navigator.clipboard.writeText(FIRST_SCENE_PROMPT); setCopyState('copied'); }
        catch { setCopyState('failed'); }
      }}>{copyState === 'copied' ? 'Prompt copied' : copyState === 'copying' ? 'Copying…' : 'Copy starter prompt'}</button>
      <p className="flute-copy-status" role="status">{copyState === 'failed' ? 'Clipboard unavailable. Select and copy the prompt above.' : copyState === 'copied' ? 'Paste it into your coding agent to begin.' : 'Your agent edits the source. Return here to preview and refine.'}</p>
      <BrandAttribution/>
    </div>
  </details>;
}
