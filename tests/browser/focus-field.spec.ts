import {test,expect} from '@playwright/test';
test('live pixels are sharp at independent focus and progressively blurred across one plane',async({page})=>{
 await page.setViewportSize({width:800,height:400});
 await page.goto('/tests/fixtures/focus.html');
 await expect(page.locator('[data-flute-content]')).toHaveCSS('filter',/url/);
 // Sample rendered pixels, not the same blur math or a DOM style assertion.
 const shot=await page.screenshot();
 const contrasts=await page.evaluate(async data=>{
   const img=new Image();img.src=data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d')!;ctx.drawImage(img,0,0);
   return [400,480,570].map(x=>{const pixels=ctx.getImageData(x-8,190,16,20).data;const values=Array.from({length:pixels.length/4},(_,i)=>pixels[i*4]);return Math.max(...values)-Math.min(...values);});
 },'data:image/png;base64,'+shot.toString('base64'));
 expect(contrasts[0]).toBeGreaterThan(220);
 expect(contrasts[1]).toBeLessThan(contrasts[0]-50);
 expect(contrasts[1]).toBeGreaterThan(contrasts[2]+5);
 expect(contrasts[2]).toBeLessThan(10);
});

test('focus stays on screen while surface and camera move; focus can then travel independently',async({page})=>{
 await page.setViewportSize({width:800,height:400});await page.goto('/tests/fixtures/focus.html');
 const contrast=async(x:number)=>{const shot=await page.screenshot();return page.evaluate(async({data,x})=>{
 const img=new Image();img.src=data;await img.decode();const canvas=document.createElement('canvas');canvas.width=800;canvas.height=400;const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0);const pixels=ctx.getImageData(x-8,190,16,20).data;const values=Array.from({length:pixels.length/4},(_,i)=>pixels[i*4]);return Math.max(...values)-Math.min(...values);
 },{data:'data:image/png;base64,'+shot.toString('base64'),x});};
 await expect(page.locator('[data-flute-content]')).toHaveCSS('filter',/url/);
 await page.getByRole('button',{name:'Move surface'}).click();
 expect(await contrast(400)).toBeGreaterThan(220);expect(await contrast(570)).toBeLessThan(10);
 await page.getByRole('button',{name:'Pan camera'}).click();
 expect(await contrast(400)).toBeGreaterThan(220);
 await page.getByRole('button',{name:'Move focus'}).click();
 expect(await contrast(496)).toBeGreaterThan(220);expect(await contrast(400)).toBeLessThan(150);
 await page.getByRole('button',{name:'Tilt surface'}).click();
 const near=await contrast(470),far=await contrast(260);expect(near).toBeGreaterThan(far+40);
});
