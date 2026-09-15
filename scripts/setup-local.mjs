import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
mkdirSync(path.join(root,'.local-package'),{recursive:true});
function run(args,cwd=root,stdio='inherit'){const result=spawnSync('npm',args,{cwd,stdio,encoding:'utf8'});if(result.status!==0)process.exit(result.status??1);return result.stdout}
const packed=JSON.parse(run(['pack','--json','--pack-destination','.local-package'],root,['ignore','pipe','inherit']));
run(['install','--force','--ignore-scripts','--no-audit','--no-fund',path.join(root,'.local-package',packed[0].filename)],path.join(root,'local-project'));
const init=spawnSync(process.execPath,[path.join(root,'dist/cli/flute.js'),'init','--project',path.join(root,'local-project')],{cwd:root,stdio:'inherit'});
if(init.status!==0)process.exit(init.status??1);
