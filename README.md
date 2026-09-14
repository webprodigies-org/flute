# Flute by [Web Prodigies](https://www.youtube.com/@webprodigies)

Cinematic 3D scenes made from your **real React UI**. Your coding agent composes the camera, depth, focus and motion. Flute provides the renderer, scene library, playback and MP4 export. Your app keeps its components, providers and styles.

Open source under the [MIT license](LICENSE). Runs locally, with your existing coding agent. No account or AI subscription connection is needed in Flute.

## Install into your app

Automatic setup currently supports **npm + Vite + React 19.2**, with a standard React configuration (including the supported shadcn/Tailwind configuration). Requires **Node 22.12+**. Unsupported configurations get an actionable diagnostic before setup writes.

This source release is not published to npm. In the Flute checkout:

```sh
npm ci
npm run release:local
```

Then, from your existing app's directory, install the generated file using its absolute path:

```sh
npm install /absolute/path/to/flute/.release/flute-scene-0.1.0.tgz
npx flute init
npm run dev
```

Keep your existing dev server if it is already running. Use the URL it prints:

```sh
npx flute open --url http://127.0.0.1:5173
```

Setup adds a development-only wrapper and `FLUTE.md`. Repeating setup is safe; conflicting user-owned files get a repair message. Normal app routes and production builds remain ordinary. One installed app owns one scene catalog.

## Give your coding agent this prompt

> Read FLUTE.md and run `npx flute guide --json`. Inspect this app's real dashboard page and create a cinematic Flute scene from its existing components. Choose intentional close perspective, camera travel and depth of field. Preserve the app's design and providers. Verify it in the browser, save a snapshot, and give me the scene URL.

Replace “dashboard” with the page you want. Claude Code, Codex CLI or another repository-capable agent can use the same installed guide; Flute does not run or authenticate the agent for you.

The guide explains concepts, tradeoffs, exact APIs and a tested file-pair example. It leaves the composition to the creator. Ask your agent to revise the source when you want a different shot.

## Scenes and studio

The agent creates `src/flute/scenes/my-shot.scene.json` and matching `my-shot.tsx`. JSON owns the scene definition; the component imports actual host UI and returns stable `Surface` elements. The shared studio supplies the camera renderer, playback and capture—no separate scene editor or duplicated renderer.

Open the scene library, select a scene, play or seek, and revise its source through your running dev server.

```sh
npx flute scenes
npx flute open --scene my-shot --url http://127.0.0.1:5173
npx flute snapshot --scene my-shot --url http://127.0.0.1:5173
```

Snapshots cache rendered local pixels in the recipe. Refresh them after visual changes; they may include visible app data.

## Export video

Install FFmpeg on your system and Chromium once:

```sh
npx playwright install chromium
```

The studio's Export control supplies the command for the selected scene. For example:

```sh
npx flute export --url 'http://127.0.0.1:5173/?flute-preview=1&flute-scene=my-shot' --output my-shot.mp4 --fps 60
```

30, 60 and 120 FPS are supported. Export samples the live scene deterministically and excludes studio controls. Choose a new output filename; existing files are not overwritten. Keep the host server running. Camera depth of field uses performant DOM blur approximation, not ray-traced bokeh.

## Work on Flute

```sh
npm ci
npm run verify:agent
npm run build
npm run setup:local
npm run dev
```

The separate `local-project/` exercises installation with real scenes; it is not shipped in the package. The unconnected product opens with an honest empty scene list.

Read [architecture](docs/architecture.md) for canonical code owners and [product](docs/product.md) for scope. The installed `flute guide` is the authoritative authoring reference. Build and boundary checks reject architectural drift.
