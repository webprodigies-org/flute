# Progressive focus performance

The original renderer regenerated seven SVG image documents for every measured surface on each frame. CPU profiling found heavy image attribute updates/parsing and sustained browser work; unchanged Surface registrations also triggered redundant scene-wide layout walks.

The repair keeps native filter primitives and the existing live DOM contract. Every filter shares one immutable 256×256 radial alpha texture, decoded once. Native `feComponentTransfer` tables map that distance input to canonical focus weights. Animation updates numeric geometry and small tables; it never creates another image document. Spatial groups without visual content allocate no filter. Unchanged bindings skip redundant measurement; Scene still measures after a commit and observers handle external resize/scroll.

The texture is generated reproducibly by `scripts/generate-focus-mask.mjs` using the browser's built-in Canvas radial gradient. It is mathematical mask data, not a screenshot of the host UI. `src/core/spatial.ts` remains the only focus law; the renderer only presents its weights.

## Evidence

Same local device: Apple M4 Max, full Chromium with Metal GPU compositing, viewport1440×1100, fixed-focus recipe, six seconds, development server. Original: 60 frames, median108.2ms, p95141ms, 57 intervals over33.4ms. Repaired texture prototype: 703 frames, median8.3ms, p958.9ms, one interval over33.4ms. Functional screenshots/pixel checks are separate from these timing probes.

Release qualification runs both fixed-focus and moving-focus recipes on the production build. See test-results/performance.json and attached per-test JSON for the latest measured FPS, p50/p95, long-frame count and GPU. The check requires average≥55FPS, p95<20ms and fewer than2% intervals over33.4ms, after300ms warmup. It also detects any per-frame image-href changes. Full Chromium is required: default Playwright headless-shell disables GPU compositing and is unsuitable for this hardware budget. Device/frame cadence and host component complexity affect results.

## Established browser mechanisms

- [Three.js CSS3DRenderer](https://threejs.org/docs/pages/CSS3DRenderer.html) transforms DOM elements through CSS and does not use Three.js materials; substituting it does not turn live HTML into WebGL postprocessing input.
- [MDN feComponentTransfer](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feComponentTransfer) defines native per-channel table interpolation. This repair uses it for alpha masks rather than implementing a rendering engine or shader pipeline.
- [web.dev animation guidance](https://web.dev/articles/animations-guide) recommends minimizing layout/paint work and measuring frame behavior. Progressive blur necessarily has rendering cost, so the release gate measures the real animated effect, not a blur-disabled fallback.
