import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';

// SOURCE OF TRUTH: public-distribution, package identity and release artifact.
// WHAT: validate the public manifest, packed allowlist and tag before publishing.
// WHY: publish the same tested artifact; never leak local hosts or stale build files.
// WHERE: package scripts and .github/workflows/publish.yml; runtime policy stays in RESOURCES.
export function validateRelease(manifest, files, {repository, tag, publishing = false} = {}) {
  assert.match(manifest.name, /^@[a-z0-9-]+\/[a-z0-9-]+$/);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/,'Release requires a stable numeric version');
  assert.notEqual(manifest.private, true);
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.publishConfig?.access, 'public');
  assert.equal(manifest.publishConfig?.registry, 'https://registry.npmjs.org/');
  assert.equal(manifest.bin?.flute, './dist/cli/flute.js');
  assert.ok(!manifest.scripts?.install && !manifest.scripts?.postinstall && !manifest.scripts?.preinstall,
    'Consumer installation must not execute package lifecycle scripts');
  if (publishing || repository) {
    const match = /^git\+https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\.git$/.exec(manifest.repository?.url ?? '');
    assert.ok(match, 'Set the confirmed public GitHub repository in package.json before publishing');
    assert.equal(manifest.repository.type, 'git');
    if (repository) assert.equal(match[1], repository, 'Package repository must match publishing repository');
  }
  if (tag !== undefined) assert.equal(tag, 'v' + manifest.version, 'Git tag must match package version');
  const names = files.map(file => file.path);
  assert.equal(new Set(names).size, names.length, 'Duplicate packed paths');
  for (const name of names) {
    assert.ok(!name.split('/').some(part => part === '..' || part.startsWith('.')), 'Hidden/traversal packed file: ' + name);
    assert.ok(/^(package\.json|README\.md|LICENSE|dist\/(library|cli)\/.+\.(js|map|ts))$/.test(name),
      'Unexpected packed file: ' + name);
  }
  const required = ['package.json','README.md','LICENSE',manifest.bin.flute.slice(2)];
  for (const entry of Object.values(manifest.exports)) {
    assert.equal(typeof entry.types, 'string');
    assert.equal(typeof entry.import, 'string');
    required.push(entry.types.slice(2), entry.import.slice(2));
  }
  for (const name of required) assert.ok(names.includes(name), 'Missing package entry: ' + name);
  assert.ok(names.length > required.length, 'Expected complete package declarations and chunks');
}
const root = fileURLToPath(new URL('../', import.meta.url));
export function run(command, args, options = {}) {
  const result = spawnSync(command === 'npm' && process.platform === 'win32' ? 'npm.cmd' : command, args,
    {cwd: root, encoding:'utf8', stdio:'inherit', ...options});
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(command + ' failed (' + result.status + ')');
  return result.stdout;
}
export async function inspectArtifact({publishing = false} = {}) {
  const manifest = JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  const lock = JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8'));
  assert.equal(lock.name,manifest.name); assert.equal(lock.version,manifest.version);
  assert.equal(lock.packages[''].name,manifest.name); assert.equal(lock.packages[''].version,manifest.version);
  const directory = path.join(root,'.release');
  await mkdir(directory,{recursive:true});
  // The caller builds first. npm must inspect that exact output without rebuilding.
  const packed = JSON.parse(run('npm',['pack','--json','--ignore-scripts','--pack-destination',directory],{stdio:['ignore','pipe','inherit']}));
  assert.equal(packed.length,1);
  const artifact = packed[0];
  assert.equal(artifact.name,manifest.name);assert.equal(artifact.version,manifest.version);
  validateRelease(manifest,artifact.files,{
    publishing, repository:process.env.GITHUB_REPOSITORY,
    tag:process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined
  });
  const cli = await readFile(path.join(root,manifest.bin.flute),'utf8');
  assert.ok(cli.startsWith('#!/usr/bin/env node'), 'CLI must have executable Node shebang');
  assert.ok(artifact.files.find(file=>file.path===manifest.bin.flute.slice(2)).mode & 0o111, 'CLI must be executable');
  console.log('Checked artifact: '+artifact.filename+' ('+artifact.integrity+')');
  return path.join(directory, artifact.filename);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const action = process.argv[2] ?? 'check';
    assert.ok(['check','publish-check','publish'].includes(action), 'Unknown release action');
    const artifact = await inspectArtifact({publishing:action !== 'check'});
    if (action === 'publish') {
      assert.equal(run('git',['status','--porcelain'],{stdio:['ignore','pipe','inherit']}).trim(),'',
        'Commit the verified release candidate before publishing');
      run('npm',['publish',artifact,'--ignore-scripts','--access','public','--registry','https://registry.npmjs.org/']);
    }
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
