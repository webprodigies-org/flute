import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
// One managed process group owns the product and explicitly separate local host.
const children=[];
function start(args){const child=spawn(process.execPath,args,{stdio:'inherit',env:process.env});children.push(child);return child}
start(['node_modules/vite/bin/vite.js',...process.argv.slice(2)]);
if(existsSync('local-project/node_modules/@webprodigies/flute/package.json')){
 const port=process.env.API_PORT??'5174';
 start(['local-project/node_modules/vite/bin/vite.js','--config','local-project/vite.config.ts','local-project','--force','--host','127.0.0.1','--port',port,'--strictPort']);
 console.log(`Installed local project: http://127.0.0.1:${port}/?flute-preview=1`);
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{for(const child of children)child.kill(signal)});
