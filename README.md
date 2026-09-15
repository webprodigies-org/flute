# Flute by [Web Prodigies](https://www.youtube.com/@webprodigies)

Cinematic 3D scenes made from your **real React UI**. Your coding agent composes the camera, depth, focus and motion. Flute provides the renderer, scene library, playback and MP4 export. Your app keeps its components, providers and styles.

Open source under the [MIT license](LICENSE). Runs locally, with your existing coding agent. No account or AI subscription connection is needed in Flute.

## Install into your app

Automatic setup currently supports **npm + Vite + React 19.2**, with a standard React configuration (including the supported shadcn/Tailwind configuration). Requires **Node 22.12+**. Unsupported configurations get an actionable diagnostic before setup writes.

**Release status:** public publication is being prepared. The command below becomes available after the first verified npm release; a local build is not proof of registry availability.

From your existing app's directory:

```sh
npm install @flute/scene
npx flute init
npm run dev
```

Keep your existing dev server if it is already running. Use the URL it prints:

```sh
npx flute open --url http://127.0.0.1:5173
```

Setup adds a development-only wrapper, a small React refresh adapter and `FLUTE.md`. Repeating setup is safe; conflicting user-owned files get a repair message. Normal app routes and production builds remain ordinary. One installed app owns one scene catalog.

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

## Maintainer release

The public package name and repository must belong to the publisher. Set the confirmed GitHub `repository` metadata before publishing; release validation refuses missing or mismatched metadata. Public npm packages are MIT licensed. Never commit npm tokens or login credentials.

1. Run `npm ci`, install Chromium and FFmpeg, then run `npm run verify:release` on a machine with hardware GPU compositing. This includes the existing frame budgets; hosted CI does not qualify hardware performance. Logs remain in `.release/logs/`.
2. For the first release, sign in with `npm login`, then run `npm run release:publish` from the clean, committed candidate. npm may request browser/2FA approval. This publishes the checked tarball, not local test applications.
3. Run `npm run test:published`. It downloads the exact version from the public registry into a fresh npm cache, initializes a separate app, checks the installed guide, scene revision, real browser interactions, export and production exclusion. A failed check means the release is not verified for viewers.
4. Configure the npm package's trusted publisher for the confirmed GitHub owner/repository, workflow `publish.yml`, environment `npm`, with direct publishing enabled. Restrict that GitHub environment to version tags. No stored npm token is required. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
5. For later releases, update the version with `npm version patch --no-git-tag-version`, commit, run the full hardware gate, and push a matching `vX.Y.Z` tag from a commit on `main`. The publishing workflow checks the tag, repository, package contents and CI behavior before publishing, then verifies the public installation. Review the hardware results before pushing the release tag.

Pull requests and main pushes run `verify:ci` on Node 22.12 and 24 with Chromium and FFmpeg. This runs behavior, package and installed-host checks. It explicitly excludes hardware timing measurements; `verify:release` retains those requirements. Release automation cannot certify untested frameworks or every graphics device.

For source-only testing, `npm run release:local` builds a tarball in `.release/`; install that file in a separate app. `npm run setup:local` does this for the repository's isolated local host. These commands do not publish.
