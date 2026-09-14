# Installed local project

This is the explicitly separate host used to review Flute with real interactive UI. It is not bundled with the package or product entry. The Orbit dashboard supplies its own components, styles and provider data from `public/metrics.json`.

From the repository root run `npm run build && npm run setup:local`, then `npm run dev`. The managed app process starts the product and this host on their allocated app/API ports; standalone development defaults to 5173/5174. Open the host with `?flute-preview=1` for its scene library, without that query for the original dashboard.

Each scene is one versioned JSON recipe plus its matching default-export TSX component in `src/flute/scenes/`. All ten are discovered by the installed package. The TSX files reuse `components/scene-content.tsx`, which uses the original dashboard components and provider. Change the JSON to adjust camera, focus and motion. Add another file pair to add a scene. No second list registry or copied playback UI is needed.

The `.local-package` archive and installed dependencies are generated locally by setup. Run setup again after changing the library. The committed `.flute/project.json` identity contains no machine paths or application data; filesystem operations are scoped to the caller’s project root.
