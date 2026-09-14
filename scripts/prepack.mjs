import {spawnSync} from 'node:child_process';
// npm pack --json owns stdout; build diagnostics must not corrupt its manifest.
const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{stdio:['inherit',2,2]});
process.exitCode=result.status??1;
