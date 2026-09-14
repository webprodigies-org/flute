import {it,expect} from 'vitest';
import {uniformFocusBlur,sampleFocus,focusForSurface,matrixFor,TransformSchema,FocusSchema} from '../../src/core';
it('keeps all flat-plane points equally focused or defocused',()=>{
 const f=focusForSurface(matrixFor(TransformSchema.parse({z:200})),FocusSchema.parse({}));
 expect(uniformFocusBlur(f,300,100)).toBe(sampleFocus(f,0,0));
});
it('retains gradients across tilted planes and recognizes fully capped fields',()=>{
 const f=focusForSurface(matrixFor(TransformSchema.parse({rotateY:40})),FocusSchema.parse({}));
 expect(uniformFocusBlur(f,300,100)).toBeUndefined();
 expect(uniformFocusBlur({...f,depth:100000},300,100)).toBeCloseTo(6);
});
it('agrees with the canonical law when taking the uniform fast path',()=>{
 for(const scale of [.5,1,2])for(const z of [-5000,-100,0,100,1200])for(const rotateY of [0,30]){
 const f=focusForSurface(matrixFor(TransformSchema.parse({scale,z,rotateY})),FocusSchema.parse({}));
 const value=uniformFocusBlur(f,80,50);
 if(value!==undefined)for(const x of [-40,0,40])for(const y of [-25,0,25])expect(sampleFocus(f,x,y)/scale).toBeCloseTo(value);
 }
});
