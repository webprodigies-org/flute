import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRelease, publicationStatus} from '../scripts/release.mjs';
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

const published = (version='1.2.2') => ({
 name:manifest.name, versions:{[version]:{version}}, 'dist-tags':{latest:version}
});
const registry = data => async () => Response.json(data);
test('new version is publishable after checking registry identity',async()=>{
 let requested;
 const result=await publicationStatus(manifest,{repository:'owner/flute',fetchRegistry:async(url,options)=>{
  requested=url;assert.ok(options.signal instanceof AbortSignal);return Response.json(published());
 }});
 assert.equal(requested,'https://registry.npmjs.org/@owner%2fscene');
 assert.equal(result.publish,true);
});
test('already-published version skips without rebuilding or republishing',async()=>{
 assert.equal((await publicationStatus(manifest,{fetchRegistry:registry(published('1.2.3'))})).publish,false);
});
test('only a genuine missing package permits first publication',async()=>{
 assert.equal((await publicationStatus(manifest,{fetchRegistry:async()=>new Response('{}',{status:404})})).publish,true);
});
for(const status of [401,403,429,500,503])
 test('registry HTTP '+status+' stops publication',async()=>{
  await assert.rejects(publicationStatus(manifest,{fetchRegistry:async()=>new Response('{}',{status})}),/Registry lookup failed/);
 });
test('network failure stops publication',async()=>{
 await assert.rejects(publicationStatus(manifest,{fetchRegistry:async()=>{throw Error('offline')}}),/offline/);
});
test('malformed registry JSON stops publication',async()=>{
 await assert.rejects(publicationStatus(manifest,{fetchRegistry:async()=>new Response('{')}),SyntaxError);
});
for(const data of [
 {...published(),name:'@other/scene'},
 {...published(),versions:undefined},
 {...published(),versions:[]},
 {...published('1.2.3'),versions:{'1.2.3':{version:'1.2.4'}}}
]) test('invalid registry identity/versions stops publication '+JSON.stringify(data),async()=>{
 await assert.rejects(publicationStatus(manifest,{fetchRegistry:registry(data)}));
});
test('wrong repository is rejected before any registry request',async()=>{
 let requests=0;
 await assert.rejects(publicationStatus(manifest,{repository:'other/flute',fetchRegistry:async()=>{requests++;return Response.json(published())}}));
 assert.equal(requests,0);
});
test('new release cannot move latest backwards',async()=>{
 await assert.rejects(publicationStatus(manifest,{fetchRegistry:registry(published('1.2.4'))}),/newer than/);
});
test('numeric version comparison does not use string ordering',async()=>{
 assert.equal((await publicationStatus({...manifest,version:'1.2.10'},{fetchRegistry:registry(published('1.2.9'))})).publish,true);
});
