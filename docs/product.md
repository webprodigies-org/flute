# Product

Flute turns a developer's existing application components into cinematic 3D motion through their own coding agent. Developers work in source, keep their existing providers/data/styles and refine a live preview. There is no screenshot upload, product login or visual builder requirement.

## Browser experience

The real product uses one minimal preview shell: black scene space, generous padding, plain rounded controls over a progressive bottom blur. Play/pause, replay, a timeline and export are the current controls. Empty/static scenes clearly disable unavailable actions. Source errors explain recovery; changes become visible through the host's development server.

The repository's browser entry opens this real interface in an empty state until real application content is supplied. It does not claim a connection or populate a pretend dashboard. The user explicitly requested deleting all demo and practice applications; their source, galleries, videos and publishing scripts are retired. Automated tests remain separate and do not ship as product pages.

An installed `ProjectPreview` gives an initial view of the unmodified host. Agents author dedicated scene routes using the shared `ScenePreview` and existing `Surface` primitives. The installed `flute guide` explains the current API and cinematic principles. The developer's existing Claude/GPT coding-agent subscription runs that agent; Flute does not own provider authentication or AI infrastructure.

## Visual language

Default compositions use deliberate close oblique camera framing, surface-aligned camera travel, meaningful foreground/background depth and smooth, slow motion. Camera surveys, plating, floating detail and micro shots are concepts, not mandatory templates. Preserve the host design and let creators override artistic defaults.

Focus follows camera-axis depth through distance and aperture. Equal-depth regions can remain sharp; near and far regions soften progressively. Performance is a release priority. Live DOM filtering approximates lens blur; Blender ray-traced bokeh is not claimed. Technical validation never certifies artistic quality.

## Output and next boundaries

Local MP4 export at 30/60/120 FPS is delivered through the canonical CLI and live capture clock. The preview supplies an export command; it does not present a nonexistent browser download service. FFmpeg and Chromium are local prerequisites.

Interactive focus editing was mentioned as a future possibility, not authorized delivery in this slice. Recipe reopening is delivered in the current source catalog; the final agent workflow completes the local MVP; hosted/commercial capabilities stay deferred. No builder, account system or licensing infrastructure is added to the current preview.

## Scene library and scene view

The home page lists the project's authored scene files automatically. It is a real clickable, scrollable list presented as a tilted plane in black space. Native scrolling moves that whole plane like movie credits while the camera and lens remain fixed. Rows fade at the top browser edge without disappearing early, and the scroll range lets both the first and last item enter the focused center. Selecting a row opens that scene; direct links, back navigation and reload resolve the same versioned source.

Scene playback fills the full viewport with proportional cover scaling and edge cropping, like a full-screen video. The credits list recedes at the top and approaches at the bottom, with a clear center and gentler blur above and below so about three center items remain readable. All controls and status sit at the bottom over a transparent progressive blur fading into the scene, with plain high-contrast rounded controls. The product contains no drag-and-drop builder. Existing coding agents create a JSON recipe and matching host component; validation gives repair instructions for missing or incompatible files.

The user explicitly authorized a new separate local project to review multiple scenes after retiring the old demos. `local-project/` is that installed-package host, not product data or a bundled gallery. The product entry remains empty for an unconnected project. Its local test scenes never ship inside the library.

Scene tiles show small cached snapshots of their actual scenes. The coding agent creates or refreshes them using `flute snapshot`; unavailable snapshots fall back to scene numbers. Snapshot generation captures local rendered content, and the list displays ordinary images to keep scrolling inexpensive.

## Local open-source MVP

Flute by [Web Prodigies](https://www.youtube.com/@webprodigies) is an MIT-licensed local package. The final slice combines safe installation, a discoverable FLUTE.md coding-agent handoff, the version-matched conceptual guide and tested source example, one-project scene library, live revision, snapshots and MP4 export. Users bring their existing repository-capable coding agent; no product login, provider subscription connection, multi-project selector or hosted infrastructure is required.

React DOM integration is framework-independent (18.2+ and 19). Next.js App/Pages Router and standard Vite have automatic connections; other wrappers, including Electron renderers, use the same explicit portable React connection. No framework migration is required. Non-DOM React Native is outside this renderer. Public npm distribution is now authorized: viewers must be able to install the library through a normal npm command and use the same agent guide and studio. Public version `@webprodigies/flute@0.1.0` is published under `webprodigies`, with source at `webprodigies-org/flute`. On 2026-09-15, a fresh registry installation passed setup, the installed guide, studio, live revisions, snapshots, MP4 export and production exclusion. Viewers install with `npm install @webprodigies/flute` and run `npx flute init` inside a supported existing project. The guide teaches cinematic relationships and shared APIs, leaving composition and artistic overrides to the creator. The executable example proves wiring rather than imposing a common design. Future plans remain deferred and are not part of this MVP.

Maintainer verification runs locally. GitHub only builds and publishes a new package version pushed to `main`; unchanged versions skip, and routine code/documentation pushes do not run test jobs. A version bump is required to update the immutable npm release. GitHub stores no new diagnostic artifacts for this workflow.
