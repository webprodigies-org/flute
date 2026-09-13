import {it,expect} from 'vitest';
import {evaluateScene,sampleFocus,focusMask,FOCUS_BANDS,cameraToCss,validateScene} from '../../src/core';
it('varies blur continuously within one tilted live plane and symmetrically across focus depth',()=>{
 const node=evaluateScene({focus:{radius:20,falloff:180,maxBlur:12},nodes:[{id:'a',transform:{rotateX:25,rotateY:35}}]}).nodes[0];
 expect(sampleFocus(node.focus,0,0)).toBe(0);
 expect(sampleFocus(node.focus,100,0)).toBeGreaterThan(0);
 expect(sampleFocus(node.focus,200,0)).toBe(12);
 const front=evaluateScene({focus:{radius:0},nodes:[{id:'a',transform:{z:80}}]}).nodes[0];
 const back=evaluateScene({focus:{radius:0},nodes:[{id:'a',transform:{z:-80}}]}).nodes[0];
 expect(front.blur).toBe(back.blur);
});
it('keeps focus independent of surface identity and fixed under camera movement',()=>{
 const scene={focus:{x:50,y:20,z:0,radius:0,falloff:100},nodes:[{id:'a',transform:{x:50,y:20}}]};
 expect(evaluateScene(scene).nodes[0].blur).toBe(0);
 const moved=evaluateScene({...scene,camera:{x:100}}).nodes[0];
 expect(moved.blur).toBe(10);
 expect(sampleFocus(moved.focus,100,0)).toBe(0);
 expect(cameraToCss({x:100})).toContain('translate3d(-100px, 0px, 0px)');
});
it('constructs complementary radial masks with normalized weights',()=>{
 const n=evaluateScene({nodes:[{id:'a'}]}).nodes[0];
 const weights=Array.from({length:FOCUS_BANDS+1},(_,i)=>[...decodeURIComponent(focusMask(n.focus,600,300,i)).matchAll(/stop-opacity="([^"]+)"/g)].map(x=>Number(x[1])));
 for(let i=0;i<65;i++)expect(weights.reduce((sum,row)=>sum+row[i],0)).toBeCloseTo(1,10);
});
it.each([{focus:{x:Infinity}},{focus:{radius:-1}},{focus:{falloff:0}},{camera:{z:NaN}},{focus:{targetId:'old'}}])('rejects invalid or obsolete spatial configuration',input=>{
 expect(validateScene({...input,nodes:[]}).success).toBe(false);
});
it('rejects degenerate accumulated scales before emitting unusable masks',()=>{
 const result=evaluateScene({nodes:[{id:'tiny',transform:{scale:1e-100}}]});
 expect(result.nodes).toEqual([]);expect(result.issues[0].message).toContain('numeric limits');
});
