// @vitest-environment jsdom
import { StrictMode, useState } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useSceneCapture } from '../../src/react/capture';
import type { CaptureBridge } from '../../src/core/export';
const host=window as typeof window & {__FLUTE_CAPTURE__?:CaptureBridge};
afterEach(cleanup);
function Fixture({durationMs=2000}:{durationMs?:number}) {
 const [time,setTime]=useState(0);
 useSceneCapture({durationMs,seek:setTime});
 return <output data-testid="time">{time}</output>;
}
it('commits exact capture time synchronously and cleans up in StrictMode',()=>{
 const view=render(<StrictMode><Fixture/></StrictMode>);
 expect(host.__FLUTE_CAPTURE__?.durationMs).toBe(2000);
 act(()=>{host.__FLUTE_CAPTURE__!.seek(750);expect(screen.getByTestId('time').textContent).toBe('750')});
 expect(()=>host.__FLUTE_CAPTURE__!.seek(2001)).toThrow('outside');
 expect(()=>host.__FLUTE_CAPTURE__!.seek(NaN)).toThrow('outside');
 view.unmount();expect(host.__FLUTE_CAPTURE__).toBeUndefined();
});
it('updates the manifest without losing host component state',()=>{
 const view=render(<Fixture/>);
 act(()=>host.__FLUTE_CAPTURE__!.seek(500));
 view.rerender(<Fixture durationMs={4000}/>);
 expect(host.__FLUTE_CAPTURE__?.durationMs).toBe(4000);
 expect(screen.getByTestId('time').textContent).toBe('500');
 act(()=>host.__FLUTE_CAPTURE__!.seek(3500));
 expect(screen.getByTestId('time').textContent).toBe('3500');
});

it('refuses capture when a scene reports unfiltered or invalid content',()=>{
 render(<><Fixture/><div data-flute-capture="scene"><div data-flute-valid="false"/></div></>);
 expect(()=>{act(()=>host.__FLUTE_CAPTURE__!.seek(500))}).toThrow('Correct scene diagnostics');
});
