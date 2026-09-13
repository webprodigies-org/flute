import { describe, it, expect } from "vitest";
import { uniformFocusBlur, sampleFocus, type FocusField } from "../../src/core";
const base: FocusField = {x:0,y:0,perpendicular:0,scale:1,radius:100,falloff:100,maxBlur:8};
describe('uniform focus bounds',()=>{
 it('keeps a gradient when the center is sharp but edges are not',()=>expect(uniformFocusBlur(base,300,100)).toBeUndefined());
 it('skips filtering only when the full leaf is sharp',()=>expect(uniformFocusBlur(base,40,40)).toBe(0));
 it('uses one Gaussian beyond the field including perpendicular distance',()=>expect(uniformFocusBlur({...base,perpendicular:220,scale:2},40,40)).toBe(4));
 it('does not discard a gradient just outside the visual bounds',()=>expect(uniformFocusBlur({...base,x:225},20,20)).toBeUndefined());
 it('agrees with the canonical law throughout rectangles across scale and depth',()=>{
  for(const scale of [.5,1,2]) for(const x of [-400,-120,0,120,400]) for(const perpendicular of [0,80,250]){
   const f={...base,scale,x,perpendicular};const uniform=uniformFocusBlur(f,80,50);
   if(uniform!==undefined) for(const px of [-40,0,40]) for(const py of [-25,0,25]) expect(sampleFocus(f,px,py)/scale).toBeCloseTo(uniform);
  }
 });
});
