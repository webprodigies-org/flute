import {it,expect} from 'vitest';
import {evaluateScene,sampleFocus,focusMask,FOCUS_BANDS,validateScene} from '../../src/core';
it('focuses camera depth, not a circular screen position',()=>{
 const nodes=evaluateScene({focus:{distance:1400},nodes:[{id:'left',transform:{x:-500}},{id:'right',transform:{x:500}},{id:'near',transform:{z:300}},{id:'far',transform:{z:-300}}]}).nodes;
 expect(nodes[0].blur).toBe(0);expect(nodes[1].blur).toBe(0);expect(nodes[2].blur).toBeGreaterThan(0);expect(nodes[3].blur).toBeGreaterThan(0);
});
it('changes focus across a tilted plane and as the camera turns',()=>{
 const input={focus:{distance:1400},nodes:[{id:'page',transform:{rotateY:35}}]};
 const field=evaluateScene(input).nodes[0].focus;
 expect(sampleFocus(field,0,0)).toBe(0);expect(sampleFocus(field,200,0)).toBeGreaterThan(0);
 const turned=evaluateScene({...input,camera:{rotateY:-35}}).nodes[0].focus;
 expect(sampleFocus(turned,200,0)).toBeCloseTo(0);
 const moved=evaluateScene({...input,camera:{z:200}}).nodes[0].focus;
 expect(sampleFocus(moved,0,0)).toBeGreaterThan(0);
});
it('uses aperture and focal distance with gentle canonical defaults',()=>{
 const input={nodes:[{id:'a',transform:{z:300}}]};
 const gentle=evaluateScene(input).nodes[0];
 const shallow=evaluateScene({...input,focus:{fStop:2}}).nodes[0];
 expect(gentle.blur).toBeLessThan(1);expect(shallow.blur).toBeCloseTo(gentle.blur*4);
 expect(evaluateScene({...input,focus:{distance:1100}}).nodes[0].blur).toBe(0);
});
it('normalizes masks across the full tilted depth span',()=>{
 const n=evaluateScene({nodes:[{id:'a',transform:{rotateY:40,rotateX:20}}]}).nodes[0];
 const masks=Array.from({length:FOCUS_BANDS+1},(_,i)=>focusMask(n.focus,600,300,i));
 for(let i=0;i<masks[0].stops.length;i++) expect(masks.reduce((s,m)=>s+m.stops[i],0)).toBeCloseTo(1,10);
 expect(masks[0].xWeight+masks[0].yWeight).toBeCloseTo(1);
});
it.each([{focus:{distance:0}},{focus:{distance:40,focalLength:50}},{focus:{fStop:0}},{focus:{radius:100}},{version:2},{camera:{z:NaN}}])('rejects invalid and obsolete focus contracts %j',input=>expect(validateScene({...input,nodes:[]}).success).toBe(false));
it('rejects degenerate accumulated scales',()=>expect(evaluateScene({nodes:[{id:'tiny',transform:{scale:1e-100}}]}).issues.length).toBeGreaterThan(0));
it('keeps operation identities canonical',async()=>{const c=await import('../../src/core');expect(c.RESOURCES['evaluate-spatial']).toBe(c.evaluateScene);expect(Object.isFrozen(c.RESOURCES)).toBe(true)});
