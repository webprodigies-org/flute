import {test,expect} from '@playwright/test';
import {FLUTE_BRAND} from '../../src/core/branding';
test('real entry has honest empty state and no demo routes or fake playback',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/A place for every perspective/})).toBeVisible();
 await expect(page.getByRole('button',{name:'Play',exact:true})).toHaveCount(0);
 await page.getByText('Connect your first scene',{exact:true}).click();
 await expect(page.getByText(/Save each recipe/)).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});
test('one product shell preserves real context/state through seek and invalid-source recovery',async({page})=>{
 let requests=0;page.on('request',request=>{if(request.url().endsWith('/data.json'))requests++});
 await page.goto('/tests/preview/fixture.html');
 // A real request is supplied by the fixture, not by the preview renderer.
 await expect(page.getByRole('heading',{name:'Provider content'})).toBeVisible();
 await page.getByRole('button',{name:'Count 0',exact:true}).click();
 await page.evaluate(()=>{(window as any).originalHost=document.querySelector('[data-testid="host"]')});
 const seek=page.getByRole('slider',{name:'Scene time'});
 await seek.fill('4000');
 await expect(page.getByTestId('scene-time')).toHaveText('0:04 / 0:08');
 const transform=await page.locator('[data-flute-stage]').getAttribute('style');
 await page.getByRole('button',{name:'Invalid source',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('last valid');
 expect(await page.locator('[data-flute-stage]').getAttribute('style')).toBe(transform);
 await expect(page.getByRole('button',{name:'Play',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Export',exact:true})).toBeDisabled();
 await expect(page.evaluate(()=>{(window as any).__FLUTE_CAPTURE__.seek(1000)})).rejects.toThrow();
 await page.getByRole('button',{name:'Correct source',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Count 1',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).originalHost===document.querySelector('[data-testid="host"]'))).toBe(true);
 expect(requests).toBe(1);
 await page.evaluate(async()=>{await (window as any).__FLUTE_CAPTURE__.seek(2000)});
 await expect(seek).toHaveValue('2000');
 await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
 await expect(page.locator('[data-flute-capture="scene"]')).toHaveAttribute('data-flute-valid','true');
 await seek.fill('8000');
 await page.getByRole('button',{name:'Replay',exact:true}).click();
 await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.getByRole('button',{name:'Restart',exact:true}).click();
 await expect(seek).toHaveValue('0');
 await page.locator('.flute-export summary').click();
 await page.getByRole('combobox',{name:'Export frame rate'}).selectOption('30');
 await expect(page.locator('.flute-export-panel code')).toContainText('--fps 30');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{if(!(window as any).copyRetried){(window as any).copyRetried=true;throw new Error('Denied')}}}}));
 await page.getByRole('button',{name:'Copy command'}).click();
 await expect(page.getByRole('region',{name:'Export your scene'}).getByRole('status')).toContainText('Select and copy');
 await page.getByRole('button',{name:'Copy command'}).click();
 await expect(page.getByRole('button',{name:'Copied',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('.flute-export summary')).toBeFocused();
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(page.getByRole('button',{name:'Play',exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});

test('scene cover fills every viewport and the bottom backdrop progressively blurs real pixels',async({page})=>{
 await page.goto('/tests/preview/fixture.html');
 await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
 for(const size of [{width:1920,height:1080},{width:390,height:844},{width:667,height:320}]){
  await page.setViewportSize(size);
  await expect.poll(()=>page.locator('[data-flute-capture="scene"]').boundingBox()).toEqual({x:0,y:0,...size});
  await expect.poll(async()=>(await page.locator('[data-flute-scene]').boundingBox())!.width).toBeGreaterThanOrEqual(size.width-1);
  await expect.poll(async()=>(await page.locator('[data-flute-scene]').boundingBox())!.height).toBeGreaterThanOrEqual(size.height-1);
  const geometry=await page.locator('[data-flute-scene]').boundingBox();
  expect(geometry!.width/geometry!.height).toBeCloseTo(1400/980,3);
 }
 await page.setViewportSize({width:1440,height:1000});
 // A diagnostic pattern on the actual capture viewport isolates backdrop blur
 // from scene depth of field. A tint/gradient alone cannot remove stripe contrast.
 await page.addStyleTag({content:'.flute-canvas{background:repeating-linear-gradient(90deg,#000 0 12px,#fff 12px 24px)!important}.flute-canvas>*{visibility:hidden}'});
 const contrast=async()=>{
  const shot=await page.screenshot();
  return page.evaluate(async data=>{
   const img=new Image();img.src=data;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0);
   return [650,760,940].map(y=>{const p=ctx.getImageData(24,y,48,4).data;const values=Array.from({length:p.length/4},(_,i)=>p[i*4]);return Math.max(...values)-Math.min(...values)});
  },'data:image/png;base64,'+shot.toString('base64'));
 };
 // ResizeObserver layout and Chromium's backdrop compositor settle separately.
 // Wait for the rendered result after rapid viewport changes; retain every pixel
 // assertion so missing blur, flat blur and tint-only replacements still fail.
 await expect(async()=>{
  const blurred=await contrast();
  expect(blurred[0]).toBeGreaterThan(240);
  expect(blurred[1]).toBeLessThan(blurred[0]-30);
  expect(blurred[2]).toBeLessThan(blurred[1]-30);
  expect(blurred[2]).toBeLessThan(20);
 }).toPass({timeout:7000});
 await page.addStyleTag({content:'.flute-bottom-blur i{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'});
 await expect.poll(async()=>(await contrast())[2]).toBeGreaterThan(150);
});

test('onboarding stays reachable on small screens and recovers a denied clipboard',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>{if(!(window as any).copiedPrompt){(window as any).copiedPrompt=text;throw new Error('Denied')}(window as any).copiedPrompt=text;}}}));
 await page.goto('/');
 await expect(page).toHaveTitle(FLUTE_BRAND.title);
 for(const size of [{width:1440,height:1000},{width:390,height:844},{width:667,height:320},{width:320,height:568}]){
  await page.setViewportSize(size);
  const summary=page.getByText('Connect your first scene',{exact:true});
  if(!await page.locator('.flute-onboarding').evaluate(e=>(e as HTMLDetailsElement).open))await summary.click();
  await page.getByRole('button',{name:'Copy starter prompt'}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'Copy starter prompt'})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(size.width);
 }
 await page.getByRole('button',{name:'Copy starter prompt'}).click();
 await expect(page.getByRole('status')).toContainText('Select and copy');
 await page.getByRole('button',{name:'Copy starter prompt'}).click();
 await expect(page.getByRole('button',{name:'Prompt copied'})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('Paste it');
 expect(await page.evaluate(()=>(window as any).copiedPrompt)).toContain('FLUTE.md');
 const creators=page.getByRole('link',{name:/Web Prodigies/});
 await expect(creators).toHaveCount(2);
 for(const creator of await creators.all()){
  await expect(creator).toHaveAttribute('href',FLUTE_BRAND.url);
  await expect(creator).toHaveAttribute('rel','noopener noreferrer');
  await expect(creator).toHaveAttribute('target','_blank');
 }
 await creators.last().focus();
 await expect(creators.last()).toBeFocused();
 await page.screenshot({path:'test-results/studio-onboarding-mobile.png'});
});

test('catalog retains native scroll, static thumbnails, centered endpoints and scene back navigation',async({page})=>{
 await page.goto('/tests/preview/fixture.html?mode=library');
 const scroller=page.getByRole('region',{name:'Scenes',exact:true});
 await expect(page.getByText('30 perspectives',{exact:true})).toBeVisible();
 await expect(page.getByTestId('host')).toHaveCount(0);
 await expect(page.locator('[data-scene-id="scene-01"] img')).toHaveAttribute('loading','lazy');
 await expect.poll(()=>page.locator('[data-scene-id="scene-01"] img').evaluate(e=>(e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 await expect(page.locator('[data-scene-id="scene-02"] img')).toHaveCount(0);
 await expect(page.locator('[data-scene-id="scene-02"]')).toContainText('02');
 await scroller.focus();
 // Native PageDown animates; wait for its scrollend before setting endpoint positions.
 await scroller.evaluate(e=>{(window as any).scrollFinished=new Promise(resolve=>e.addEventListener('scrollend',()=>resolve(true),{once:true}))});
 await page.keyboard.press('PageDown');
 await expect.poll(()=>scroller.evaluate(e=>e.scrollTop)).toBeGreaterThan(100);
 await page.evaluate(()=>(window as any).scrollFinished);
 for(const size of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(size);
  for(const [id,end] of [['scene-01',false],['scene-30',true]] as const){
   await scroller.evaluate((e,end)=>e.scrollTop=end?e.scrollHeight:0,end);
   await expect.poll(async()=>{const box=await page.locator('[data-scene-id="'+id+'"]').boundingBox();return box?Math.abs(box.y+box.height/2-size.height/2):999}).toBeLessThan(5);
  }
 }
 await page.locator('[data-scene-id="scene-30"]').focus();
 await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'Scene 30',exact:true})).toBeVisible();
 const attribution=page.getByRole('link',{name:/Web Prodigies/});
 await expect(attribution).toHaveAttribute('href',FLUTE_BRAND.url);
 expect(await page.locator('[data-flute-capture="scene"]').getByRole('link',{name:/Web Prodigies/}).count()).toBe(0);
 await page.locator('.flute-export summary').focus();await page.keyboard.press('Enter');
 const fps=page.getByRole('combobox',{name:'Export frame rate'});
 await expect(fps).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(page.locator('.flute-export summary')).toBeFocused();
 await page.screenshot({path:'test-results/studio-scene-mobile.png'});
 await page.getByRole('link',{name:'Back to scenes',exact:true}).click();
 await expect(scroller).toBeVisible();
 await expect(page.locator('[data-scene-id="scene-30"]')).toBeInViewport();
 await page.goBack();
 await expect(page.getByRole('heading',{name:'Scene 30',exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('slider',{name:'Scene time'})).toHaveValue('0');
 await page.goto('/tests/preview/fixture.html?mode=library&flute-scene=missing');
 await expect(page.getByRole('alert')).toContainText('cannot be opened');
 await page.getByRole('link',{name:'return to scenes'}).click();
 await expect(page.getByRole('alert')).toHaveCount(0);
});
