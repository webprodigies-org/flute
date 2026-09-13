import { describe, it, expect } from "vitest";
import { evaluateMotion, motionDuration, motionTime, cinematicProgress, cinematicTimeAtProgress, sampleFrameTime } from "../../src/core/motion";
import { createCascadeTracks } from "../../src/core/choreography";
describe('cinematic defaults',()=>{
 const input={durationMs:1000,tracks:[{target:{kind:'camera'},property:'x',keyframes:[{timeMs:0,value:0},{timeMs:1000,value:100}]}]};
 it('defaults to half speed for all consumers and the same host component clock',()=>{
  expect(motionDuration(input)).toBe(2000);expect(motionTime(input,500)).toBe(250);
  expect(evaluateMotion(input,500).camera.x).toBeCloseTo(10.3515625);
  expect(evaluateMotion(input,2000).camera.x).toBe(100);
 });
 it('has gentle starts/finishes and supports explicit speed/easing overrides',()=>{
  expect(cinematicProgress(.01)).toBeLessThan(.00001);
  expect(1-cinematicProgress(.99)).toBeLessThan(.00001);
  expect(evaluateMotion({...input,speed:1},500).camera.x).toBe(50);
  const linear={...input,speed:1,tracks:[{...input.tracks[0],keyframes:[{timeMs:0,value:0,easing:'linear'},{timeMs:1000,value:100}]}]};
  expect(evaluateMotion(linear,250).camera.x).toBe(25);
 });
 it('inverts the same curve to synchronize entrances to camera position',()=>{
  for(const progress of [0,.001,.1,.3,.5,.8,.999,1])expect(cinematicProgress(cinematicTimeAtProgress(progress))).toBeCloseTo(progress,10);
 });
 it('creates ordered, overlapping staircase depths that settle without crossing',()=>{
  const tracks=createCascadeTracks({items:[{id:'a'},{id:'b'},{id:'c'}]});
  const recipe={durationMs:3000,tracks,speed:1};
  expect(evaluateMotion(recipe,0).surfaces).toEqual({a:{z:80},b:{z:92},c:{z:104}});
  for(let time=0;time<=2160;time+=20){const s=evaluateMotion(recipe,time).surfaces;expect(s.a.z!).toBeLessThanOrEqual(s.b.z!);expect(s.b.z!).toBeLessThanOrEqual(s.c.z!)}
  expect(evaluateMotion(recipe,2160).surfaces).toEqual({a:{z:0},b:{z:0},c:{z:0}});
 });
 it('preview frame cadence does not alter timeline speed',()=>{
  expect(sampleFrameTime(50,'native')).toBe(50);
  expect(sampleFrameTime(50,30)).toBeCloseTo(1000/30);
  expect(sampleFrameTime(50,60)).toBe(50);
  expect(()=>sampleFrameTime(50,0)).toThrow();
  expect(evaluateMotion({...input,durationMs:Number.MAX_VALUE},1).issues.length).toBeGreaterThan(0);
 });
 it('offers an opt-out and rejects malformed recipes',()=>{
  const tracks=createCascadeTracks({items:[{id:'a'},{id:'b'}],cascade:false});
  expect(tracks[0].keyframes).toEqual(tracks[1].keyframes);
  expect(()=>createCascadeTracks({items:[{id:'a'},{id:'a'}]})).toThrow();
  expect(()=>createCascadeTracks({items:[{id:'a'}],depth:Infinity})).toThrow();
  expect(evaluateMotion({...input,speed:0},1).issues.length).toBeGreaterThan(0);
 });
});
