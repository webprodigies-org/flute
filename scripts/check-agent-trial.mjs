import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { loadSceneRecipes, reviewAuthoring, evaluateMotion, motionDuration, matrixFor } from '../dist/library/index.js';

// SOURCE OF TRUTH: installed agent acceptance, loadSceneRecipes, reviewAuthoring.
// WHAT: verify the independently authored artifacts and the requested revision.
// WHY: use public runtime validation and compiler checks, never private render math.
// WHERE: tests/agent holds evidence; the parent's verify-agent owns browser/export proof.
const read = name => readFileSync(new URL(`../tests/agent/${name}`, import.meta.url), 'utf8');
const initial = JSON.parse(read('initial.scene.json'));
const revised = JSON.parse(read('revised.scene.json'));
const trial = JSON.parse(read('trial.json'));
const binding = read('scene.tsx.txt');
const sourcePath = 'src/flute/scenes/agent-survey.scene.json';
const bindingPath = 'src/flute/scenes/agent-survey.tsx';
const catalogInput = document => ({ sources: [{ path: sourcePath, document }], bindingPaths: [bindingPath] });

for (const recipe of [initial, revised]) {
  const catalog = loadSceneRecipes(catalogInput(recipe));
  assert.deepEqual(catalog.issues, []);
  assert.equal(catalog.scenes.length, 1);
  assert.equal(catalog.scenes[0].binding, bindingPath);
  assert.equal(catalog.scenes[0].id, 'agent-survey');
  const { scene, motion } = recipe.definition;
  const review = reviewAuthoring({ scene, motion });
  assert.equal(review.valid, true, JSON.stringify(review.issues));
  assert.equal(review.requiresVisualReview, true);
  assert.deepEqual(scene.nodes.map(node => node.id), ['revenue-dashboard']);
  assert(motion.tracks.every(track => track.target.kind === 'camera' && track.property === 'y'));
}

// Exercise actual rejection paths: absent binding, wrong recipe identity and old focus.
assert(loadSceneRecipes({ ...catalogInput(initial), bindingPaths: [] }).issues.length > 0);
assert(loadSceneRecipes(catalogInput({ ...initial, id: 'wrong-file' })).issues.length > 0);
const invalid = structuredClone(revised);
invalid.definition.scene.focus = { x: 0, y: 0, z: 0, radius: 100, falloff: 200 };
assert(loadSceneRecipes(catalogInput(invalid)).issues.length > 0);
assert.equal(reviewAuthoring({ scene: invalid.definition.scene, motion: invalid.definition.motion }).valid, false);

// Enforce the feedback as a complete expected metadata delta, preserving the first draft.
const expected = structuredClone(initial);
expected.definition.motion.durationMs *= 2;
for (const track of expected.definition.motion.tracks) {
  for (const frame of track.keyframes) frame.timeMs *= 2;
}
expected.definition.scene.focus.fStop = 8;
assert.deepEqual(revised, expected);
assert.equal(motionDuration(revised.definition.motion), 2 * motionDuration(initial.definition.motion));
for (const progress of [0, 0.125, 0.25, 0.5, 0.75, 0.875, 1]) {
  const before = evaluateMotion(initial.definition.motion, progress * motionDuration(initial.definition.motion));
  const after = evaluateMotion(revised.definition.motion, progress * motionDuration(revised.definition.motion));
  assert.deepEqual(before.issues, []);
  assert.deepEqual(after, before, 'Retiming must preserve every sampled camera position');
}
// Public matrix confirms this fixed Y-only orientation leaves the y rail tangent unchanged.
const camera = initial.definition.scene.camera;
const orientation = matrixFor({ x: 0, y: 0, z: 0, scale: 1, rotateX: camera.rotateX, rotateY: camera.rotateY, rotateZ: camera.rotateZ });
assert.deepEqual([orientation[1], orientation[5], orientation[9]], [0, 1, 0]);

function inspectBinding(source) {
  const ast = ts.createSourceFile(bindingPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = [];
  const tags = [];
  const ids = [];
  function walk(node) {
    // This binding needs only composition. Calls/arithmetic would introduce a new policy,
    // fetch, clock or private render implementation into the host adapter.
    assert(!ts.isCallExpression(node) && !ts.isNewExpression(node) && !ts.isBinaryExpression(node), 'Binding must only compose original components');
    if (ts.isImportDeclaration(node)) {
      assert(ts.isStringLiteral(node.moduleSpecifier));
      const named = node.importClause?.namedBindings;
      assert(named && ts.isNamedImports(named));
      imports.push([node.moduleSpecifier.text, named.elements.map(item => item.name.text)]);
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) tags.push(node.tagName.getText(ast));
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'id') {
      assert(node.initializer && ts.isStringLiteral(node.initializer));
      ids.push(node.initializer.text);
    }
    ts.forEachChild(node, walk);
  }
  walk(ast);
  assert.deepEqual(imports, [['@webprodigies/flute', ['Surface']], ['../../App', ['App', 'DashboardProvider']]]);
  assert.deepEqual(tags, ['DashboardProvider', 'Surface', 'App']);
  assert.deepEqual(ids, ['revenue-dashboard']);
  const functions = ast.statements.filter(ts.isFunctionDeclaration);
  assert.equal(functions.length, 1);
  assert(functions[0].modifiers?.some(item => item.kind === ts.SyntaxKind.DefaultKeyword));
  const result = ts.transpileModule(source, {
    fileName: bindingPath,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, isolatedModules: true },
    reportDiagnostics: true,
  });
  assert.deepEqual((result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), []);
  assert(result.outputText.includes('export default function AgentSurvey'));
}
inspectBinding(binding);
assert.throws(() => inspectBinding(`${binding}\nconst privateRotation = Math.sin(1);`), /only compose/);
assert.throws(() => inspectBinding(binding.replace('<App />', '<div>Invented dashboard</div>')));
assert.throws(() => inspectBinding(binding.replace('<App />', '<App /><App />')));

assert.equal(trial.identity.provider, 'codex');
assert.equal(trial.identity.model, 'gpt-6-astra');
assert.equal(trial.identity.delegated, false);
assert(trial.prompts.feedback.includes('Make the reveal take twice as long'));
assert(trial.prompts.feedback.includes('Keep final camera endpoint unchanged'));
const hash = value => createHash('sha256').update(value).digest('hex');
assert.equal(hash(read('initial.scene.json')), trial.evidenceHashes.initialSha256);
// The independent trial predates the public npm namespace. Normalize only its
// single package import; the original hash still rejects every other source edit.
assert.equal(binding.split("from '@webprodigies/flute'").length, 2);
assert.equal(hash(binding.replace("from '@webprodigies/flute'", "from '@flute/scene'")), trial.evidenceHashes.bindingSha256);
console.log('Agent trial passed: public recipe/review validation, retimed rail, deeper focus, original binding, negative cases and TSX transpilation. Browser/export evidence belongs to parent verification.');
