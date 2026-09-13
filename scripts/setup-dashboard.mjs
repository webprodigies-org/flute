import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// Reproducible local consumer installation: pack the real library, install that
// artifact through npm, then ask the canonical CLI to integrate/validate the app.
const root=fileURLToPath(new URL('../',import.meta.url));
const host=path.join(root,'examples/dashboard-lab');
const npm=process.platform==='win32'?'npm.cmd':'npm';
function run(command,args,cwd=root){const result=spawnSync(command,args,{cwd,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1)}
run(npm,['run','build:library']);run(npm,['run','build:cli']);
mkdirSync(path.join(root,'dist/packages'),{recursive:true});
run(npm,['pack','--pack-destination','dist/packages','--silent']);
run(npm,['install','../../dist/packages/flute-scene-0.1.0.tgz','--ignore-scripts','--no-audit','--no-fund'],host);
for(const command of ['init','init','validate']) run(process.execPath,[path.join(root,'dist/cli/flute.js'),command,'--json'],host);
