import {mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const destination=fileURLToPath(new URL('../.release/',import.meta.url));
await mkdir(destination,{recursive:true});
const result=spawnSync('npm',['pack','--pack-destination',destination],{cwd:root,stdio:'inherit'});
process.exitCode=result.status??1;
if(result.status===0) console.log(`Install the tarball from ${destination} into your app, then run npx flute init.`);
