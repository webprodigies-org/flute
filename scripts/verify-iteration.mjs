import assert from 'node:assert/strict';
import {writeFile,readFile,access,rename} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {expect} from '@playwright/test';
// Tests mutate only the disposable installed host, never project source or state.
export async function verifyIteration({page,host,origin,server,processes,waitFor,root,originalApp}) {
 const file=name=>path.join(host,'src',name);
 // Match an editor's complete-file save: Vite must never read a truncated module.
 const writeSource=async(name,source)=>{
  const temporary=file(name+'.pending');
  await writeFile(temporary,source);
  await rename(temporary,file(name));
 };
 const setupDiagnostics=[];
 const record=(kind,text)=>{setupDiagnostics.push({kind,text});if(setupDiagnostics.length>50)setupDiagnostics.shift()};
 const onError=error=>record('pageerror',error.message);
 const onConsole=message=>record('console',message.text());
 const onFailure=request=>record('requestfailed',request.url()+': '+request.failure()?.errorText);
 page.on('pageerror',onError);page.on('console',onConsole);page.on('requestfailed',onFailure);
 // Replacing the fixture's module graph is bootstrap, not the HMR behavior under
 // test. Detach the previous app before replacing its provider/component exports.
 await page.goto('about:blank');
 const sceneSource=distance=>`import type {PreviewDefinitionInput} from '@webprodigies/flute';
 export const definition:PreviewDefinitionInput={width:1400,height:980,scene:{camera:{perspective:1800,rotateY:-18},focus:{distance:${distance},fStop:2.8},nodes:[{id:'host'}]},motion:{durationMs:4000,tracks:[{target:{kind:'camera'},property:'x',keyframes:[{timeMs:0,value:-100},{timeMs:4000,value:100}]}]}};`;
 const shell=`import {App as Host,DashboardProvider} from './Host';
 import {Surface} from '@webprodigies/flute';import {ScenePreview} from '@webprodigies/flute/preview';import {definition} from './scene';
 export {DashboardProvider};const content=<Surface id="host" style={{width:1100,height:850,left:150,top:60}}><Host/></Surface>;
 export function App(){return <ScenePreview title="Existing project" definition={definition} hot={import.meta.hot}>{content}</ScenePreview>}`;
 await writeSource('Host.tsx',originalApp);
 await writeSource('scene.ts',sceneSource(1800));
 await writeSource('App.tsx',shell);
 await page.setViewportSize({width:1440,height:1000});
 try {
  await page.goto(origin);
  // Network-idle does not imply that Vite's module graph and React have mounted.
  await expect(page.getByText('Revenue: 12840',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
  await page.reload();
  await expect(page.getByText('Revenue: 12840',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
  assert.deepEqual(setupDiagnostics.filter(entry=>entry.kind==='pageerror'),[],
    'Fixture bootstrap must not hide browser exceptions');
 } catch(error) {
  const body=await page.locator('body').innerText();
  const diagnostics={url:page.url(),body,events:setupDiagnostics};
  console.error('Iteration setup diagnostics:',JSON.stringify(diagnostics));
  await writeFile(path.join(root,'test-results/iteration-failure.json'),JSON.stringify(diagnostics,null,2));
  await page.screenshot({path:path.join(root,'test-results/iteration-failure.png')});
  throw error;
 } finally {
  page.off('pageerror',onError);page.off('console',onConsole);page.off('requestfailed',onFailure);
 }
 await page.getByRole('button',{name:'Inspect 0',exact:true}).click();
 await expect(page.getByRole('button',{name:'Inspect 1',exact:true})).toBeVisible();
 await page.evaluate(()=>window.hostIdentity=document.querySelector('[data-testid="host-revenue"]'));
 const seek=page.getByRole('slider',{name:'Scene time'});
 await seek.fill('4000');
 const blur=await page.locator('[data-flute-id="host"]').getAttribute('data-flute-blur');
 await writeSource('scene.ts',sceneSource(1600));
 await expect(page.locator('[data-flute-id="host"]')).not.toHaveAttribute('data-flute-blur',blur);
 await expect(seek).toHaveValue('4000');
 await expect(page.getByRole('button',{name:'Inspect 1',exact:true})).toBeVisible();
 assert.equal(await page.evaluate(()=>window.hostIdentity===document.querySelector('[data-testid="host-revenue"]')),true);
 await writeSource('scene.ts',sceneSource(-1));
 await expect(page.getByRole('alert')).toContainText('last valid');
 await expect(page.getByRole('button',{name:'Play',exact:true})).toBeDisabled();
 await writeSource('scene.ts',sceneSource(1600));
 await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(seek).toHaveValue('4000');
 await writeSource('scene.ts','export const definition = ;');
 await expect(page.locator('vite-error-overlay')).toHaveCount(1);
 await writeSource('scene.ts',sceneSource(1600));
 await expect(page.locator('vite-error-overlay')).toHaveCount(0);
 await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(seek).toHaveValue('4000');
 await writeSource('Host.tsx',originalApp.replace('  const revenue =', '  throw new Error("Fixture render failure");\n  const revenue ='));
 await expect(page.getByRole('alert')).toContainText('Fixture render failure');
 await writeSource('Host.tsx',originalApp);
 await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(page.getByText('Revenue: 12840',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(page.getByRole('button',{name:'Play',exact:true})).toBeVisible();
 await page.screenshot({path:path.join(root,'test-results/product-loaded.png')});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
 await seek.focus();await page.keyboard.press('ArrowRight');
 await page.screenshot({path:path.join(root,'test-results/product-loaded-mobile.png')});
 const exited=new Promise(resolve=>server.once('exit',resolve));server.kill('SIGTERM');await exited;
 await expect(page.getByText('Reconnecting to your app…').first()).toBeVisible();
 const replacement=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',new URL(origin).port,'--strictPort'],{cwd:host,stdio:'ignore'});processes.push(replacement);
 await waitFor(origin,replacement);
 await expect(page.getByText('Revenue: 12840',{exact:true})).toBeVisible({timeout:20000});
 await expect(page.getByText('Reconnecting to your app…')).toHaveCount(0,{timeout:20000});
 await writeSource('App.tsx',originalApp);
 await expect(page.locator('[data-flute-preview]')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Existing revenue dashboard'})).toBeVisible();
 for(const directory of ['demo','examples','dist/tests']) {
   let present=true;try{await access(path.join(root,directory))}catch{present=false}
   assert.equal(present,false,`Retired fixtures must not be shipped: ${directory}`);
 }
 const html=await readFile(path.join(root,'dist/index.html'),'utf8');
 assert.ok(!html.includes('/demo/')&&!html.includes('/tests/'));
 console.log('Iteration: installed shell, metadata HMR, schema/syntax/render recovery, state, keyboard/mobile, reconnect and product/test build separation passed.');
}
