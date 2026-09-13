# Dashboard lab

This is the real shadcn `dashboard-01` block, installed as a separate Vite app. It uses the locally packed Flute library, with its own dependencies and lockfile.

From the Flute repository root:

```sh
npm ci --legacy-peer-deps
npm run setup:dashboard
npm run dev
```

Open the printed localhost address:

- `/` — normal dashboard.
- `/?scene=sidebar` — authored tilted sidebar scene; press Play or seek.
- `/?flute-preview=1` — CLI-installed whole-app preview, available in development.

The CLI supplies a basic preview. The sidebar choreography is separately authored code in this example; installation does not automatically invent this sequence.

## Change it

1. `src/main.tsx`: CLI-generated preview wrapper around the existing providers.
2. `src/components/dashboard.tsx`: the one dashboard shared by both views. Its shadcn components and `src/app/dashboard/data.json` own UI/data.
3. `src/scene/sidebar-layer.tsx`: row identities, entrance times and authored vertical anchors. Existing menu rows opt into Surface here.
4. `src/scene/sidebar-recipe.ts`: tilt, camera rail, independent focus and entrance keyframes. Flute performs the actual spatial math and interpolation.
5. `src/scene/sidebar-scene.tsx`: playback clock, controls and scene composition.

After editing the Flute library, run `npm run setup:dashboard` from the repository root and restart the dev server. This refreshes the installed tarball; there are no source aliases into Flute. `npm run verify:dashboard` checks the build, installation and browser behavior. Performance is measured using the production build; StrictMode development instrumentation costs additional work.

## Install into another existing app

The current automatic adapter supports npm, Vite, React/react-dom 19.2.x and the standard React plugin, including this shadcn Tailwind/alias configuration. Keep the app's dev server running. From that app directory:

```sh
npx --yes --package /absolute/path/to/flute/dist/packages/flute-scene-0.1.0.tgz flute init \
  --package /absolute/path/to/flute/dist/packages/flute-scene-0.1.0.tgz \
  --url http://127.0.0.1:5173
```

Use the tarball produced by `npm run setup:dashboard` and replace the port with your existing dev-server port. Init preserves the root/provider expression. It is safe to repeat; unsupported setups return a diagnostic. Flute is not published to npm yet.
