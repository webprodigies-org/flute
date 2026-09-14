import {test,expect} from '@playwright/test';
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
 const blurred=await contrast();
 expect(blurred[0]).toBeGreaterThan(240);
 expect(blurred[1]).toBeLessThan(blurred[0]-30);
 expect(blurred[2]).toBeLessThan(blurred[1]-30);
 expect(blurred[2]).toBeLessThan(20);
 await page.addStyleTag({content:'.flute-bottom-blur i{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'});
 const tintOnly=await contrast();
 expect(tintOnly[2]).toBeGreaterThan(150);
});
