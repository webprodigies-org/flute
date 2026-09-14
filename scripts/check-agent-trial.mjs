import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
// Exercise the published trial through the real dashboard dev host, including
// its static index path, without occupying the operator's managed preview port.
const root=fileURLToPath(new URL('../',import.meta.url));
const dashboard=path.join(root,'examples/dashboard-lab');
const trial=path.join(root,'examples/agent-lab');
const reserve=createServer();await new Promise((r,j)=>reserve.listen(0,'127.0.0.1',r).once('error',j));
const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:dashboard,stdio:'ignore'});
try {
 const url=`http://127.0.0.1:${port}/agent-trial/index.html`;
 let ready=false;
 for(let attempt=0;attempt<100;attempt++) {
  if(server.exitCode!==null)throw Error('Trial host exited before readiness');
  try{const response=await fetch(url,{signal:AbortSignal.timeout(500)});if(response.ok&&(await response.text()).includes('/agent-trial/assets/')){ready=true;break}}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 if(!ready)throw Error('Published trial was not served by the dashboard host');
 const code=await new Promise((resolve,reject)=>{
  const check=spawn(process.execPath,['checks/scenes.mjs'],{cwd:trial,env:{...process.env,TRIAL_URL:url,TRIAL_PERFORMANCE:'1'},stdio:'inherit'});
  check.once('error',reject);check.once('exit',resolve);
 });
 if(code!==0)throw Error('Integrated trial browser check failed');
} finally {server.kill('SIGTERM')}
