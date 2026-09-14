import { describe,expect,it,vi } from 'vitest';
import { getAuthoringGuide, reviewAuthoring, AuthoringGuideSchema, AuthoringReviewSchema } from '../../src/core/authoring';
import { CameraSchema, FocusSchema, SCENE_BACKGROUND } from '../../src/core/scene';
import { MotionSchema } from '../../src/core/motion';
import { RESOURCES } from '../../src/core/resources';
import {runCli} from '../../src/cli';
const scene={nodes:[{id:'subject'}]};
const motion={durationMs:2000,tracks:[{target:{kind:'surface',id:'subject'},property:'z',keyframes:[{timeMs:0,value:80},{timeMs:2000,value:0}]}]};
describe('canonical authoring system',()=>{
 it('derives capabilities and defaults from the installed contracts',()=>{
  const guide=getAuthoringGuide();expect(guide.stageBackdrop).toBe(SCENE_BACKGROUND);expect(AuthoringGuideSchema.safeParse(guide).success).toBe(true);
  expect(guide.capabilities.camera).toEqual(CameraSchema.parse({}));expect(guide.capabilities.focus).toEqual(FocusSchema.parse({}));
  expect(guide.capabilities.motionDefaults).toEqual(MotionSchema.parse({durationMs:0,tracks:[]}));
  expect(RESOURCES['authoring-guide']).toBe(getAuthoringGuide);expect(RESOURCES['review-authoring']).toBe(reviewAuthoring);
  const tracks=guide.capabilities.tracks as {properties:string[]}[];tracks[0].properties.push('invented');expect(JSON.stringify(getAuthoringGuide().capabilities.tracks)).not.toContain('invented');
  guide.concepts[0].meaning='modified';expect(getAuthoringGuide().concepts[0].meaning).not.toBe('modified');
 });
 it('CLI and package return the same guide without project or export effects',async()=>{
  const executor=vi.fn(),exporter=vi.fn();const result=await runCli(['guide','--json'],{root:'/does-not-exist'},executor,exporter);
  expect(result.code).toBe(0);expect(JSON.parse(result.stdout)).toEqual(getAuthoringGuide());
  const human=await runCli(['guide'],{root:'/does-not-exist'},executor,exporter);
  for(const concept of getAuthoringGuide().concepts)expect(human.stdout).toContain(concept.mechanism);
  expect(executor).not.toHaveBeenCalled();expect(exporter).not.toHaveBeenCalled();
 });
 it.each([['guide','--json','--json'],['guide','--project','/x'],['guide','anything']])('rejects malformed guide args %j',async(...args)=>{expect((await runCli(args,{root:'/x'})).code).toBe(2)});
 it('makes the guide discoverable at help and successful installation',async()=>{
  expect((await runCli([],{root:'/x'})).stdout).toContain('flute guide');
  const execute=vi.fn().mockResolvedValue({success:true,data:{project:{version:1,projectId:'00000000-0000-4000-8000-000000000000',entry:'src/main.tsx',packageManager:'npm'}}});
  expect((await runCli(['init'],{root:'/x'},execute)).stdout).toContain('npx flute guide');
 });
 it('validates technical structure and targets without demanding a particular shot',()=>{
  const valid=reviewAuthoring({scene,motion});expect(valid.valid).toBe(true);expect(valid.requiresVisualReview).toBe(true);
  expect(AuthoringReviewSchema.safeParse(valid).success).toBe(true);
  expect(reviewAuthoring({scene:{nodes:[]},motion}).issues[0].code).toBe('unknown-surface');
  expect(reviewAuthoring({scene,motion:{...motion,speed:0}}).valid).toBe(false);
  expect(reviewAuthoring({scene:{nodes:[{id:'subject'},{id:'subject'}]},motion}).valid).toBe(false);
 });
 it('keeps deliberate spins, linear motion and static scenes valid with advice',()=>{
  const spin=reviewAuthoring({scene,motion:{durationMs:2000,tracks:[{target:{kind:'camera'},property:'rotateY',keyframes:[{timeMs:0,value:0,easing:'linear'},{timeMs:2000,value:360}]}]}});
  expect(spin.valid).toBe(true);expect(spin.advice.map(a=>a.code)).toEqual(['rotation-sweep','linear-motion']);
  const still=reviewAuthoring({scene,motion:{durationMs:2000,tracks:[]}});expect(still.valid).toBe(true);expect(still.advice[0].code).toBe('static-scene');
 });
 it('uses the capture contract for export-duration advice without rejecting live scenes',()=>{
  const result=reviewAuthoring({scene,motion:{durationMs:70000,tracks:[]}});expect(result.valid).toBe(true);expect(result.advice.some(a=>a.code==='export-duration')).toBe(true);
 });
 it('advises on object-only movement without banning intentional choreography',()=>{
  const objectOnly=reviewAuthoring({scene,motion});
  expect(objectOnly.valid).toBe(true);
  expect(objectOnly.advice.some(a=>a.code==='camera-travel-missing')).toBe(true);
  const camera={target:{kind:'camera'},property:'y',keyframes:[{timeMs:0,value:0},{timeMs:2000,value:120}]};
  const tracked=reviewAuthoring({scene,motion:{...motion,tracks:[...motion.tracks,camera]}});
  expect(tracked.advice.some(a=>a.code==='camera-travel-missing')).toBe(false);
  const stationary={...camera,keyframes:[{timeMs:0,value:0},{timeMs:2000,value:0}]};
  expect(reviewAuthoring({scene,motion:{...motion,tracks:[...motion.tracks,stationary]}}).advice.some(a=>a.code==='camera-travel-missing')).toBe(true);
 });
});
