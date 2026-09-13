import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
// Installed dashboard integration: native pointer events, stable DOM, deterministic
// replay, independent focus, responsive controls and hardware frame-time evidence.
let server;
let origin=process.env.FLUTE_DASHBOARD_URL;
if(!origin) {
 const reservation=createServer(); await new Promise(r=>reservation.listen(0,'127.0.0.1',r));
 const port=reservation.address().port; await new Promise(r=>reservation.close(r));
 origin=`http://127.0.0.1:${port}`;
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:'examples/dashboard-lab',stdio:'ignore'});
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{} await new Promise(r=>setTimeout(r,100))}
}
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:'chromium'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/');
 await page.getByRole('heading',{name:'Documents',exact:true}).waitFor();
 await page.waitForTimeout(600);
 await page.screenshot({path:'test-results/dashboard-normal.png'});
 const buttonStyle=()=>page.getByRole('button',{name:'Dashboard',exact:true}).evaluate(e=>{
   const s=getComputedStyle(e);return Object.fromEntries(['color','backgroundColor','borderRadius','borderWidth','fontFamily','fontSize','fontWeight','padding','height','width'].map(k=>[k,s[k]]));
 });
 const originalStyle=await buttonStyle();
 await page.getByRole('button',{name:'Quick Create',exact:true}).click();
 await page.getByRole('link',{name:'Watch sidebar scene'}).click();
 await page.locator('[data-flute-id="user"]').waitFor();
 assert.equal(await page.locator('[data-flute-id]').count(),17);
 assert.equal(await page.locator('[data-flute-diagnostics]').count(),0);
 assert.deepEqual(await buttonStyle(),originalStyle,'Surface wrapping must preserve the real menu styles');
 await page.evaluate(()=>window.originalRow=document.querySelector('[data-flute-id="reports"]'));
 const seek=async(time)=>{await page.getByRole('slider',{name:'Scene time'}).fill(String(time));await page.waitForTimeout(60)};
 const pose=()=>page.locator('[data-flute-stage]').getAttribute('style');
 const first=await pose();
 const depths=await page.locator('.sidebar-layer').evaluateAll(es=>es.map(e=>Number(e.style.transform.match(/translate3d\(0px, 0px, ([-.\d]+)px/)[1])));
 assert.equal(new Set(depths).size,15,'staircase has distinct initial depths');
 await seek(11000);
 const middleDepths=await page.locator('.sidebar-layer').evaluateAll(es=>es.map(e=>Number(e.style.transform.match(/translate3d\(0px, 0px, ([-.\d]+)px/)[1])));
 assert.ok(middleDepths.some(d=>d===0)&&middleDepths.some(d=>d>0),'connected cascade is settling progressively');
 await seek(22000);
 assert.notEqual(await pose(),first);
 for(const id of ['brand','dashboard','reports','user']) assert.match(await page.locator(`[data-flute-id="${id}"]`).getAttribute('style'),/translate3d\(0px, 0px, 0px\)/);
 assert.equal(await page.evaluate(()=>window.originalRow===document.querySelector('[data-flute-id="reports"]')),true);
 await page.getByRole('button',{name:'Reset',exact:true}).click();
 assert.equal(await pose(),first);
 await page.screenshot({path:'test-results/dashboard-start.png'});
 const system=await (await browser.newBrowserCDPSession()).send('SystemInfo.getInfo');
 assert.equal(system.gpu.featureStatus.gpu_compositing,'enabled');
 await page.getByRole('button',{name:'Play',exact:true}).click();
 const samples=await page.evaluate(()=>new Promise(resolve=>{const result=[];let start,last;function frame(now){if(start===undefined){start=last=now;}else if(now-start>500)result.push(now-last);last=now;if(now-start<10500)requestAnimationFrame(frame);else resolve(result)}requestAnimationFrame(frame)}));
 samples.sort((a,b)=>a-b);
 const report={fps:1000/(samples.reduce((a,b)=>a+b,0)/samples.length),p95:samples[Math.floor(samples.length*.95)],over33ms:samples.filter(x=>x>33.4).length/samples.length};
 console.log('Dashboard frame budget',JSON.stringify(report));
 assert.ok(report.fps>=55,'average FPS >=55');assert.ok(report.p95<20,'p95 frame time <20ms');assert.ok(report.over33ms<.02,'<2% missed frames');
 await seek(11000);await page.screenshot({path:'test-results/dashboard-mid.png'});
 await seek(22000);await page.screenshot({path:'test-results/dashboard-end.png'});
 await page.getByRole('button',{name:'shadcn m@example.com'}).click();
 await page.getByRole('menuitem',{name:'Account',exact:true}).waitFor();
 await page.keyboard.press('Escape');
 await page.getByRole('checkbox',{name:'Cascade',exact:true}).uncheck();
 assert.equal(await page.locator('.sidebar-layer').evaluateAll(es=>new Set(es.map(e=>e.style.transform)).size),1,'cascade can be disabled');
 await page.getByRole('checkbox',{name:'Cascade',exact:true}).check();
 await page.evaluate(()=>window.__FLUTE_CAPTURE__.seek(10000));
 assert.equal(await page.getByTestId('scene-time').textContent(),'10.0 / 22s');
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.reload();await page.locator('[data-flute-id="user"]').waitFor();
 assert.equal(await page.locator('html').evaluate(e=>e.scrollWidth),390);
 assert.equal(await page.getByTestId('scene-time').textContent(),'0.0 / 22s');
 await page.screenshot({path:'test-results/dashboard-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('Dashboard: normal UI, 17 surfaces, native menu interaction, stable DOM, replay, mobile and reduced motion passed.');
} finally {await browser.close(); server?.kill()}
