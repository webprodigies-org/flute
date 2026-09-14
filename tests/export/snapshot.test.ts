import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {executeSceneSnapshot} from '../../src/export/commands';
import {executeRecipeCommand} from '../../src/project/recipes';
import {openCapture} from '../../src/export/services';
import {loadSceneRecipes,SceneSnapshotSchema,SnapshotSceneSchema} from '../../src/core/recipes';
vi.mock('../../src/project/recipes',()=>({executeRecipeCommand:vi.fn()}));
vi.mock('../../src/export/services',async original=>({...await original<typeof import('../../src/export/services')>(),openCapture:vi.fn()}));
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPdwAAAAASUVORK5CYII=';
let root:string;let source:string;let original:string;
const snapshot=vi.fn(),close=vi.fn();
beforeEach(async()=>{
 vi.clearAllMocks();root=await mkdtemp(path.join(tmpdir(),'flute-snapshot-'));await mkdir(path.join(root,'src/flute/scenes'),{recursive:true});source=path.join(root,'src/flute/scenes/demo.scene.json');
 original=JSON.stringify({version:1,id:'demo',title:'My unchanged title',definition:{width:1000,height:600,scene:{nodes:[]}}});await writeFile(source,original);
 const catalog=loadSceneRecipes({sources:[{path:'src/flute/scenes/demo.scene.json',document:JSON.parse(original)}],bindingPaths:['src/flute/scenes/demo.tsx'],sceneId:'demo'});
 vi.mocked(executeRecipeCommand).mockResolvedValue({success:true,data:{...catalog,url:'http://127.0.0.1:5173/?flute-scene=demo'}});
 snapshot.mockResolvedValue(png);
 vi.mocked(openCapture).mockResolvedValue({close,manifest:async()=>({version:1,durationMs:1000,selector:'[data-flute-capture="scene"]'}),snapshot,encode:vi.fn()} as Awaited<ReturnType<typeof openCapture>>);
});
afterEach(async()=>{await rm(root,{recursive:true,force:true})});
const run=(input={})=>executeSceneSnapshot({sceneId:'demo',url:'http://127.0.0.1:5173',...input},{root});
it('saves a bounded midpoint image without changing authored recipe fields',async()=>{
 expect(await run()).toMatchObject({success:true,data:{sceneId:'demo',timeMs:500}});
 expect(executeRecipeCommand).toHaveBeenCalledWith('open-scene',{sceneId:'demo',url:'http://127.0.0.1:5173',launch:false},{root});
 const saved=JSON.parse(await readFile(source,'utf8'));expect(saved.snapshot).toEqual({image:png,timeMs:500});delete saved.snapshot;expect(saved).toEqual(JSON.parse(original));expect(close).toHaveBeenCalledOnce();
});
it('rejects untrusted requests before browser or file effects',async()=>{
 for(const input of [{sceneId:'../escape'},{url:'https://example.com'},{timeMs:-1},{timeMs:NaN}])expect((await run(input)).success).toBe(false);
 expect(openCapture).not.toHaveBeenCalled();expect(await readFile(source,'utf8')).toBe(original);
});
it('preserves a recipe edited during capture and releases the browser',async()=>{
 snapshot.mockImplementation(async()=>{await writeFile(source,'new user edits');return png});
 expect((await run()).success).toBe(false);expect(await readFile(source,'utf8')).toBe('new user edits');expect(close).toHaveBeenCalledOnce();
});
it('refuses out-of-range frames, failed captures, and oversized snapshots without writes',async()=>{
 expect((await run({timeMs:1001})).success).toBe(false);expect(snapshot).not.toHaveBeenCalled();
 snapshot.mockRejectedValueOnce(new Error('failed seek'));expect((await run()).success).toBe(false);
 snapshot.mockResolvedValue(png+'A'.repeat(128000));expect((await run()).success).toBe(false);expect(await readFile(source,'utf8')).toBe(original);
});
it('refuses symlinked source and preserves its external target',async()=>{
 const external=path.join(root,'outside.json');await writeFile(external,original);await rm(source);await symlink(external,source);
 expect((await run()).success).toBe(false);expect(await readFile(external,'utf8')).toBe(original);expect(openCapture).not.toHaveBeenCalled();
});
it('supports static scenes and rejects executable or remote image metadata',async()=>{
 vi.mocked(openCapture).mockResolvedValue({close,manifest:async()=>({version:1,durationMs:0,selector:'[data-flute-capture="scene"]'}),snapshot,encode:vi.fn()} as Awaited<ReturnType<typeof openCapture>>);
 expect(await run()).toMatchObject({success:true,data:{timeMs:0}});
 for(const image of ['https://example.com/a.png','data:image/svg+xml,<svg/>','javascript:alert(1)','data:image/png;base64,broken'])expect(SceneSnapshotSchema.safeParse({image,timeMs:0}).success).toBe(false);
 expect(SnapshotSceneSchema.safeParse({sceneId:'demo',url:'http://user:password@localhost'}).success).toBe(false);
});
it('cancels before publication and never changes the recipe',async()=>{
 const controller=new AbortController();snapshot.mockImplementation(async()=>{controller.abort();return png});
 expect(await executeSceneSnapshot({sceneId:'demo',url:'http://127.0.0.1:5173'},{root,signal:controller.signal})).toMatchObject({success:false,issues:[{code:'export-cancelled'}]});
 expect(await readFile(source,'utf8')).toBe(original);expect(close).toHaveBeenCalledOnce();
});
