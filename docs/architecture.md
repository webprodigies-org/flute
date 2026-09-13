# Architecture

Morphite Board owns scope and build order. Slice ad6d2430-a222-5b8f-a296-e24724f4a81d established live surfaces. Slice 588fd521-ca29-51af-a3f0-db5733e87380 extends that owner with independent progressive focus, camera translation and deterministic motion. This document describes the implemented interface, not another build plan.

Scene schemas live in src/core/scene.ts (version 2). Spatial evaluation, coordinate conventions and focus-mask generation live in src/core/spatial.ts. MotionSchema/evaluateMotion own explicit-time tracks in src/core/motion.ts. RESOURCES binds the current operation identities; React consumes it without copying their policy. See README for public usage and limitations.

Scene accepts camera, focus, motion, timeMs, children, style/className and onDiagnostics. Surface/Motion accept stable id, transform, children and optional content. useSceneTime exposes the same explicit time for opt-in component adapters. SceneErrorBoundary provides retry and resetKey recovery through react-error-boundary, an external dependency confined to the React adapter.

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
