import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
mkdirSync(path.join(root,'.local-package'),{recursive:true});
function run(args,cwd=root){const result=spawnSync('npm',args,{cwd,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1)}
run(['pack','--pack-destination','.local-package']);
run(['install','--offline','--force','--ignore-scripts','--no-audit','--no-fund','../.local-package/flute-scene-0.1.0.tgz'],path.join(root,'local-project'));
const init=spawnSync(process.execPath,[path.join(root,'dist/cli/flute.js'),'init','--project',path.join(root,'local-project')],{cwd:root,stdio:'inherit'});
if(init.status!==0)process.exit(init.status??1);
