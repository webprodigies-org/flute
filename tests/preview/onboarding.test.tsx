// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {FLUTE_BRAND} from '../../src/core';
import {SceneLibrary,ScenePreview} from '../../src/preview';
afterEach(()=>{cleanup();vi.restoreAllMocks()});

it.each([SceneLibrary,ScenePreview])('shares installed instructions and recovers clipboard failure in each empty entry',async Component=>{
 const copy=vi.fn().mockRejectedValueOnce(new Error('Denied')).mockResolvedValue(undefined);
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:copy}});
 render(<Component/>);
 fireEvent.click(screen.getByText(Component===SceneLibrary?'Connect your first scene':'Get started',{exact:true}));
 const content=document.querySelector('.flute-onboarding-content')!;
 expect(content.textContent).toContain('npx flute init');
 expect(content.textContent).toContain('npx flute guide');
 expect(content.textContent).toContain('FLUTE.md');
 fireEvent.click(within(content as HTMLElement).getByRole('button',{name:'Copy starter prompt'}));
 await waitFor(()=>expect(within(content as HTMLElement).getByRole('status').textContent).toContain('Select and copy'));
 expect(content.querySelector('.flute-prompt')!.textContent).toBe(copy.mock.calls[0][0]);
 fireEvent.click(within(content as HTMLElement).getByRole('button',{name:'Copy starter prompt'}));
 await screen.findByRole('button',{name:'Prompt copied'});
 expect(copy.mock.calls[1][0]).toContain('existing components');
 const links=screen.getAllByRole('link',{name:/Web Prodigies/});
 for(const link of links){
  expect(link.getAttribute('href')).toBe(FLUTE_BRAND.url);
  expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  expect(link.getAttribute('target')).toBe('_blank');
 }
 expect(screen.getAllByText(FLUTE_BRAND.creator).every(node=>node.tagName==='A')).toBe(true);
});
