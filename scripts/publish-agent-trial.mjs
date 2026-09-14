import {execFileSync} from 'node:child_process';
import {cp,rm,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
// Publish only generated trial assets into the existing managed preview. The
// independent host keeps its own installed package, aliases and component tree.
const root=fileURLToPath(new URL('../',import.meta.url));
const host=path.join(root,'examples/agent-lab');
const destination=path.join(root,'examples/dashboard-lab/public/agent-trial');
execFileSync('npm',['run','build','--','--base','/agent-trial/'],{cwd:host,stdio:'inherit'});
await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});
await cp(path.join(host,'dist'),destination,{recursive:true});
console.log('Published /agent-trial/ through the dashboard preview.');
