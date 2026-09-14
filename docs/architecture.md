# Architecture

Morphite Board owns scope and build order. Slice ad6d2430-a222-5b8f-a296-e24724f4a81d established live surfaces. Slice 588fd521-ca29-51af-a3f0-db5733e87380 extends that owner with independent progressive focus, camera translation and deterministic motion. This document describes the implemented interface, not another build plan.

Scene schemas live in src/core/scene.ts (version 2). Spatial evaluation, coordinate conventions and focus-mask generation live in src/core/spatial.ts. MotionSchema/evaluateMotion own explicit-time tracks in src/core/motion.ts. RESOURCES binds the current operation identities; React consumes it without copying their policy. See README for public usage and limitations.

Scene accepts camera, focus, motion, timeMs, children, style/className and onDiagnostics. Surface/Motion accept stable id, transform, children and optional content. useSceneTime exposes the speed-adjusted authored time for opt-in component adapters. SceneErrorBoundary provides retry and resetKey recovery through react-error-boundary, an external dependency confined to the React adapter.

Registration is Scene-scoped with mount tokens and ResizeObserver cleanup. Measurements are untransformed border-box centers relative to the nearest registered parent or scene center. The renderer preserves provider context, DOM identity and interaction during prop/time changes. Visual leaves receive the progressive filter/opacity; spatial groups retain preserve-3d. Invalid input and removed motion targets recover without rebuilding the host subtree.

Focus is independent camera-space xyz plus radius/falloff/maxBlur, never a component ID. It stays screen-locked under camera movement. One field computes distance across each planar surface, including perpendicular depth. SVG Gaussian basis masks approximate that field on the existing SourceGraphic; there are no copied React subtrees or UI screenshots. data-flute-blur is center-point telemetry only, not the filter for the whole element.

Camera x/y/z subtract from scene position. Existing stage rotations remain in canonical T*Rx*Ry*Rz order; this is not a physical camera pose API. Focus position, camera position and surfaces can be keyframed independently.

Checks: npm run verify:motion. Pixel tests verify within-surface sharpness and fixed focus under movement; React checks verify state/registration recovery; architecture tests reject duplicate named owners and forbidden imports. Tests do not prove universal host CSS compatibility or physical optical accuracy.

Performance is part of completion: verify:motion includes hardware Chromium frame-budget checks for both demo recipes. The renderer uses a shared immutable radial texture and native alpha transfer tables; per-frame image document construction is forbidden. Unchanged registration does not repeat scene-wide measurement. See the performance section below for measurement conditions.

## Progressive focus performance

The original renderer regenerated seven SVG image documents for every measured surface on each frame. CPU profiling found heavy image attribute updates/parsing and sustained browser work; unchanged Surface registrations also triggered redundant scene-wide layout walks.

The repair keeps native filter primitives and the existing live DOM contract. Every filter shares one immutable 256×256 radial alpha texture, decoded once. Native `feComponentTransfer` tables map that distance input to canonical focus weights. Animation updates numeric geometry and small tables; it never creates another image document. Spatial groups without visual content allocate no filter. Unchanged bindings skip redundant measurement; Scene still measures after a commit and observers handle external resize/scroll.

The texture is generated reproducibly by `scripts/generate-focus-mask.mjs` using the browser's built-in Canvas radial gradient. It is mathematical mask data, not a screenshot of the host UI. `src/core/spatial.ts` remains the only focus law; the renderer only presents its weights.

### Evidence

Same local device: Apple M4 Max, full Chromium with Metal GPU compositing, viewport1440×1100, fixed-focus recipe, six seconds, development server. Original: 60 frames, median108.2ms, p95141ms, 57 intervals over33.4ms. Repaired texture prototype: 703 frames, median8.3ms, p958.9ms, one interval over33.4ms. Functional screenshots/pixel checks are separate from these timing probes.

Release qualification runs both fixed-focus and moving-focus recipes on the production build. See test-results/performance.json and attached per-test JSON for the latest measured FPS, p50/p95, long-frame count and GPU. The check requires average≥55FPS, p95<20ms and fewer than2% intervals over33.4ms, after300ms warmup. It also detects any per-frame image-href changes. Full Chromium is required: default Playwright headless-shell disables GPU compositing and is unsuitable for this hardware budget. Device/frame cadence and host component complexity affect results.

### Established browser mechanisms

- [Three.js CSS3DRenderer](https://threejs.org/docs/pages/CSS3DRenderer.html) transforms DOM elements through CSS and does not use Three.js materials; substituting it does not turn live HTML into WebGL postprocessing input.
- [MDN feComponentTransfer](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feComponentTransfer) defines native per-channel table interpolation. This repair uses it for alpha masks rather than implementing a rendering engine or shader pipeline.
- [web.dev animation guidance](https://web.dev/articles/animations-guide) recommends minimizing layout/paint work and measuring frame behavior. Progressive blur necessarily has rendering cost, so the release gate measures the real animated effect, not a blur-disabled fallback.

Production qualification, 2026-09-13 (same M4 Max/Metal, 1440×1100): fixed-focus camera recipe averaged120.08FPS, p508.3ms, p958.9ms, zero intervals over33.4ms across721 samples; moving-focus recipe averaged110FPS, p508.3ms, p9516.6ms, one interval over33.4ms across660 samples. Both shared-texture/no-href-mutation checks passed. Full verify:motion passed:214 tests, TypeScript, production demo and ESM/declaration builds. This record reports the measured device/scene rather than asserting a universal frame rate.

## Documentation boundary

`docs/` must contain exactly `architecture.md` and `product.md`, both regular files. Architecture requirements and canonical ownership belong here; product intent and scope belong in product.md. Morphite owns delivery planning. Inline SOURCE OF TRUTH comments describe each implementation boundary. Update these owners rather than adding another document.

`scripts/check-architecture.mjs` declares and enforces the allowlist against the filesystem, including untracked and hidden entries. Extra files, nested directories, symlinks and missing required files fail. `npm run lint:architecture`, architecture tests, build and slice verification all execute this check. Negative fixtures test rejection and recovery. This checks structure; documentation accuracy still requires updating the canonical files when behavior changes.

## Project installation and preview boundary

`src/core/project.ts` declares project command input/result schemas. `RESOURCES` in core/resources.ts binds init-project, load-project, validate-project and open-preview to their input schemas alongside the existing spatial/motion operations. These contracts contain no filesystem, process or browser effects. `src/project/commands.ts` owns executeProjectCommand: validate the requested operation and input, check project state, then invoke scoped services. CLI argument handling in src/cli/index.ts calls that same boundary; it cannot call filesystem services directly.

`src/project/services.ts` owns local file/process/network/browser effects. The Vite project adapter inspects source rather than executing host configuration. Initialization preserves the original root render expression and wraps it with ProjectPreview, retaining existing providers/children; setup state is local to the project. Unsupported or ambiguous integrations fail instead of generating a replacement application. Interrupted setup and retries are verified with filesystem fixtures. No host .env copying or product login is involved.

`src/preview/index.tsx` exports ProjectPreview through the @flute/scene/preview subpath. The generated entry supplies the host development guard explicitly; query activation is sampled at mount. The active view reuses Scene, Surface and SceneErrorBoundary for a static tilted live app. Normal URLs and production guards return the original children. The CLI probes the explicitly configured loopback dev server and verifies project identity before opening it. There is no network-facing command/mutation endpoint in this slice, so browser code cannot perform local project writes.

Architecture fixtures reject CLI-to-service bypasses, effects in pure project adapters, Node imports in browser layers and duplicate canonical project-command ownership. verify:launch installs the packed artifact into a separate provider-backed Vite fixture and exercises it in Chromium. The renderer's existing frame-budget checks remain required. Installation/preview adapters reuse the scene and motion owners; source refinement, durable recipes and coding-agent authoring are still later slices.

## Installed dashboard consumer

`examples/dashboard-lab` is an ordinary tracked Vite application, generated using official shadcn `dashboard-01`. It installs the packed `@flute/scene` artifact through npm; its `@` alias resolves only its own source. `scripts/setup-dashboard.mjs` rebuilds the artifact and invokes canonical CLI init/validate, with repeated init proving idempotency. The static Vite adapter recognizes the official React + Tailwind + local alias recipe without executing config.

The example's `components/dashboard.tsx` owns one live dashboard. `scene/sidebar-layer.tsx` declares stable row slots/entrance anchors used by both menu components and `scene/sidebar-recipe.ts`. The recipe uses canonical `matrixFor` to move along the tilted local Y axis; it supplies ordinary MotionInput tracks and an independent camera-space focus point. `scene/sidebar-scene.tsx` owns only playback time and responsive shot selection. It reuses Scene/Surface and preserves the original children. The fixed 1280×920 shot uses authored row anchors; sidebar layout changes require updating those anchors in the same slot declaration.

`uniformFocusBlur` in core/spatial is the sole uniform-field classifier. It samples nearest/farthest rectangle bounds, including Gaussian support, using sampleFocus. React skips filtering for wholly sharp leaves and uses one CSS Gaussian for wholly saturated leaves; transition regions retain the canonical progressive SVG filter. Tests cover depth, scale, edge transitions and renderer ownership. This does not replace the progressive focal model with per-element center blur.

`npm run verify:dashboard` builds/installs the real package, validates setup and the example TypeScript build, then checks live desktop/mobile behavior and hardware Chromium production frame time. Native menu clicks, row DOM identity, camera replay, sequential settling and reduced-motion pause are checked. Production timing is distinct from React StrictMode development overhead; no universal FPS guarantee is implied. The original Storage checks remain in verify:launch.

## Cinematic authoring contract

`MotionSchema` owns default speed 0.5 and outgoing cinematic easing. The quintic curve has zero velocity and acceleration at segment endpoints. Explicit `speed: 1` restores original timing; explicit linear/easeInOut values remain available for intentional overrides. `evaluateMotion` accepts elapsed presentation milliseconds. `motionDuration` converts authored duration to presentation duration; `motionTime` is the same conversion used by `useSceneTime`, so host charts remain synchronized. Defaults affect existing recipes: an authored 11-second scene now plays for 22 seconds. Invalid speed or duration combinations reject through the schema.

`CascadeSchema/createCascadeTracks` in core/choreography own ordered depth offsets and overlapping eased entrances. The default creates a staircase; `cascade:false` disables automatic depth variation/staggering. Explicit per-item timings remain author-controlled. Camera rails should use a single eased segment where possible; `cinematicTimeAtProgress` synchronizes entrance anchors with the same curve without duplicating easing math. `sampleFrameTime` optionally quantizes live presentation time; it never changes scene speed. README contains the package's AI authoring guidance.

The dashboard adaptation carries the sidebar's existing backing color with lifted transparent rows, retains original button classes, and restores inset layout padding in static mode. It adds no row borders/radii or forced theme. Browser checks compare real computed colors, typography, padding, radius, border and untransformed dimensions against the normal dashboard. General host selectors that depend on exact direct-child structure still require a compatible placement of wrappers; no blanket CSS-compatibility guarantee is made.

## Local video capture

`core/export` owns ExportVideoSchema, ExportFrameRateSchema, supported rates and CaptureManifestSchema. RESOURCES declares export-video once. CLI calls `export/commands.executeVideoExport`; only export/services performs browser, filesystem and FFmpeg work, reusing project/services path guards. Runtime/React cannot import export services. `useSceneCapture` registers one explicit viewport and synchronously seeks the same elapsed controller clock through flushSync. It does not expose a network write endpoint.

The exporter captures each live DOM frame at i×1000/fps, streams PNG frames with bounded backpressure to FFmpeg H.264/yuv420p, and atomically publishes a new MP4 without overwriting files. Output timing is frame-count based, independent of monitor refresh or encoding speed. 30/60/120 FPS are supported (default 60); resolution defaults 1440×1000, duration is bounded to 120 seconds. Frames scale/pad to the requested even dimensions. FFmpeg and optional Playwright Chromium are local prerequisites. Abort/failure removes partial output. Tests verify real ffprobe metadata, decoded pixel changes, malformed requests/bridges, protected paths, overwrite refusal and cancellation cleanup. Non-Flute host animation should settle before capture or consume useSceneTime; unrelated CSS/Web Animations are completed/disabled for deterministic frames.

The example Export MP4 panel supplies the canonical CLI command and links completed local sample files. It does not run a server-side export job from an untrusted browser request. `npm run export:dashboard -- 60 30` creates local sample files after a build. Generated movies remain outside Git; rerun the command in a fresh checkout. Full dashboard video inspection supplements small export fixtures.

## Installed authoring language

`src/core/authoring.ts` owns `getAuthoringGuide`, `AuthoringGuideSchema` and `reviewAuthoring`; RESOURCES binds `authoring-guide` and `review-authoring`. The CLI formats that contract as text or JSON. Package clients consume the same pure operations; no builder or editor is implemented. Actual API property names and defaults derive from canonical schemas. Concepts explain spatial UI, camera projection, parallax, focus fields, timing, live-tree composition and verification without prescribing a design.

`reviewAuthoring` rejects invalid scene/motion metadata and unknown supplied surface IDs. Large rotations, linear overrides and static scenes remain valid with advice. It cannot verify the actual DOM, styling, framing or artistic quality; browser inspection remains required. Named-owner guards reject competing authoring implementations, and tests compare CLI output with the package contract and exercise violating inputs. Installation/help points to the installed guide without modifying user agent-policy files or copying a second guide.

`examples/agent-lab` is an isolated copy of the original shadcn host components with prior scene wrappers removed. It tests a new worker's discovery of the installed package, not a second implementation of the renderer. The fresh worker receives no conversation or reference-scene brief. Governance/task metadata remains available; this is a controlled single-model trial, not proof of arbitrary-model reliability. Root integration owns combined verification and the original dashboard remains unchanged.

The integrated trial uses an isolated test server and the real `/agent-trial/index.html` deployment path. Hardware Chromium checks enforce average >=55 FPS, p95 <20 ms and fewer than 2% frames above 33.4 ms, in addition to fidelity/state/registration/recovery checks. Initial worker output preserved DOM identity but rerendered host components every tick; parent measurement caught p95 25 ms. Memoizing the existing element tree corrected it without changing the three designs, and the guide now explains that stable DOM identity and avoiding per-frame host reconciliation are separate requirements.

`SCENE_BACKGROUND` in core/scene owns the black void backdrop. Scene enforces it independently of host surface colors and author-provided background styles. The guide exposes the same constant as stageBackdrop. React and installed-browser tests check the black viewport while verifying that actual UI paint remains intact. This fixed presentation rule does not prescribe camera angles or choreography.

The black backdrop lives on the flat viewport boundary; its inner camera stage retains preserve-3d. Putting opaque paint into that depth-sorting context would cover negative-z surfaces. The trial now checks rendered nonblack UI pixels at every sampled frame, not only DOM visibility and computed background styles.

The authoring owner now teaches camera-first surface travel, plating, micro detail and floating foreground as concepts through both CLI formats and the public guide. Camera rails use the existing spatial coordinate convention and canonical matrix helpers; no second camera evaluator or focus renderer is introduced. `reviewAuthoring` advises when spatial surface tracks change without camera translation, including when a camera track exists but holds a constant value. This remains an overridable artistic warning. Actual near/far framing, visible focus falloff and foreground/background parallax require visual review; successful browser mechanics and frame budgets did not prevent the user rejecting the initial trial. Those scenes remain historical trial output, not approved visual references. The new Downloads references were inspected for composition only and were not imported into the application.

The revision-2 gallery replaces the rejected recipes with surface-travel, plating and floating shots. It derives camera rails from the installed matrixFor owner, keeps camera angles constant, and uses original dashboard section slots for assembly. Parent layout wrappers carry preserve-3d; normal host rendering remains unchanged. Old query names map to the new routes. Flat inspection retains DOM state and capture seeks restore the cinematic mode. This is a coordinator correction, not a second independent-agent trial.
