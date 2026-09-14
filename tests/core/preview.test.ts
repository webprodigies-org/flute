import {expect,it} from 'vitest';
import {presentPreview,RESOURCES} from '../../src/core';
it('shares canonical revision validation',()=>{
 expect(RESOURCES['present-preview']).toBe(presentPreview);
 const result=presentPreview({scene:{nodes:[{id:'host'}]}});
 expect(result.valid).toBe(true);
 if(result.valid)expect(result.definition.width).toBe(1400);
});
it.each([
 {scene:{nodes:[{id:'a'},{id:'a'}]}},
 {scene:{nodes:[],focus:{distance:10}}},
 {scene:{nodes:[]},width:0},
 {scene:{nodes:[]},motion:{durationMs:100,tracks:[{target:{kind:'surface',id:'missing'},property:'x',keyframes:[{timeMs:0,value:20}]}]}},
])('rejects invalid source revision %j',input=>expect(presentPreview(input).valid).toBe(false));
