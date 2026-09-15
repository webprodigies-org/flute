import {readFile} from 'node:fs/promises';
// Reuse the real installed-host/browser/agent checks, changing only artifact transport.
// A fresh npm cache proves registry availability instead of reusing a local tarball.
const manifest = JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
process.env.FLUTE_REGISTRY_PACKAGE = manifest.name + '@' + manifest.version;
process.env.FLUTE_VERIFY_AGENT = '1';
process.env.FLUTE_VERIFY_ITERATE = '1';
await import('./check-installed.mjs');
