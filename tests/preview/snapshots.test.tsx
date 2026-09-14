// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {SceneLibrary} from '../../src/preview/SceneLibrary';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPdwAAAAASUVORK5CYII=';
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('uses inert cached images without mounting host scenes and recovers a failed image on replacement',()=>{
 vi.stubGlobal('ResizeObserver',function(){return {observe(){},disconnect(){}}});
 const Host=vi.fn(()=>null);
 const bindings={'src/flute/scenes/demo.tsx':Host};
 const sources=(snapshot?:{image:string;timeMs:number})=>({'src/flute/scenes/demo.scene.json':{version:1,id:'demo',title:'Actual scene',definition:{width:800,height:600,scene:{nodes:[]}},snapshot}});
 const view=render(<SceneLibrary sources={sources({image,timeMs:0})} bindings={bindings}/>);
 const link=screen.getByRole('link',{name:/Actual scene/});
 const img=link.querySelector('img')!;expect(img.getAttribute('src')).toBe(image);expect(Host).not.toHaveBeenCalled();
 fireEvent.error(img);expect(link.querySelector('img')).toBeNull();expect(link.textContent).toContain('01');
 view.rerender(<SceneLibrary sources={sources({image:image.replace('Pdw','Pdx'),timeMs:0})} bindings={bindings}/>);
 const replacement=link.querySelector('img')!;expect(replacement).not.toBe(img);expect(replacement.hidden).toBe(false);
 view.rerender(<SceneLibrary sources={sources()} bindings={bindings}/>);expect(link.querySelector('img')).toBeNull();expect(link.textContent).toContain('01');expect(Host).not.toHaveBeenCalled();
});
