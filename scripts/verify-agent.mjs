import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {expect} from '@playwright/test';

// Exercise the exact example emitted by the installed guide and the independently
// authored source pair through the existing disposable installed-host workflow.
export async function verifyAgent({page,host,origin,root,cli,ok,installedGuide}) {
 const handoff=await readFile(path.join(host,'FLUTE.md'),'utf8');
 assert.ok(handoff.includes('npx flute guide --json'));
 assert.ok(handoff.includes('src/flute/scenes'));
 const recipeDirectory=path.join(host,'src/flute/scenes');
 const example=installedGuide.capabilities.example;
 assert.ok(example.componentSource && example.recipe);
 await writeFile(path.join(host,example.recipePath),JSON.stringify(example.recipe));
 await writeFile(path.join(host,example.componentPath),example.componentSource);
 const fixture=name=>readFile(path.join(root,'tests/agent',name),'utf8');
 const initial=JSON.parse(await fixture('initial.scene.json'));
 const revised=JSON.parse(await fixture('revised.scene.json'));
 assert.equal(initial.id,revised.id);
 assert.notDeepEqual(initial.definition,revised.definition);
 const binding=await fixture('scene.tsx.txt');
 await writeFile(path.join(recipeDirectory,`${initial.id}.scene.json`),JSON.stringify(initial));
 await writeFile(path.join(recipeDirectory,`${initial.id}.tsx`),binding);
 await ok('npm',['install','--ignore-scripts','--no-audit','--no-fund','--save-dev','@types/react@19.2.0','@types/react-dom@19.2.0']);
 await ok(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','--strict','--skipLibCheck','--jsx','react-jsx','--moduleResolution','bundler','--module','esnext','--target','es2022','--lib','es2022,dom','--types','vite/client','src/main.tsx',example.componentPath,`src/flute/scenes/${initial.id}.tsx`]);
 await ok('npm',['run','build']);
 await ok(process.execPath,[path.join(root,'scripts/check-agent-trial.mjs')],root);
 for(const recipe of [example.recipe,initial]) {
   const opened=JSON.parse(await ok(process.execPath,[cli,'open','--scene',recipe.id,'--url',origin,'--no-open','--json']));
   const url=opened.data.url;
   await page.setViewportSize({width:1440,height:1000});
   await page.goto(url);await page.waitForLoadState('networkidle');
   await expect(page.getByText('Revenue: 12840',{exact:true})).toBeVisible();
   await expect(page.getByRole('alert')).toHaveCount(0);
   assert.equal(await page.locator('[data-testid="host-revenue"]').count(),1);
   const button=page.getByRole('button',{name:'Inspect 0',exact:true});
   await button.focus();await page.keyboard.press('Enter');
   await expect(page.getByRole('button',{name:'Inspect 1',exact:true})).toBeVisible();
   await page.evaluate(()=>window.agentHostIdentity=document.querySelector('[data-testid="host-revenue"]'));
   const seek=page.getByRole('slider',{name:'Scene time'});
   const duration=Number(await seek.getAttribute('max'));
   assert.ok(duration>0);
   const frames=[];
   for(const fraction of [0,.25,.5,.75,1]) {
     await seek.fill(String(Math.round(duration*fraction)));
     await page.screenshot({path:path.join(root,'test-results',`${recipe.id}-${fraction}.png`)});
     frames.push(await page.locator('[data-flute-scene]').innerHTML());
   }
   assert.notEqual(frames[0],frames[4],'Canonical scene changes over time');
   assert.equal(await page.evaluate(()=>window.agentHostIdentity===document.querySelector('[data-testid="host-revenue"]')),true);
   await expect(page.getByRole('button',{name:'Inspect 1',exact:true})).toBeVisible();
   if(recipe.id===initial.id) {
     await writeFile(path.join(recipeDirectory,`${initial.id}.scene.json`),JSON.stringify(revised));
     await expect(page.getByRole('slider',{name:'Scene time'})).not.toHaveAttribute('max',String(duration));
     await expect(page.getByRole('alert')).toHaveCount(0);
     await expect(page.getByRole('button',{name:'Inspect 1',exact:true})).toBeVisible();
     assert.equal(await page.evaluate(()=>window.agentHostIdentity===document.querySelector('[data-testid="host-revenue"]')),true);
     await page.reload();await page.waitForLoadState('networkidle');
     await expect(page.getByText('Revenue: 12840',{exact:true})).toBeVisible();
     await page.screenshot({path:path.join(root,'test-results/agent-revised.png')});
     await ok(process.execPath,[cli,'export','--url',url,'--output','agent-revised.mp4','--fps','30','--width','960','--height','720','--json']);
     const probe=JSON.parse(await ok('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=nb_frames,r_frame_rate','-of','json','agent-revised.mp4']));
     assert.equal(probe.streams[0].r_frame_rate,'30/1');
     assert.equal(Number(probe.streams[0].nb_frames),360);
     await ok('ffmpeg',['-v','error','-i','agent-revised.mp4','-frames:v','1','-y',path.join(root,'test-results/agent-export.png')]);
   }
   await ok(process.execPath,[cli,'snapshot','--scene',recipe.id,'--url',origin,'--json']);
   const saved=JSON.parse(await readFile(path.join(recipeDirectory,`${recipe.id}.scene.json`),'utf8'));
   assert.ok(saved.snapshot.image.startsWith('data:image/png;base64,'));
   await page.setViewportSize({width:390,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
   await page.screenshot({path:path.join(root,'test-results',`${recipe.id}-mobile.png`)});
 }
 console.log('Installed guide example + real Codex author/revision: type/build, canonical registration, provider data, identity, five frames, HMR/reopen, snapshots and mobile passed.');
}
