import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { SUPPORTED_EXPORT_FPS } from '../dist/library/index.js';
import { mkdir } from 'node:fs/promises';
// Local sample artifact command. The installed scene and public export operation
// own rendering; this helper only starts an isolated production preview and CLI.
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));
const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:'examples/dashboard-lab',stdio:'ignore'});
try {
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 await mkdir('examples/dashboard-lab/public/exports',{recursive:true});
 for(const fps of (process.argv.slice(2).length?process.argv.slice(2):['60']).map(Number)) {
  if(!SUPPORTED_EXPORT_FPS.includes(fps))throw Error('Use 30, 60 or 120 FPS');
  console.log(`Rendering dashboard at ${fps} FPS...`);
  const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['dist/cli/flute.js','export','--url',`http://127.0.0.1:${port}/?scene=sidebar`,'--output',`examples/dashboard-lab/public/exports/sidebar-${fps}.mp4`,'--fps',String(fps),'--json'],{stdio:'inherit'});child.once('error',reject);child.once('exit',resolve)});
  if(code!==0)throw Error(`Export failed: ${code}`);
 }
} finally {server.kill()}
