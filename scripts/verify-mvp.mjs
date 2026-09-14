import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
// Reuse the existing gate's exact leaf checks. Only scheduling changes: independent
// temporary hosts may run together, but hardware frame budgets run alone.
function leaves(name){
 if(!name.startsWith('verify:'))return [name];
 return manifest.scripts[name].split(' && ').flatMap(command=>{
   const match=/^npm run ([\w:-]+)$/.exec(command);
   if(!match)throw Error(`Unsupported gate command: ${command}`);
   return leaves(match[1]);
 });
}
const pending=new Set([...leaves('verify:reuse'),'test:agent']);
await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
async function run(name,prebuilt=false){
 const result=await new Promise(resolve=>{
  const child=spawn('npm',['run',name],{cwd:root,env:{...process.env,...(prebuilt?{FLUTE_VERIFY_PREBUILT:'1'}:{})},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',value=>output+=value);child.stderr.on('data',value=>output+=value);
  child.on('error',error=>resolve({code:1,output:output+error.message}));child.on('close',code=>resolve({code,output}));
 });
 await writeFile(new URL(`../test-results/gate-${name.replaceAll(':','-')}.log`,import.meta.url),result.output);
 if(result.code!==0)throw Error(`${name} failed:\n${result.output.slice(-7000)}`);
 console.log(`${name}: passed`);pending.delete(name);
}
try{
 // This tests prepack as well as the same canonical build used by verify:reuse.
 await run('release:local');pending.delete('build');
 const exclusive=['test:browser','test:performance','test:library'];
 const installed=['test:installed','test:iterate','test:agent'];
 const independent=[...pending].filter(name=>!exclusive.includes(name)&&!installed.includes(name));
 const checkGroup=async names=>{const results=await Promise.allSettled(names.map(name=>run(name,true)));const failures=results.filter(result=>result.status==='rejected');if(failures.length)throw new AggregateError(failures.map(result=>result.reason),'Verification failed');};
 await checkGroup(independent);
 for(const name of exclusive)if(pending.has(name))await run(name,true);
 await checkGroup(installed.filter(name=>pending.has(name)));
 if(pending.size)throw Error(`Unrun checks: ${[...pending]}`);
 console.log('Complete MVP gate passed. Full logs: test-results/gate-*.log');
}catch(error){console.error(error);process.exitCode=1;}
