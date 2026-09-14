import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const root=process.cwd(),host=resolve(root,'examples/agent-lab');
const npm=(args,cwd=root)=>execFileSync('npm',args,{cwd,stdio:'inherit'});
npm(['run','build:library']);npm(['run','build:cli']);
mkdirSync('dist/packages',{recursive:true});
npm(['pack','--pack-destination','dist/packages','--quiet']);
npm(['install','--legacy-peer-deps','--no-audit','--no-fund'],host);
// Reinstall the actual local tarball, including when its contents changed at the same version.
npm(['install','--legacy-peer-deps','--no-audit','--no-fund','../../dist/packages/flute-scene-0.1.0.tgz'],host);
execFileSync(process.execPath,[resolve(root,'dist/cli/flute.js'),'init','--project',host],{cwd:root,stdio:'inherit'});
