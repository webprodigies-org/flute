import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {chromium,expect} from '@playwright/test';
const root=fileURLToPath(new URL('../',import.meta.url));
const scratch=await mkdtemp(path.join(tmpdir(),'flute-frameworks-'));
const children=[];let browser;
const kind=process.argv[2]??'app';
const host=path.join(scratch,'host');
async function put(file,text){await mkdir(path.dirname(path.join(host,file)),{recursive:true});await writeFile(path.join(host,file),text)}
function run(exe,args,cwd=host){return new Promise((resolve,reject)=>{const child=spawn(exe,args,{cwd,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);const timer=setTimeout(()=>child.kill(),110000);child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);code===0?resolve(output):reject(Error(output))})})}
async function freePort(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port}
async function server(args){const port=await freePort();const child=spawn(process.execPath,['node_modules/next/dist/bin/next',...args,'-H','127.0.0.1','-p',String(port)],{cwd:host,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});children.push(child);let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);const url='http://127.0.0.1:'+port;for(let i=0;i<150;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});if(r.ok)return {url,child}}catch{}if(child.exitCode!==null)throw Error(log);await new Promise(r=>setTimeout(r,100))}throw Error(log)}
try{
 await mkdir(host,{recursive:true});
 const published=process.env.FLUTE_REGISTRY_PACKAGE;
 const packed=published?undefined:JSON.parse(await run('npm',['pack','--ignore-scripts','--json','--pack-destination',scratch],root));
 const tarball=published?published.replace(/^@webprodigies\/flute@/,''):path.join(scratch,packed[0].filename);
 const react=kind==='app'?'19.2.0':'18.3.1';
 await put('package.json',JSON.stringify({private:true,type:'module',dependencies:{react,'react-dom':react,'@webprodigies/flute':tarball,...(kind!=='react'?{next:'16.3.5'}:{'@types/react':'^18.3.0','@types/react-dom':'^18.3.0',typescript:'5.9.3'})}}));
 await run('npm',['install','--ignore-scripts','--no-audit','--no-fund',...(published?['--cache',path.join(scratch,'cache'),'--registry','https://registry.npmjs.org/']:[])]);
 if(published){const installed=JSON.parse(await readFile(path.join(host,'node_modules/@webprodigies/flute/package.json'),'utf8'));assert.equal(installed.name+'@'+installed.version,published);}
 const counter='"use client";\nimport React,{createContext,useContext,useState} from "react";\nconst Context=createContext("missing");\nexport function Provider({children}) {return <Context.Provider value="existing provider">{children}</Context.Provider>}\nexport default function Counter(){const value=useContext(Context);const [count,setCount]=useState(0);return <article style={{background:"#fafafa",color:"#111",padding:40,width:700,height:400}}><h1>{value}</h1><button onClick={()=>setCount(c=>c+1)}>Count {count}</button></article>}';
 await put('src/Counter.jsx',counter);
 if(kind==='app'){
  await put('app/layout.jsx','import React from "react"; import {Provider} from "../src/Counter"; export default function Layout({children}){return <html><body><Provider>{children}</Provider></body></html>}');
  await put('app/page.jsx','import React from "react"; import Counter from "../src/Counter"; export default function Page(){return <Counter/>}');
 }else if(kind==='pages'){
  await put('pages/_app.jsx','import React from "react"; import {Provider} from "../src/Counter"; export default function App({Component,pageProps}){return <Provider><Component {...pageProps}/></Provider>}');
  await put('pages/index.jsx','export {default} from "../src/Counter";');
 }
 const cli=path.join(host,'node_modules/@webprodigies/flute/dist/cli/flute.js');
 const initialized=JSON.parse(await run(process.execPath,[cli,'init','--json']));
 assert.equal(initialized.success,true);assert.equal(initialized.data.integration.kind,kind==='react'?'react':'next-'+kind);
 assert.equal(JSON.parse(await run(process.execPath,[cli,'init','--json'])).data.changed,false);
 const recipe={version:1,id:'survey',title:'Host survey',definition:{width:1000,height:700,scene:{nodes:[{id:'host'}],camera:{rotateY:20,perspective:1800}},motion:{durationMs:200,tracks:[]}}};
 await put('src/flute/scenes/survey.scene.json',JSON.stringify(recipe));
 await put('src/flute/scenes/survey.jsx','"use client";\nimport React from "react"; import {Surface} from "@webprodigies/flute"; import Counter from "../../Counter"; export default function HostScene(){return <Surface id="host"><Counter/></Surface>}');
 await run(process.execPath,[cli,'sync']);
 await run(process.execPath,[cli,'validate']);
 browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let url;let dev;
 if(kind==='react'){
  await put('check.tsx','import React from "react"; import {Scene,Surface} from "@webprodigies/flute"; import {ProjectPreview} from "@webprodigies/flute/preview"; export const check=<ProjectPreview projectId="test" enabled active><Scene><Surface id="test">Host</Surface></Scene></ProjectPreview>;');
  await run(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','--strict','--jsx','react-jsx','--module','esnext','--moduleResolution','bundler','--target','es2022','--allowSyntheticDefaultImports','check.tsx']);
  await put('entry.jsx' ,'import React from "react"; import {createRoot} from "react-dom/client"; import {FluteProjectPreview} from "./src/flute/ProjectPreview"; import Counter,{Provider} from "./src/Counter"; createRoot(document.getElementById("root")).render(<Provider><FluteProjectPreview enabled active><Counter/></FluteProjectPreview></Provider>);');
  await run(path.join(root,'node_modules/.bin/esbuild'),['entry.jsx','--bundle','--outfile=bundle.js','--define:process.env.NODE_ENV="development"']);
  const staticServer=createServer(async(req,res)=>{res.setHeader('content-type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?await readFile(path.join(host,'bundle.js')):'<div id="root"></div><script src="/bundle.js"></script>')});
  await new Promise(r=>staticServer.listen(0,'127.0.0.1',r));children.push({kill:()=>staticServer.close()});url='http://127.0.0.1:'+staticServer.address().port;
 }else{
  dev=await server(kind==='app'?['dev']:['dev','--webpack']);url=dev.url;
  await page.goto(url);await expect(page.getByRole('button',{name:'Count 0'})).toBeVisible();
  await page.getByRole('button',{name:'Count 0'}).click();await expect(page.getByRole('button',{name:'Count 1'})).toBeVisible();
  const opened=JSON.parse(await run(process.execPath,[cli,'open','--url',url,'--no-open','--json']));assert.equal(opened.data.url,url+'/flute?flute-preview=1');
  url=opened.data.url;
 }
 await page.goto(url);
 await expect(page.getByText('Host survey',{exact:true})).toBeVisible({timeout:30000});
 await page.getByText('Host survey',{exact:true}).click();
 await expect(page.getByRole('button',{name:'Count 0'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'existing provider'})).toBeVisible();
 await page.getByRole('button',{name:'Count 0'}).click();
 await expect(page.getByRole('button',{name:'Count 1'})).toBeVisible();
 await page.getByRole('button',{name:'Count 1'}).evaluate(el=>el.dataset.kept='true');
 if(kind!=='react'){
  recipe.title='Revised host survey';
  await put('src/flute/scenes/survey.scene.json',JSON.stringify(recipe));
  await expect(page.getByRole('button',{name:'Count 1'})).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator('[data-kept="true"]')).toHaveText('Count 1');
 }
 await mkdir(path.join(root,'test-results'),{recursive:true});
 await page.screenshot({path:path.join(root,'test-results/portable-'+kind+'.png')});
 assert.deepEqual(errors,[]);
 if(kind==='app'){
  await run(process.execPath,[cli,'snapshot','--scene','survey','--url',dev.url]);
  await run(process.execPath,[cli,'export','--url',url+'&flute-scene=survey','--output','scene.mp4','--fps','30','--width','640','--height','480']);
  const probe=JSON.parse(await run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=nb_frames,r_frame_rate','-of','json','scene.mp4']));
  assert.equal(probe.streams[0].r_frame_rate,'30/1');assert.ok(Number(probe.streams[0].nb_frames)>0);
 }
 if(kind!=='react'){
  dev.child.kill();await new Promise(r=>dev.child.once('exit',r));
  await run(process.execPath,['node_modules/next/dist/bin/next','build','--webpack']);
  for(const entry of await readdir(path.join(host,'.next/static'),{recursive:true}))if(entry.endsWith('.js')){
   const text=await readFile(path.join(host,'.next/static',entry),'utf8');
   assert.ok(!text.includes('Revised host survey'),'Production assets must exclude development recipes');
  }
  const production=await server(['start']);
  assert.equal((await fetch(production.url+'/flute')).status,404);
  await page.goto(production.url);await expect(page.getByRole('button',{name:'Count 0'})).toBeVisible();
 }
 console.log(kind+': installed package/init/retry/sync, shared studio, real provider/counter and '+(kind==='react'?'bundler-independent React 18 renderer':'hot-reload identity/production 404')+' passed.');
}catch(error){console.error(error);process.exitCode=1}
finally{await browser?.close();for(const child of children)child.kill();await rm(scratch,{recursive:true,force:true})}
