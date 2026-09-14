import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';import {tmpdir} from 'node:os';import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';import {createServer} from 'node:net';import {chromium} from 'playwright';import {expect} from '@playwright/test';
const root=fileURLToPath(new URL('../',import.meta.url));const scratch=await mkdtemp(path.join(tmpdir(),'flute-library-'));const host=path.join(scratch,'local-project');
let server,browser;
function run(args,cwd=host){return new Promise((resolve,reject)=>{const p=spawn(args[0],args.slice(1),{cwd,stdio:['ignore','pipe','pipe']});let out='';p.stdout.on('data',v=>out+=v);p.stderr.on('data',v=>out+=v);p.on('error',reject);p.on('exit',code=>code===0?resolve(out):reject(Error(out)));})}
async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const n=s.address().port;await new Promise(r=>s.close(r));return n}
try{
 await cp(path.join(root,'local-project'),host,{recursive:true,filter:source=>!source.includes('node_modules')&&!source.includes('/dist')&&!source.includes('/.flute')});
 await mkdir(path.join(scratch,'.local-package'));await run(['npm','pack','--pack-destination',path.join(scratch,'.local-package')],root);
 await run(['npm','install','--offline','--ignore-scripts','--no-audit','--no-fund']);
 const cli=path.join(host,'node_modules/@flute/scene/dist/cli/flute.js');await run([process.execPath,cli,'init']);
 await run(['npm','run','build']);
 const n=await port();const origin=`http://127.0.0.1:${n}`;
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(n),'--strictPort'],{cwd:host,stdio:'ignore'});
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 const cliList=JSON.parse(await run([process.execPath,cli,'scenes','--json']));assert.equal(cliList.success,true);assert.equal(cliList.data.scenes.length,10);
 browser=await chromium.launch({channel:'chromium',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(origin+'/?flute-preview=1');await expect(page.getByRole('heading',{name:'Your scenes',exact:true})).toBeVisible();
 await expect(page.locator('[data-scene-id]')).toHaveCount(10);
 const angle=await page.locator('[data-flute-stage]').getAttribute('style');
 const scroll=page.getByRole('region',{name:'Scenes'});const scroller=page.locator('.flute-library-scroll');
 await scroller.focus();await page.keyboard.press('PageDown');await expect.poll(()=>scroller.evaluate(e=>e.scrollTop)).toBeGreaterThan(100);
 assert.equal(await page.locator('[data-flute-stage]').getAttribute('style'),angle,'Scrolling must retain camera pose');
 await scroller.evaluate(e=>e.scrollTop=0);
 await page.locator('[data-scene-id="plating"]').click();
 await expect(page.locator('[data-flute-preview]')).toBeVisible();await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
 await expect(page.getByText('$128,430',{exact:false}).first()).toBeVisible();
 await page.getByRole('slider',{name:'Scene time'}).fill('8000');
 await expect(page.getByTestId('scene-time')).toContainText('0:08');
 await page.screenshot({path:path.join(root,'test-results/library-scene.png')});
 await page.reload();await expect(page.getByRole('slider',{name:'Scene time'})).toHaveValue('0');
 const opened=JSON.parse(await run([process.execPath,cli,'open','--scene','plating','--url',origin,'--no-open','--json']));assert.equal(opened.success,true);assert.equal(new URL(opened.data.url).searchParams.get('flute-scene'),'plating');
 await page.goto(opened.data.url);await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
 // Export samples the real installed scene and excludes product controls.
 await run([process.execPath,cli,'export','--url',opened.data.url,'--output','verification.mp4','--fps','30','--width','960','--height','720']);
 const probe=JSON.parse(await run(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=nb_frames,r_frame_rate','-of','json','verification.mp4']));assert.equal(probe.streams[0].r_frame_rate,'30/1');
 await page.goto(origin+'/?flute-preview=1');await page.screenshot({path:path.join(root,'test-results/library-home.png')});
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await page.screenshot({path:path.join(root,'test-results/library-mobile.png')});
 const source=path.join(host,'src/flute/scenes/plating.scene.json');const original=await readFile(source,'utf8');const invalid=JSON.parse(original);invalid.version=999;await writeFile(source,JSON.stringify(invalid));
 await page.reload();await expect(page.getByText(/Some scene sources need attention/)).toBeVisible();
 await writeFile(source,original);await page.reload();await expect(page.locator('[data-scene-id="plating"]')).toHaveCount(1);
 await page.goto(origin+'/?flute-preview=1&flute-scene=deleted');await expect(page.getByRole('alert')).toContainText('cannot be opened');
 await page.goto(origin);await expect(page.getByRole('link',{name:'Open scene library ↗'})).toBeVisible();
 console.log('Installed catalog: 10 scenes, native plane scroll, selection/reload/CLI parity, recovery, mobile and real MP4 export passed.');
}finally{await browser?.close();server?.kill('SIGTERM');await rm(scratch,{recursive:true,force:true})}
