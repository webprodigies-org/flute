import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkArchitecture, checkProject } from '../scripts/check-architecture.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sceneDoc = `/** SOURCE OF TRUTH: SceneSchema, TransformSchema.
 * WHAT: define validated scene data.
 * WHY: keep all consumers consistent.
 * WHERE: consumed by spatial evaluator.
 */`;
const spatialDoc = `/** SOURCE OF TRUTH: evaluateScene, transformToCss.
 * WHAT: evaluate transforms and focus.
 * WHY: prevent divergent renderer math.
 * WHERE: consumed by React adapter.
 */`;
const valid = {
  'src/core/scene.ts': `${sceneDoc}\nimport { z } from 'zod';\nexport const TransformSchema = z.strictObject({ x: z.number() });\nexport const SceneSchema = z.strictObject({ transform: TransformSchema }).superRefine(() => {});`,
  'src/core/spatial.ts': `${spatialDoc}\nimport { SceneSchema } from './scene';\nexport function evaluateScene(input: unknown) { return SceneSchema.parse(input); }\nexport const transformToCss = () => 'none';`,
  'src/core/index.ts': `export * from './scene'; export { evaluateScene, transformToCss } from './spatial';`,
};
const fixture = (file, text, options) => checkArchitecture({ ...valid, [file]: text }, options);
const rejects = (file, text, rule = 'module-boundary', options) => {
  const issues = fixture(file, text, options);
  assert.ok(issues.some(issue => issue.file === file && issue.rule === rule), JSON.stringify(issues));
};

test('allowed canonical declarations, barrels, imports and browser adapter', () => {
  assert.deepEqual(checkArchitecture({ ...valid,
    'src/react/index.tsx': `import React from 'react'; import { evaluateScene } from '../core'; export { SceneSchema } from '../core'; const x = document.createElement('div'); new ResizeObserver(() => {}); evaluateScene({});`,
    'src/runtime/index.ts': `export * from '../core';`,
  }), []);
});

for (const layer of ['core', 'runtime', 'react']) {
  for (const target of ['node:fs', 'fs/promises', '../demo/data', '../../demo/data', '../services/data', '../database/client', '@prisma/client', 'some-unreviewed-host-sdk']) {
    test(`${layer} rejects ${target}`, () => rejects(`src/${layer}/bad.ts`, `import thing from '${target}';`));
  }
}
for (const target of ['react', 'react/jsx-runtime', 'react-dom/client', '../react', '../runtime']) {
  test(`core rejects ${target}`, () => rejects('src/core/bad.ts', `import '${target}';`));
}
for (const form of [
  `export * from 'node:fs';`, `export { readFile } from 'node:fs';`,
  `import type { Stats } from 'node:fs';`, `type Stats = import('node:fs').Stats;`,
  `const x = import('node:fs');`, 'const x = import(`node:fs`);',
  `const x = require('node:fs');`, `import fs = require('node:fs');`,
  `const x = import(target);`, `const x = require('node:' + 'fs');`,
  `const load = require; load('node:fs');`, `require.resolve('node:fs');`,
]) test(`module syntax: ${form}`, () => rejects('src/react/bad.ts', form));

test('configured path aliases cannot bypass core boundary', () => {
  const issues = checkArchitecture({ ...valid, 'src/core/bad.ts': `import '@host/data';`, 'src/services/data.ts': 'export const data = 1;' }, { compilerOptions: { baseUrl: '.', paths: { '@host/*': ['src/services/*'] } } });
  assert.ok(issues.some(issue => issue.file === 'src/core/bad.ts' && issue.rule === 'module-boundary'));
});
test('allowed path alias resolves to core', () => {
  assert.deepEqual(fixture('src/react/view.ts', `import { SceneSchema } from '@core/scene';`, { compilerOptions: { baseUrl: '.', paths: { '@core/*': ['src/core/*'] } } }), []);
});
test('barrel cannot launder a disallowed dependency', () => {
  const issues = checkArchitecture({ ...valid, 'src/react/index.ts': `import './barrel';`, 'src/react/barrel.ts': `export * from '../services/data';` });
  assert.ok(issues.some(issue => issue.file === 'src/react/barrel.ts' && issue.rule === 'module-boundary'));
});

for (const expression of ['window.innerWidth', 'document.body', 'fetch("/")', 'new ResizeObserver(() => {})', 'new DOMMatrix()', 'requestAnimationFrame(() => {})', 'globalThis.document', 'globalThis["document"]', 'const { document: doc } = globalThis', 'process.env', 'Buffer.from("x")']) {
  test(`core rejects runtime global ${expression}`, () => rejects('src/core/bad.ts', expression, 'runtime-global'));
}
for (const expression of ['process.env', 'Buffer.from("x")', 'globalThis.process', 'globalThis["Buffer"]', 'globalThis[key]', 'const { Buffer } = globalThis', 'const host = globalThis; host.process']) {
  test(`React rejects Node global ${expression}`, () => rejects('src/react/bad.ts', expression, 'runtime-global'));
}
test('runtime rejects browser globals', () => rejects('src/runtime/bad.ts', 'document.body;', 'runtime-global'));
for (const layer of ['core', 'runtime']) test(`${layer} rejects implicit JSX dependencies`, () => rejects(`src/${layer}/bad.tsx`, 'const node = <div />;'));
test('AST avoids false positives from text, properties, type references and shadowed globals', () => {
  assert.deepEqual(fixture('src/core/allowed.ts', `
    // import fs from 'node:fs'; document.body; const SceneSchema = {};
    const message = "require('react'); window.innerWidth";
    type DOMType = HTMLElement;
    type HostType = typeof window;
    const record = { document: 'label', window: 1 };
    const value = record.document;
    function local(document: { body: number }, require: (x: string) => string) {
      return { document, value: document.body, module: require('node:fs') };
    }
  `), []);
});
test('shorthand global reads still fail', () => rejects('src/core/bad.ts', 'const globals = { document };', 'runtime-global'));

for (const [symbol, expression] of [
  ['SceneSchema', 'const SceneSchema = {};'], ['TransformSchema', 'class TransformSchema {}'],
  ['evaluateScene', 'function evaluateScene() { return {}; }'], ['transformToCss', `const transformToCss = () => 'none';`],
  ['SceneSchema', 'interface SceneSchema {}'], ['SceneSchema', 'type SceneSchema = {};'],
  ['SceneSchema', 'const { SceneSchema } = source;'], ['SceneSchema', 'function view(SceneSchema: unknown) {}'],
]) test(`duplicate canonical declaration: ${expression}`, () => rejects('src/react/duplicate.ts', expression, 'canonical-owner'));

test('duplicate canonical implementation in owner fails', () => {
  const issues = fixture('src/core/spatial.ts', valid['src/core/spatial.ts'] + '\nexport function evaluateScene() { return 1; }');
  assert.ok(issues.some(issue => issue.rule === 'canonical-presence'));
});
for (const text of [
  sceneDoc, `${sceneDoc}\nexport type SceneSchema = {}; export type TransformSchema = {};`,
  `${sceneDoc}\nexport const SceneSchema = {}; export const TransformSchema = {};`,
  `${sceneDoc}\ndeclare const SceneSchema: unknown; declare const TransformSchema: unknown;`,
  `${sceneDoc}\nexport { SceneSchema, TransformSchema } from './copy';`,
  `${sceneDoc}\nconst z = { strictObject: () => ({}) }; export const SceneSchema = z.strictObject({}); export const TransformSchema = z.strictObject({});`,
]) test(`owner file cannot substitute for implementations: ${text.slice(sceneDoc.length)}`, () => {
  assert.ok(fixture('src/core/scene.ts', text).some(issue => issue.rule === 'canonical-presence'));
});
test('empty function or signature cannot satisfy evaluator presence', () => {
  const issues = fixture('src/core/spatial.ts', `${spatialDoc}\nexport function evaluateScene(): void; export function transformToCss() {}`);
  assert.equal(issues.filter(issue => issue.rule === 'canonical-presence').length, 2);
});
test('absent owner fails even if declarations are elsewhere', () => {
  const { 'src/core/scene.ts': scene, ...rest } = valid;
  const issues = checkArchitecture({ ...rest, 'src/core/copy.ts': scene });
  assert.ok(issues.some(issue => issue.rule === 'canonical-presence'));
  assert.ok(issues.some(issue => issue.rule === 'canonical-owner'));
});
for (const replacement of ['', '/* SOURCE OF TRUTH: SceneSchema TransformSchema WHAT: WHY: WHERE: */', 'const documentation = ' + JSON.stringify(sceneDoc) + ';', sceneDoc.replace('WHY: keep all consumers consistent.', 'WHY: TODO')]) {
  test(`owner documentation must have meaningful comment clauses: ${replacement.slice(0, 40)}`, () => rejects('src/core/scene.ts', valid['src/core/scene.ts'].replace(sceneDoc, replacement), 'owner-documentation'));
}
test('syntax errors cannot silently pass', () => rejects('src/react/bad.ts', 'export const = ;', 'syntax'));

test('actual source obeys architecture, including React whenever present', () => {
  assert.deepEqual(checkProject(root), []);
});
test('CLI succeeds for allowed source, fails for violations and missing source', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'flute-architecture-'));
  const run = () => spawnSync(process.execPath, [path.join(root, 'scripts/check-architecture.mjs'), directory], { encoding: 'utf8' });
  try {
    assert.equal(run().status, 1);
    for (const [name, text] of Object.entries(valid)) {
      mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
      writeFileSync(path.join(directory, name), text);
    }
    const allowed = run();
    assert.equal(allowed.status, 0, allowed.stderr);
    writeFileSync(path.join(directory, 'src/core/bad.ts'), `export * from 'node:fs';`);
    const denied = run();
    assert.equal(denied.status, 1);
    assert.match(denied.stderr, /src\/core\/bad\.ts:1:\d+ \[module-boundary\]/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
