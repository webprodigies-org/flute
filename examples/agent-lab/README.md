# Agent lab: three live Flute compositions

Run root `npm run setup:agent-lab`, then `npm --prefix examples/agent-lab run dev`.
Open the host's `/index.html`, then **Explore three animated mockups**.

| Route | Independent intent |
| --- | --- |
| `index.html?scene=pullback` | **The bigger picture**: a close oblique dashboard view pulls back and levels into a readable application window. |
| `index.html?scene=assembly` | **Pieces of the picture**: the original metrics, chart and document table converge from separate depths. |
| `index.html?scene=orbit` | **Follow the signal**: foreground visitor chart, recessed metrics, lateral camera travel and a widening moving focus field. |

Each uses 5,000 authored milliseconds with Flute's default half-speed playback: 10 seconds presented. All start paused, including reduced-motion preference. Play/Pause, Restart and Scene time operate one elapsed clock. **Inspect at full size** enables a scrollable 1400×980 composition; **Fit scene** restores the overview. Normal dashboard remains available through **Dashboard**. Query links preserve pathname; the dashboard link uses `./index.html` for the parent's `/agent-trial/index.html` deployment.

## Source and fidelity

`src/scenes/recipes.ts` owns IDs and motion metadata; `gallery.tsx` binds existing components and owns only playback/inspection. Installed `Scene`, `Surface`, `SceneErrorBoundary`, `motionDuration`, `reviewAuthoring` and `useSceneCapture` own their respective library behavior. No custom renderer, transforms evaluator, focus masks, external dependency, builder or server API was introduced.

The whole dashboard and original `SectionCards`, `ChartAreaInteractive`, `DataTable`, data and providers are reused. Cards retain their original direct-child styling. Chart receives an optional `animate` flag, defaulting to its original behavior; scene instances disable Recharts' independent mount animation. The dashboard forwards that flag. A scene-only sidebar containment rule changes its fixed viewport height to the authored application window. Scrolling the application/table windows exposes content beyond their visible crop.

## Fresh-context trial record

- Assignment identity verified through `task_context`: provider **codex**, model **gpt-6-astra**, run `065dfd2c-1faa-4d1d-b348-fecedb89684d`, ticket `368d95f6-0f34-46ff-962a-1ea76a8d7a73`. No delegation.
- Started discovery with `npx flute --help` inside this host. Dependencies were missing. Authorized root setup initially failed because Vite was absent; host `npm ci`, then `npm run setup:agent-lab` restored the installed tarball. No setup implementation was read.
- Learning sources: installed CLI `--help`, `guide`, `guide --json`, installed package manifest and exported TypeScript declarations; this host's entry, styles, dashboard and component source. CLI guide deeply equals public `getAuthoringGuide()` in the executable check.
- Unavoidable governance context: supplied AGENTS instructions, root `MORPHITE-GUARDRAIL-v2.md`, authoritative `task_context` (which includes matrix/product governance), root directory listing, `read_patterns` (empty). Host required a Brain title/description scan before allowing setup; the returned delivery-workflow candidate was not opened. No Brain body or prior ticket/message was read for creative guidance. Parent messages supplied only deployment path requirements.
- No `demo/`, `examples/dashboard-lab/`, root README/docs or root library implementation was read for creative guidance. The three intentions above were chosen independently from the installed concepts and this dashboard's content; no reference recipe was copied.
- No blocking public API/guide gap was encountered. The installed guide explained coordinate signs, camera-attached focus, half-speed timing, stable live surfaces and the metadata review limitation. Exact track syntax came from its API description/declarations.

## Verification and limits

`npm --prefix examples/agent-lab run build` and `npm --prefix examples/agent-lab run check:scenes` are Ticket checks. Browser execution uses Morphite `run_command` because native Chromium execution is OS blocked. The check owns a temporary local Vite server on this runtime's allocated app port and closes it after Chromium exits.

The browser check verifies all metadata with canonical review; invalid duplicate IDs and unknown motion targets are rejected. All three reviews return valid, no issues/advice, and `requiresVisualReview: true`. It compares installed CLI/package guidance, samples 0/2.5/5/7.5/10 seconds, checks scene diagnostics, confirms transformed movement, unique chosen content and preserved DOM leaf identity, compares original text font/color, exercises play/pause/restart/seek and chart state across seeking, and tests unknown-route recovery to the ordinary dashboard. At 390×844 it checks playback, absence of page overflow and full-size scrolling. A second run with `TRIAL_BASE=/agent-trial/` passed.

Actual desktop and mobile screenshots were inspected, including initial, intermediate and final compositions. This caught and corrected a viewport-height sidebar spill. Orbit visibly transitions between sharp and soft regions within live surfaces. Generated screenshots and `report.json` live in ignored `artifacts/`; regenerate with the check. No browser page errors were reported. Production build reports the host's existing Vite configuration warning and a large bundle warning.

This is one successful Codex/model trial, not evidence that every LLM can discover or use Flute. It does not establish cross-browser performance, physical lens accuracy, pixel equality for every component, or production publication. Small-screen fit mode is an overview; full-size mode is provided for legible inspection. Parent owns combined integration and publication. No export was requested or produced.
