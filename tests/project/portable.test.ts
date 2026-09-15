import {afterEach,describe,it,expect,vi} from "vitest";
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir,symlink,rename} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {executeProjectCommand as command} from "../../src/project/commands";
import * as services from "../../src/project/services";
const roots:string[]=[];
async function put(root:string,file:string,text:string){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),text);}
async function host(kind="next-app",react="19.1.0"){
 const root=await mkdtemp(path.join(tmpdir(),"flute-portable-"));roots.push(root);
 await put(root,"package.json",JSON.stringify({dependencies:{react,"react-dom":react,"@webprodigies/flute":"0.1.0",...(kind.startsWith("next")?{next:"16.3.5"}:{})},scripts:{dev:"custom-server --anything"}}));
 for(const name of ["react","react-dom"])await put(root,"node_modules/"+name+"/package.json",JSON.stringify({name,version:react}));
 await put(root,"node_modules/@webprodigies/flute/package.json",JSON.stringify({name:"@webprodigies/flute",exports:{"./preview":{import:"./preview.js"}}}));
 await put(root,"node_modules/@webprodigies/flute/preview.js","export {}");
 if(kind==="next-app")await put(root,"app/layout.tsx",'export default function Layout({children}) { return <html><body>{children}</body></html> }');
 if(kind==="next-src")await put(root,"src/app/layout.jsx",'export default function Layout({children}) { return <html><body>{children}</body></html> }');
 if(kind==="next-pages")await put(root,"pages/_app.tsx",'export default function App({Component,pageProps}) { return <Component {...pageProps}/> }');
 return root;
}
async function run(root:string,operation="init-project",input:unknown={}){return command(operation,input,{root});}
function success(value:Awaited<ReturnType<typeof run>>){expect(value,JSON.stringify(value)).toHaveProperty("success",true);if(!value.success)throw Error(JSON.stringify(value));return value.data;}
async function scene(root:string,id="one"){
 await put(root,"src/flute/scenes/"+id+".scene.json",JSON.stringify({version:1,id,title:id,definition:{scene:{nodes:[{id:"ui"}]}}}));
 await put(root,"src/flute/scenes/"+id+".jsx",'export default function Scene(){return null}');
}
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
describe("portable host connections",()=>{
 it.each(["next-app","next-src","next-pages","custom"])("initializes %s without changing host files, then validates and retries",async kind=>{
  const root=await host(kind);const pkg=await readFile(path.join(root,"package.json"),"utf8");
  const first=success(await run(root));expect(first.integration?.kind).toBe(kind==="custom"?"react":kind==="next-pages"?"next-pages":"next-app");
  expect(success(await run(root)).changed).toBe(false);
  expect(success(await run(root,"validate-project")).project).toEqual(first.project);
  expect(await readFile(path.join(root,"package.json"),"utf8")).toBe(pkg);
  expect((await readdir(path.join(root,".flute"))).sort()).toEqual(["integration.json","project.json"]);
  const wrapper=await readFile(path.join(root,"src/flute/ProjectPreview.jsx"),"utf8");
  expect(wrapper).not.toMatch(/import\.meta|process\.|next\//);
  expect(wrapper).toContain('from "@webprodigies/flute/preview"');
 });
 it.each(["18.2.0","18.3.1","19.0.0","19.1.0","19.2.0"])("uses supported installed React %s without installing Vite",async react=>{
  const root=await host("custom",react);success(await run(root));expect(await readdir(root)).not.toContain("vite.config.ts");
 });
 it("rejects an incompatible React renderer before writes",async()=>{
  const root=await host("custom","17.0.2");expect(await run(root)).toMatchObject({success:false,issues:[{code:"missing-installation"}]});expect(await readdir(root)).not.toContain(".flute");
 });
 it("can explicitly use the generic connection in any Next host",async()=>{
  const root=await host();const result=success(await run(root,"init-project",{adapter:"react"}));expect(result.integration?.kind).toBe("react");expect(await readdir(path.join(root,"app"))).toEqual(["layout.tsx"]);
 });
 it("preserves route collisions and symlinks",async()=>{
  const root=await host();await put(root,"app/flute/page.tsx","owned");expect(await run(root)).toMatchObject({success:false,issues:[{code:"conflict"}]});expect(await readdir(root)).not.toContain(".flute");
  await rm(path.join(root,"app/flute/page.tsx"));await symlink(path.join(root,"app/layout.tsx"),path.join(root,"app/flute/page.jsx"));
  expect(await run(root)).toMatchObject({success:false,issues:[{code:"denied-path"}]});
 });
 it("refuses edited managed files and unrelated handoff documents",async()=>{
  const root=await host();await put(root,"FLUTE.md","mine");expect(await run(root)).toMatchObject({success:false,issues:[{code:"conflict"}]});
  await rm(path.join(root,"FLUTE.md"));success(await run(root));await put(root,"src/flute/ProjectPreview.jsx","edited");
  expect(await run(root,"validate-project")).toMatchObject({success:false,issues:[{code:"conflict"}]});
 });
 it("uses the canonical catalog, supports JSX and refuses ambiguous bindings",async()=>{
  const root=await host();success(await run(root));await scene(root);success(await run(root,"sync-project"));
  expect(await readFile(path.join(root,"src/flute/catalog.js"),"utf8")).toContain('./scenes/one');
  expect(success(await run(root,"sync-project")).changed).toBe(false);success(await run(root));
  await put(root,"src/flute/scenes/one.tsx","export default function Scene(){return null}");
  expect(await run(root,"sync-project")).toMatchObject({success:false,issues:[{code:"invalid-scenes"}]});
 });
 it("recovers interrupted additive init without replacing existing files",async()=>{
  const root=await host();const actual=services.atomicWrite;let failed=false;
  vi.spyOn(services,"atomicWrite").mockImplementation(async(...args)=>{if(args[1]==="src/flute/Studio.jsx"&&!failed){failed=true;throw Error("interrupted");}return actual(...args)});
  expect((await run(root)).success).toBe(false);success(await run(root));success(await run(root,"validate-project"));
 });
 it("recovers an interrupted catalog ownership update",async()=>{
  const root=await host();success(await run(root));await scene(root);
  const actual=services.atomicWrite;let failed=false;
  vi.spyOn(services,"atomicWrite").mockImplementation(async(...args)=>{if(args[1]===".flute/integration.json"&&!failed){failed=true;throw Error("interrupted");}return actual(...args)});
  expect((await run(root,"sync-project")).success).toBe(false);success(await run(root,"sync-project"));success(await run(root,"validate-project"));
 });
});

it("resolves linked renderer dependencies without treating them as mutation targets",async()=>{
 const root=await host("custom");await rename(path.join(root,"node_modules/react"),path.join(root,"react-store"));await symlink(path.join(root,"react-store"),path.join(root,"node_modules/react"));
 success(await run(root));expect(JSON.parse(await readFile(path.join(root,"react-store/package.json"),"utf8")).version).toBe("19.1.0");
});

it("does not mistake an Electron/custom renderer's Vite dependency for a Vite app",async()=>{
 const root=await host("custom");const file=path.join(root,"package.json");const pkg=JSON.parse(await readFile(file,"utf8"));pkg.dependencies.vite="7.3.6";pkg.dependencies.electron="42.0.0";pkg.scripts.dev="electron-vite dev";await writeFile(file,JSON.stringify(pkg));
 expect(success(await run(root)).integration?.kind).toBe("react");expect(await readFile(file,"utf8")).toBe(JSON.stringify(pkg));
});
