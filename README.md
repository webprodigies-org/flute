# Flute — first surface

Flute renders actual React components on perspective surfaces. This first slice includes the spatial contract, live DOM wrappers, focal depth and an interactive host-app demonstration. It does not yet include CLI installation, an animation timeline, AI-provider connections, scene persistence or exports.

## Run the demonstration

Node 24 and npm 11 are the tested development environment.

```sh
npm ci --legacy-peer-deps
npm run dev
```

The app uses APP_PORT or PORT when supplied, otherwise 5173. In Morphite use the managed **app** service. The demo endpoint `/api/dashboard` serves the included Northstar fixture; it is not a connection to your production database. The components share a real React provider, request that endpoint once per mount, and keep their own state when focus or perspective changes.

Try the three focal targets, tilt and depth controls. Select **Last month**, inspect the chart, and open the customer details: those interactions survive focus changes. **Flat** provides a visual comparison. These controls are a first-slice test harness, not the later authoring workflow.

## Use the wrappers

```tsx
import { Scene, Surface, Motion } from "@flute/scene";

<YourExistingApplicationProviders>
  <Scene
    camera={{ perspective: 1400, rotateY: -15 }}
    focus={{ targetId: "revenue", range: 24, falloff: 55, maxBlur: 8 }}
  >
    <Surface id="revenue">
      <YourRevenueChart />
    </Surface>
    <Motion id="customers" transform={{ x: 20, z: 160 }}>
      <YourCustomersCard />
    </Motion>
  </Scene>
</YourExistingApplicationProviders>;
```

Use your actual components and their existing APIs. Flute does not load application data, copy components, authenticate users, or turn a second component mount into the same instance. Adding/removing wrappers around an already mounted tree can remount it; keep the composition stable while adjusting props. Motion currently shares Surface's positioning behavior; timeline animation belongs to the next slice.

## Composition and focal behavior

- Scene owns perspective/camera and focus. Surface/Motion own position relative to their nearest registered parent.
- IDs are unique within a Scene. Focus can target an ID or an explicit depth.
- Blur is a bounded per-element approximation based on the element center's world depth, not optical per-pixel depth of field.
- Normal leaf children receive blur. For groups, use `content` for a visual background and `children` for nested surfaces. Keep spatial containers free of clipping, filters, opacity and competing CSS transforms that flatten 3D descendants.
- Arbitrary third-party layout/portals are not universally supported. Wrappers add DOM nodes, so selectors/layout may need a small integration adjustment.
- Invalid configuration is reported visibly. Missing targets, duplicate IDs, zero-size elements and camera-plane collisions provide diagnostics. SceneErrorBoundary handles descendant render errors.
- Host interaction and data remain live; this is not screenshot capture.

## Architecture

| Canonical owner                | Responsibility                                             |
| ------------------------------ | ---------------------------------------------------------- |
| src/core/scene.ts              | Zod scene schemas, defaults, derived types and validation  |
| src/core/spatial.ts            | Transform composition, world depth and focal blur          |
| src/react/                     | Scoped registration, DOM measurement, wrappers and errors  |
| demo/                          | Host API/provider/components and first-slice test controls |
| scripts/check-architecture.mjs | Executable import and named-owner boundaries               |

Inline SOURCE OF TRUTH comments identify WHAT, WHY and WHERE. Runtime code contains no database, filesystem, subscription or account policy. CLI/hosted command owners remain future slice work. Scene data never contains React instances, API credentials or database content.

## Verify and build

Browser checks start an isolated production preview automatically, using the allocated port. A running development preview can also be used via FLUTE_TEST_URL.

```sh
npm run verify:surface
```

The command runs TypeScript, core tests, React tests, architecture checks including negative fixtures, production demo/library builds, and real Chromium browser tests. Set FLUTE_TEST_URL to target a running preview; otherwise tests use APP_PORT / PORT / 5173. Install the matching browser with `npx playwright install chromium` when needed.

`npm run build` creates the demo in dist/ and the ESM library plus declarations in dist/library/. React remains a peer dependency to preserve the host's React instance. The package is private while the MVP is under development; it can be packed locally for testing.

Architectural checks prove the named owners and declared import rules, not the absence of every possible equivalent formula. Test reports and screenshots are verification artifacts, not product exports.
