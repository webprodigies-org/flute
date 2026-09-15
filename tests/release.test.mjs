import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRelease} from '../scripts/release.mjs';
const manifest = {name:'@owner/scene',version:'1.2.3',license:'MIT',publishConfig:{access:'public',registry:'https://registry.npmjs.org/'},
 repository:{type:'git',url:'git+https://github.com/owner/flute.git'},bin:{flute:'./dist/cli/flute.js'},
 exports:{'.':{types:'./dist/library/types/index.d.ts',import:'./dist/library/index.js'}}};
const files = ['package.json','README.md','LICENSE','dist/cli/flute.js','dist/library/index.js','dist/library/types/index.d.ts','dist/library/chunk.js'].map(path=>({path}));
test('accepts a public tagged artifact for its repository',()=>validateRelease(manifest,files,{publishing:true,repository:'owner/flute',tag:'v1.2.3'}));
for (const name of ['.env','dist/library/.env','local-project/index.html','tests/fixture.ts','dist/library/../../secret.js','dist/cli/token.json'])
 test('rejects unintended packed file '+name,()=>assert.throws(()=>validateRelease(manifest,[...files,{path:name}])));
for (const [name,change] of [
 ['private',{private:true}],['restricted',{publishConfig:{access:'restricted'}}],['lifecycle',{scripts:{postinstall:'run-me'}}],
 ['missing repository',{repository:undefined}],['wrong CLI',{bin:{flute:'wrong.js'}}],['prerelease',{version:'1.2.3-beta.1'}]
]) test('rejects '+name,()=>assert.throws(()=>validateRelease({...manifest,...change},files,{publishing:true})));
test('rejects wrong tag',()=>assert.throws(()=>validateRelease(manifest,files,{tag:'v1.2.4'})));
test('rejects wrong repository',()=>assert.throws(()=>validateRelease(manifest,files,{repository:'other/flute'})));
test('rejects incomplete artifact',()=>assert.throws(()=>validateRelease(manifest,files.filter(f=>!f.path.endsWith('index.d.ts')))));
test('rejects duplicate packed paths',()=>assert.throws(()=>validateRelease(manifest,[...files,files[0]])));
