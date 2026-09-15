import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';import {tmpdir} from 'node:os';import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';import {createServer} from 'node:net';import {chromium} from 'playwright';import {expect} from '@playwright/test';
const root=fileURLToPath(new URL('../',import.meta.url));const scratch=await mkdtemp(path.join(tmpdir(),'flute-library-'));const host=path.join(scratch,'local-project');
let server,browser;
function run(args,cwd=host){return new Promise((resolve,reject)=>{const p=spawn(args[0],args.slice(1),{cwd,stdio:['ignore','pipe','pipe']});let out='';p.stdout.on('data',v=>out+=v);p.stderr.on('data',v=>out+=v);p.on('error',reject);p.on('exit',code=>code===0?resolve(out):reject(Error(out)));})}
async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const n=s.address().port;await new Promise(r=>s.close(r));return n}
try{
 await cp(path.join(root,'local-project'),host,{recursive:true,filter:source=>!source.includes('node_modules')&&!source.includes('/dist')});
 await mkdir(path.join(scratch,'.local-package'));const packed=JSON.parse(await run(['npm','pack','--json',...(process.env.FLUTE_VERIFY_PREBUILT==='1'?['--ignore-scripts']:[]),'--pack-destination',path.join(scratch,'.local-package')],root));
 await run(['npm','install','--force','--ignore-scripts','--no-audit','--no-fund',path.join(scratch,'.local-package',packed[0].filename)]);
 assert.equal((await run([process.execPath,'--input-type=module','-e',"import {RESOURCES} from '@webprodigies/flute'; console.log(typeof RESOURCES['resolve-recipes'])"])).trim(),'function','Use the freshly packed catalog operation');
 const cli=path.join(host,'node_modules/@webprodigies/flute/dist/cli/flute.js');await run([process.execPath,cli,'init']);
 await run(['npm','run','build']);
 const n=await port();const origin=`http://127.0.0.1:${n}`;
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(n),'--strictPort'],{cwd:host,stdio:'ignore'});
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 // Generate real images through the installed CLI, then verify refresh and static capture.
 const snap=async(id,time)=>JSON.parse(await run([process.execPath,cli,'snapshot','--scene',id,'--url',origin,...(time===undefined?[]:['--time',String(time)]),'--json']));
 const platingPath=path.join(host,'src/flute/scenes/plating.scene.json');
 assert.equal((await snap('plating',0)).success,true);const firstImage=JSON.parse(await readFile(platingPath,'utf8')).snapshot.image;
 assert.equal((await snap('plating',8000)).success,true);const secondImage=JSON.parse(await readFile(platingPath,'utf8')).snapshot.image;
 assert.notEqual(firstImage,secondImage,'Snapshot reflects the canonical seek time');
 const staticPath=path.join(host,'src/flute/scenes/customer-focus.scene.json');const savedStatic=await readFile(staticPath,'utf8');const still=JSON.parse(savedStatic);delete still.definition.motion;await writeFile(staticPath,JSON.stringify(still));
 assert.equal((await snap('customer-focus')).data.timeMs,0,'Static scenes support snapshots');await writeFile(staticPath,savedStatic);
 const cliList=JSON.parse(await run([process.execPath,cli,'scenes','--json']));assert.equal(cliList.success,true);assert.equal(cliList.data.scenes.length,10);
 browser=await chromium.launch({channel:'chromium',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(origin+'/?flute-preview=1');await expect(page.getByRole('heading',{name:'Your scenes',exact:true})).toBeVisible();
 await expect(page.getByText('10 perspectives',{exact:true})).toBeVisible();
 // Real projected edges must widen toward the viewer at the bottom.
 const upper=await page.locator('[data-scene-id]').nth(0).boundingBox();
 const lower=await page.locator('[data-scene-id]').nth(3).boundingBox();
 assert.ok(lower.width>upper.width*1.15&&lower.y>upper.y,'Credits recede at the top and approach at the bottom');
 await page.locator('.flute-library-scroll').evaluate(e=>e.scrollTop=450);
 await page.waitForTimeout(60);
 // Isolate the existing per-surface optical filter with a high-frequency texture.
 const pattern=await page.addStyleTag({content:'.flute-scene-row,.flute-library-heading{background:repeating-linear-gradient(90deg,#000 0 12px,#fff 12px 24px)!important}.flute-scene-row>*,.flute-library-heading>*{visibility:hidden}'});
 const shot=await page.screenshot();
 const contrast=await page.evaluate(async data=>{const img=new Image();img.src=data;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return [160,390,500,610,900].map(y=>{const p=ctx.getImageData(690,y,60,4).data;const v=Array.from({length:p.length/4},(_,i)=>p[i*4]);return Math.max(...v)-Math.min(...v)})},'data:image/png;base64,'+shot.toString('base64'));
 assert.ok(contrast.slice(1,4).every(value=>value>200)&&contrast[0]<200&&contrast[4]<220,`Three center rows remain readable with gentler outer blur: ${contrast}`);
 await pattern.evaluate(e=>e.remove());
 // Retiring a row may happen only beyond the projected screen, never visibly.
 const transitions=await page.evaluate(async()=>{
  const el=document.querySelector('.flute-library-scroll');const max=el.scrollHeight-el.clientHeight;
  const snapshot=()=>new Map([...document.querySelectorAll('[data-scene-id]')].map(e=>[e.getAttribute('data-scene-id'),e.getBoundingClientRect()]));
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  el.scrollTop=0;await frame();let before=snapshot();const violations=[];let removed=0;
  for(const direction of [1,-1])for(let step=0;step<=Math.ceil(max/10);step++){
   el.scrollTop=direction===1?Math.min(max,step*10):Math.max(0,max-step*10);await frame();
   const after=snapshot();for(const [id,box] of before)if(!after.has(id)){removed++;if(box.bottom>0&&box.top<innerHeight)violations.push({id,top:box.top,bottom:box.bottom})}before=after;
  }
  return {removed,violations};
 });
 assert.ok(transitions.removed>0,'Exercise real row retirement');assert.deepEqual(transitions.violations,[],'No visible row may disappear');
 assert.equal(await page.locator('[data-flute-id="scene-list-heading"]').count(),1,'Heading has no scroll cutoff');
 for(const size of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(size);
  const el=page.locator('.flute-library-scroll');
  await el.evaluate(e=>e.scrollTop=0);
  await expect.poll(async()=>{const r=await page.locator('[data-scene-id="customer-focus"]').boundingBox();return Math.abs(r.y+r.height/2-size.height/2)}).toBeLessThan(5);
  await el.evaluate(e=>e.scrollTop=e.scrollHeight);
  await expect.poll(async()=>{const r=await page.locator('[data-scene-id="sidebar-survey"]').boundingBox();return Math.abs(r.y+r.height/2-size.height/2)}).toBeLessThan(5);
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('.flute-library-scroll').evaluate(e=>e.scrollTop=450);
 await page.screenshot({path:path.join(root,'test-results/library-edge-fade.png')});
 // Verify an actual composited alpha fade, outside the spatial hierarchy.
 const white=await page.addStyleTag({content:'.flute-library-stage{background:white}.flute-library-stage>*{visibility:hidden}'});
 const fadeShot=await page.screenshot();const fade=await page.evaluate(async data=>{const img=new Image();img.src=data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return [1,90,200].map(y=>ctx.getImageData(700,y,1,1).data[0])},'data:image/png;base64,'+fadeShot.toString('base64'));
 assert.ok(fade[0]<5&&fade[1]>80&&fade[1]<180&&fade[2]>250,`Top edge fades smoothly into black: ${fade}`);await white.evaluate(e=>e.remove());

 if(process.env.FLUTE_VERIFY_HARDWARE!=='0') {
 const gpu=await (await browser.newBrowserCDPSession()).send('SystemInfo.getInfo');assert.equal(gpu.gpu.featureStatus.gpu_compositing,'enabled');
 const frames=await page.evaluate(()=>new Promise(resolve=>{const values=[];let start=0,last=0;const el=document.querySelector('.flute-library-scroll');function tick(now){if(!start){start=now;last=now}else if(now-start>300)values.push(now-last);last=now;el.scrollTop=450+450*Math.sin((now-start)/1200);if(now-start<3300)requestAnimationFrame(tick);else resolve(values)}requestAnimationFrame(tick)}));
 frames.sort((a,b)=>a-b);const fps=1000/(frames.reduce((a,b)=>a+b,0)/frames.length);const p95=frames[Math.floor(frames.length*.95)];console.log(JSON.stringify({libraryFps:fps,p95,frames:frames.length}));assert.ok(fps>=55&&p95<22,'Library scrolling must meet the hardware frame budget');
 } else console.log('Hardware scrolling budget not measured on CI; verify:release requires it locally.');
 await page.locator('.flute-library-scroll').evaluate(e=>e.scrollTop=0);
 const angle=await page.locator('[data-flute-stage]').getAttribute('style');
 const scroll=page.getByRole('region',{name:'Scenes'});const scroller=page.locator('.flute-library-scroll');
 await scroller.focus();await page.keyboard.press('PageDown');await expect.poll(()=>scroller.evaluate(e=>e.scrollTop)).toBeGreaterThan(100);
 assert.equal(await page.locator('[data-flute-stage]').getAttribute('style'),angle,'Scrolling must retain camera pose');
 await scroller.evaluate(e=>e.scrollTop=0);
 await scroller.evaluate(e=>e.scrollTop=600);
 await expect(page.locator('[data-scene-id="plating"] img')).toBeVisible();
 assert.ok(await page.locator('[data-scene-id="plating"] img').evaluate(e=>e.complete&&e.naturalWidth>0),'Tile contains a decoded real snapshot');
 assert.equal(await page.locator('iframe').count(),0,'No live scenes run in tiles');
 await page.locator('[data-scene-id="plating"]').click();
 await expect(page.locator('[data-flute-preview]')).toBeVisible();await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
 await expect(page.getByText('$128,430',{exact:false}).first()).toBeVisible();
 await page.getByRole('slider',{name:'Scene time'}).fill('8000');
 await expect(page.getByTestId('scene-time')).toContainText('0:08');
 await page.getByRole('slider',{name:'Scene time'}).blur();
 await page.screenshot({path:path.join(root,'test-results/library-scene.png')});
 await page.getByRole('link',{name:'Back to scenes',exact:true}).click();await expect(page.locator('[data-flute-library]')).toBeVisible();await page.goBack();await expect(page.locator('[data-flute-preview]')).toBeVisible();
 await page.reload();await expect(page.getByRole('slider',{name:'Scene time'})).toHaveValue('0');
 const opened=JSON.parse(await run([process.execPath,cli,'open','--scene','plating','--url',origin,'--no-open','--json']));assert.equal(opened.success,true);assert.equal(new URL(opened.data.url).searchParams.get('flute-scene'),'plating');
 await page.goto(opened.data.url);await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
 // Export samples the real installed scene and excludes product controls.
 await run([process.execPath,cli,'export','--url',opened.data.url,'--output','verification.mp4','--fps','30','--width','960','--height','720']);
 await run(['ffmpeg','-v','error','-i','verification.mp4','-frames:v','1',path.join(root,'test-results/library-export.png'),'-y']);
 const probe=JSON.parse(await run(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=nb_frames,r_frame_rate','-of','json','verification.mp4']));assert.equal(probe.streams[0].r_frame_rate,'30/1');
 await page.goto(origin+'/?flute-preview=1');await page.screenshot({path:path.join(root,'test-results/library-home.png')});
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await page.screenshot({path:path.join(root,'test-results/library-mobile.png')});
 const source=path.join(host,'src/flute/scenes/plating.scene.json');const original=await readFile(source,'utf8');const invalid=JSON.parse(original);invalid.version=999;await writeFile(source,JSON.stringify(invalid));
 await expect(page.getByText(/Some scene sources need attention/)).toBeVisible();
 await writeFile(source,original);await expect(page.getByText(/Some scene sources need attention/)).toHaveCount(0);await expect(page.locator('[data-scene-id="plating"]')).toHaveCount(1);await page.waitForLoadState('networkidle');
 const added=JSON.parse(original);added.id='added';added.title='Added from source';
 const addedJson=path.join(host,'src/flute/scenes/added.scene.json');const addedComponent=path.join(host,'src/flute/scenes/added.tsx');
 await writeFile(addedComponent,await readFile(path.join(host,'src/flute/scenes/plating.tsx'),'utf8'));await writeFile(addedJson,JSON.stringify(added));
 await expect(page.locator('[data-scene-id="added"]')).toHaveCount(1);await expect(page.getByText('11 perspectives',{exact:true})).toBeVisible();
 await rm(addedJson);await rm(addedComponent);await expect(page.getByText('10 perspectives',{exact:true})).toBeVisible();await page.waitForLoadState('networkidle');
 await page.goto(origin+'/?flute-preview=1&flute-scene=deleted');await expect(page.getByRole('alert')).toContainText('cannot be opened');
 await page.goto(origin);await expect(page.getByRole('link',{name:'Open scene library ↗'})).toBeVisible();
 console.log('Installed catalog: 10 scenes, native plane scroll, selection/reload/CLI parity, recovery, mobile and real MP4 export passed.');
}finally{await browser?.close();server?.kill('SIGTERM');await rm(scratch,{recursive:true,force:true})}
