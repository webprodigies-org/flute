# Flute — live spatial scenes

Wrap existing React UI in perspective surfaces, then animate the camera, surfaces and an independent 3D focus point. Components keep their providers, data and interactions.

## Run

```sh
npm ci --legacy-peer-deps
npm run dev
```

Use Morphite's managed **app** service when working there. Otherwise Vite uses APP_PORT / PORT / 5173. Node 24 and npm 11 are the tested environment.

The Storage study demonstrates floating folders, camera movement and progressive focus. Play or seek the scene; compare fixed focus against traveling focus and adjust focus position/width. The dashboard cards use the included `/api/dashboard` fixture through their existing React provider, not a production database. `?fixture=baseline` renders the cards without Flute wrappers.

## Install into a supported project

The launch adapter targets standard, single-root Vite + React applications using npm and a root `index.html` with a `.tsx` or `.jsx` module entry. Unsupported configuration is reported before source edits. The package is local-only during the MVP; build and pack it first:

```sh
npm run build
npm pack
```

Inside the host project, with its existing Vite dev server running, use the absolute tarball path:

```sh
npx --yes --package /absolute/path/flute-scene-0.1.0.tgz flute init \
  --package /absolute/path/flute-scene-0.1.0.tgz \
  --url http://127.0.0.1:5173
```

Initialization installs the toolkit and wraps the existing root render expression, preserving its providers and application components. Repeating initialization does not add another wrapper. `flute open --url http://127.0.0.1:5173` verifies the existing dev server and opens `?flute-preview=1`; it never starts a competing server or silently switches ports. Use `--no-open` to verify and print the URL. `flute load` reads setup state; `flute validate` checks the integration. After installation, these commands are available through `npx flute` in the host project.

The ordinary app URL keeps the original application view. The preview entry explicitly receives the host's `import.meta.env.DEV`, so a production build cannot activate the preview with a query string. This first preview shows the whole live app on a tilted surface with progressive focus. Source editing uses the host's existing Vite refresh; dedicated refinement controls and saved recipes remain subsequent slices.

Missing or wrong-port dev servers report an actionable error; start the original host server and retry `open`. Custom roots, unsupported entry patterns and package managers need an explicit adapter instead of replacing the app. Setup metadata stays in `.flute/`; host `.env` files are not copied. Review generated source changes normally.

## Compose

```tsx
<Scene
  camera={{ perspective: 1400, x: 0, rotateY: -15 }}
  focus={{ x: 0, y: 0, z: 0, radius: 100, falloff: 180, maxBlur: 10 }}
  motion={recipe}
  timeMs={timeMs}
>
  <Surface id="revenue"><YourRevenueChart /></Surface>
  <Motion id="customers" transform={{ x: 20, z: 160 }}>
    <YourCustomersCard />
  </Motion>
</Scene>
```

Scene coordinates are pixels centered on the viewport; positive z faces the viewer. Focus is **camera-attached**, so it stays fixed on screen while camera translation moves the scene beneath it. Change focus xyz to move it independently. Camera xyz subtracts from the scene; rotation angles retain the existing stage-rotation convention, not a physical camera-pose API.

`radius` defines the clear 3D region. `falloff` is the distance from clear to maximum blur, with smooth interpolation. Sharpness varies **within** each visual surface using distance to the focus point, including distance in front and behind. It is a stylized spherical focus field, not a physical lens simulation or depth-buffer renderer. Six Gaussian levels blend through continuous radial masks; the live UI is neither cloned nor captured as a screenshot.

Scene schema is now **version 2**. Version 1 and old `targetId`, `depth`, `range` focus fields reject explicitly. Replace them with independent xyz/radius/falloff. There is one active focus implementation.

## Animate

```ts
const recipe = {
  durationMs: 2000,
  tracks: [{
    target: { kind: 'focus' as const },
    property: 'x' as const,
    keyframes: [
      { timeMs: 0, value: -100, easing: 'easeInOut' as const },
      { timeMs: 2000, value: 150 },
    ],
  }],
};
```

Tracks target a surface ID, camera or focus. Surface tracks support xyz, rotations, scale and opacity; camera tracks support xyz and rotations; focus tracks support xyz, radius, falloff and maximum blur. Easing belongs to the outgoing keyframe. Duplicate property tracks reject. Explicit time clamps to the duration and replays deterministically. `useSceneTime()` lets an opt-in component feed that same time into its supported animation API.

Keep wrappers and child identity stable during edits. Adding/removing wrappers around already mounted UI can remount it. For spatial groups, put decoration in `content` and nested surfaces in `children`. Opacity/filters apply only to visual leaves; group fades require tracks on the actual visual surfaces. Host clipping, filters, portals, competing CSS transforms and unusual layout can require adaptation. This does not promise universal component compatibility. The renderer reuses one static radial texture through native SVG transfer tables; it never rebuilds mask images during playback. Host CSP must permit the packaged mask asset (or data images when the library bundle inlines it).

## Code map

| Owner | Responsibility |
| --- | --- |
| `src/core/scene.ts` | Versioned schemas, inferred types and input validation |
| `src/core/spatial.ts` | Camera transforms, spatial focus law and radial masks |
| `src/core/motion.ts` | Validated tracks and deterministic time evaluation |
| `src/core/resources.ts` | Canonical operation identities and bindings |
| `src/react/` | Live registration, measurements, visual filters and diagnostics |
| `src/preview/` | Development-only framing of the installed host application |
| `src/project/commands.ts` | Trusted, validated project operations |
| `src/project/services.ts` | Scoped filesystem, package install and browser effects |
| `src/cli/` | Terminal arguments and result presentation |
| `demo/` | Storage study and provider/API-backed host components |
| `scripts/check-architecture.mjs` | Executable dependency and named-owner checks |

Inline SOURCE OF TRUTH comments explain WHAT, WHY and WHERE. Scene metadata never contains React instances, secrets or host database content. The CLI uses canonical project commands. Coding-agent conventions, saved recipes, hosted accounts and exports remain later work; Flute does not authenticate to AI providers.

## Verify

```sh
npm run verify:motion
```

Runs types, core/React tests, architecture negative fixtures, demo/library builds and Chromium checks including actual pixel sharpness. Install the matching browser with `npx playwright install chromium` if needed. Browser tests start an isolated production preview; FLUTE_TEST_URL can target an existing development server. `npm run build` produces demo assets and the ESM library/types in `dist/library`. React stays a peer dependency. The package remains private during MVP development.


## Performance qualification

`npm run verify:motion` includes `npm run test:performance`: full hardware-accelerated Chromium at 1440×1100, both camera/focus recipes, a 300 ms warmup and six seconds of samples each. Required: average ≥55 FPS, p95 frame interval <20 ms, fewer than 2% intervals over33.4 ms, and zero image-href reconstruction during playback. Reports include GPU identity; software-only headless rendering cannot qualify this hardware budget. Install full Chromium with `npx playwright install chromium`.

See [performance evidence](docs/architecture.md#progressive-focus-performance) for the measured baseline and rendering decision. These measurements qualify the tested scene/device; they are not a guarantee for arbitrary host component complexity or every GPU.

## Launch verification

`npm run verify:launch` includes the existing renderer/performance suite, project command and preview tests, CLI tests, and an independently installed tarball fixture. The installed fixture starts its own Vite server on a free configured port, checks source/config preservation and repeated init, rejects missing/wrong servers, exercises a provider-backed live counter, and checks the normal route and production preview exclusion. It cleans up its temporary project and servers. npm cache must contain the fixture dependencies for its offline initial install.
