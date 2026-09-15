# Flute by [Web Prodigies](https://www.youtube.com/@webprodigies)

Cinematic 3D scenes made from your **real React UI**. Your coding agent composes the camera, depth, focus and motion. Flute provides the renderer, scene library, playback and MP4 export. Your app keeps its components, providers and styles.

Open source under the [MIT license](LICENSE). Runs locally, with your existing coding agent. No account or AI subscription connection is needed in Flute.

## Install into your app

**React DOM 18.2+ or 19**, with **Node 22.12+** for the CLI. The renderer is independent of your router and build tool. Setup has automatic connections for Next.js App/Pages Router and standard Vite projects; other React hosts use the same portable wrapper without changing frameworks.

From your existing app's directory, **create a separate Git branch before installing**. Flute adds integration and scene files to your codebase; a branch keeps those changes separate while you create and review your animations. Commit or stash any existing work first:

```sh
git switch -c flute-scenes
npm install @webprodigies/flute
npx flute init
npm run dev
```

Keep your existing dev server if it is already running. Use the URL it prints:

```sh
npx flute open --url http://127.0.0.1:5173
```

In Next.js, open `/flute` on your existing dev server (usually port 3000). Setup adds this development-only route without rewriting your app/layout/providers. In Vite, setup connects the existing root. Both create `FLUTE.md`. Repeating setup is safe; conflicting user-owned files get a repair message. Normal app routes and production builds remain ordinary. One installed app owns one scene catalog.

## Other React hosts (including Electron renderers)

Run `npx flute init --adapter react`. Setup creates a framework-independent wrapper and tells your agent how to connect it. It deliberately does not guess or replace your application root:

```jsx
import { FluteProjectPreview } from "./flute/ProjectPreview";

<ExistingProviders>
  <FluteProjectPreview enabled={yourDevelopmentFlag}>
    <ExistingApp />
  </FluteProjectPreview>
</ExistingProviders>
```

For production bundle exclusion, have your agent load the generated module only behind your bundler’s compile-time development condition. The `enabled` prop is a runtime guard, not a substitute for removing development imports. Next and Vite automatic connections include their native compile-time guards.

Use your host's actual development flag, then open its route with `?flute-preview=1`. For a dedicated route, pass `active`. This uses the existing React renderer, including Electron's renderer process; no changes to main/preload, security settings or build tools. A React Native application without browser DOM is not supported.

The underlying `ProjectPreview` export accepts `projectId`, `enabled`, optional `active`, `sceneModules` (lazy module loaders) and `children`. This is the shared integration contract; named framework connections are conveniences, not renderer dependencies. Next.js scene bindings are client components: keep server-only imports in the host's server layer and supply their data through that boundary.

## Give your coding agent this prompt

> Read FLUTE.md and run `npx flute guide --json`. Inspect this app's real dashboard page and create a cinematic Flute scene from its existing components. Choose intentional close perspective, camera travel and depth of field. Preserve the app's design and providers. Verify it in the browser, save a snapshot, and give me the scene URL.

Replace “dashboard” with the page you want. Claude Code, Codex CLI or another repository-capable agent can use the same installed guide; Flute does not run or authenticate the agent for you.

The guide explains concepts, tradeoffs, exact APIs and a tested file-pair example. It leaves the composition to the creator. Ask your agent to revise the source when you want a different shot.

## Scenes and studio

The agent creates `src/flute/scenes/my-shot.scene.json` and matching `my-shot.tsx` or `my-shot.jsx` (one component per recipe). JSON owns the scene definition; the component imports actual host UI and returns stable `Surface` elements. The shared studio supplies the camera renderer, playback and capture—no separate scene editor or duplicated renderer.

Outside Vite, run `npx flute sync` after adding/removing scene pairs. Existing file edits use your host’s hot reload. Open the scene library, select a scene, play or seek, and revise its source through your running dev server.

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

## Maintainer release

All tests run locally. GitHub Actions only builds and publishes a new npm version; it does not run verification suites or upload artifacts.

1. Update the package version with `npm version patch --no-git-tag-version`.
2. Run `npm ci`, install Chromium and FFmpeg, then run `npm run verify:release` locally. This includes architecture, browser, installed-app, export and hardware checks. Logs remain in `.release/logs/`.
3. Commit the verified version and lockfile, then push to `main`. The publishing workflow checks npm first. If that version already exists, it stops before installing or building. Otherwise it runs `npm run build:package` and publishes through OIDC. npm versions are immutable; changing source without a version bump does not update the public package.
4. Run `npm run test:published` locally after publication to check the exact public version in a fresh installed app.

The public source is [webprodigies-org/flute](https://github.com/webprodigies-org/flute), and the package is `@webprodigies/flute`. npm's trusted publisher uses GitHub owner `webprodigies-org`, repository `flute`, workflow `publish.yml`, environment `npm`, with direct `npm publish` permission. The GitHub environment permits the `main` branch. Never commit npm tokens.

Code-only and documentation-only pushes do not start a workflow. Package/lockfile or publishing-workflow changes can trigger the small version lookup. A failed release can be retried through Actions → Publish npm package → Run workflow on `main`; an existing npm version will safely skip. There is no automatic tag-based or pull-request test workflow.

`verify:ci` remains a local alternative without hardware timing checks; `verify:release` retains the full hardware gate. GitHub does not enforce those local results, so the maintainer is responsible for running them before pushing a release version.

For manual publication, run `npm run release:publish` locally from the clean committed candidate and complete npm's private authentication prompt. For source-only testing, `npm run release:local` builds a tarball in `.release/`; `npm run setup:local` installs it in the isolated local host.
