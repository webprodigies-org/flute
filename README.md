# Flute

A local toolkit for cinematic 3D motion made from real application components. Existing coding agents author the scene; Flute supplies the shared camera, depth of field, motion, browser preview and video export.

## Run this repository

Requires Node 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the dev-server URL for the real scene library. An unconnected project starts empty. The newly authorized `local-project/` is a separate installed host with ten editable scenes; run `npm run build && npm run setup:local` before `npm run dev` to enable its second local URL. The old demos remain removed.

## Install into an existing app

The package is currently local, not published to a registry. Build and pack it:

```sh
npm run build
npm pack --pack-destination /tmp
```

With your application's existing dev server running, invoke this checkout's CLI:

```sh
node /path/to/flute/dist/cli/flute.js init --project /path/to/your-app --package /tmp/flute-scene-0.1.0.tgz --url http://127.0.0.1:5173
```

Automatic integration supports the checked single-root npm Vite/React configuration, including the supported shadcn React/Tailwind/alias recipe. Unsupported or dynamic configuration is refused before writes. Initialization preserves providers and guards the installed preview with the host development flag. Normal application routes remain normal.

Inside the installed project, `npx flute guide` gives the version-matched cinematic concepts and actual API capabilities. Flute uses the developer's existing coding agent; it does not authenticate to AI providers.

## Real preview interface

`ScenePreview` is exported from `@flute/scene/preview`. It accepts a `definition` containing canonical `scene` metadata, optional `motion`, and viewport `width`/`height`. Its `children` are the application's original `Surface` elements. Keep their element references stable during playback. Supply the host's `import.meta.hot` as `hot` for development connection and source-error status.

The shared interface provides play/pause, replay, seeking, responsive framing, reduced-motion handling, validation diagnostics and an export command. No builder or interactive focus editor is included. Empty/static scenes disable unavailable actions. Invalid metadata retains the last valid settings and cursor; corrections resume the same host tree. A component that throws is recovered through the shared error boundary, so that failed subtree may remount. A full development-server reload can reset in-memory state.

`ProjectPreview` is the development-only entry adapter. Initialization installs a lazy module glob; rerunning `flute init` upgrades an older generated wrapper. Open `?flute-preview=1` for the scene list. Every `src/flute/scenes/<id>.scene.json` plus matching `<id>.tsx` file pair appears automatically. The recipe is `{version:1,id,title,description?,definition}`; its component returns real Surface subtrees and the original providers it needs. Keep helper modules outside that directory. No separate list registration is required.

Click a row or open `?flute-preview=1&flute-scene=<id>` to watch it with the shared bottom controls. `flute scenes --json`, `flute load --scene <id> --json` and `flute open --scene <id> --url http://127.0.0.1:5173` use the same validated catalog. Source persists as normal project files; playback time and component state do not persist through full reloads. For a custom low-level route, ScenePreview remains available without the bootstrap query. Do not nest preview shells.

## Rendering and export

Scene version 3 uses camera-axis depth of field: `focus.distance`, `fStop`, `focalLength` and `maxBlur`. Lower f-stop increases separation; equally distant regions may both be sharp. The renderer approximates aperture blur with native Gaussian basis filters and cached raster depth ramps. It does not reproduce ray-traced bokeh or occlusion.

Every visible text/media region needs a visual `Surface` leaf or `content` owner. Spatial groups remain unfiltered to preserve nested 3D. Diagnostics identify uncovered content and capture refuses an invalid scene. Host clipping, portals, pseudo-element paint and selectors tied to exact DOM structure can require adaptation.

Export uses the same preview clock and live renderer:

```sh
npx flute export --url http://127.0.0.1:5173/your-scene --output scene.mp4 --fps 30
```

Choose 30, 60 or 120 FPS. FFmpeg on PATH and Playwright Chromium are required. Use a fresh output filename; existing files are never overwritten. The browser's Export menu supplies the command, while the CLI performs local file/process work.

## Source of truth

Read [architecture](docs/architecture.md) for owners and the linear data flow. [Product](docs/product.md) records the current experience and boundaries. Morphite owns the vertical slice matrix and task stages. Those are the only two files permitted in `docs/`.

`npm run verify:reuse` runs the current product gate, including installed-app HMR, schema/syntax/render-error recovery, reconnection, capture, mobile/keyboard behavior and architecture checks. Test inputs live under `tests/` and disposable temporary directories. `vite.test.config.ts` builds them into ignored `.test-dist`; the normal production build contains only the product entry, package and CLI.

Scene library tiles use cached snapshots of the real scene. Run `flute snapshot --scene <id> --url <running-app-url>` after creating or revising it; optional `--time <milliseconds>` chooses the frame. The default is the midpoint. This saves a small PNG in the local recipe, including any visible host data, without running animations in the list. Missing or unreadable images fall back to the scene number.
