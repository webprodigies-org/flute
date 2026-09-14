import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { executeVideoExport } from "../../src/export/commands";

let server: Server;
let root: string;
let url: string;
let requests = 0;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "flute-video-test-"));
  server = createServer((req, res) => {
    requests++;
    res.setHeader("content-type", "text/html");
    res.end(`<style>body{margin:0}#scene{width:127px;height:95px;background:black}#box{width:32px;height:32px;background:red}</style><div id="scene" data-flute-capture="scene"><div id="box"></div></div><div data-flute-preview-chrome style="position:fixed;inset:0;background:lime;z-index:999"></div><script>${req.url === "/missing" ? "" : `window.__FLUTE_CAPTURE__={version:${req.url === "/wrong" ? 2 : 1},durationMs:${req.url === "/cancel" ? 120000 : 100},selector:'[data-flute-capture="scene"]',seek(t){${req.url === '/throw' ? 'if(t>0)throw new Error("fixture failure");' : ''}document.getElementById('box').style.background=t<40?'red':'blue';document.getElementById('box').style.transform='translateX('+t+'px)'}}`}</script>`);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await rm(root, {recursive:true,force:true}); });
const run = (input: object) => executeVideoExport({url,output:"clip.mp4",width:128,height:96,...input},{root});
describe("live MP4 export", () => {
  it.each([30,120])("encodes real changing scene frames at %i FPS", async fps => {
    const output = `clip-${fps}.mp4`;
    const result = await run({fps,output});
    expect(result).toEqual({success:true,data:{output,fps,frames:fps/10,durationMs:100}});
    const filename = path.join(root,output);
    const probe = JSON.parse(execFileSync("ffprobe",["-v","error","-show_streams","-of","json",filename],{encoding:"utf8"})).streams[0];
    expect(probe.codec_name).toBe("h264"); expect(probe.pix_fmt).toBe("yuv420p");
    expect(probe.width).toBe(128); expect(probe.height).toBe(96);
    expect(probe.r_frame_rate).toBe(`${fps}/1`); expect(Number(probe.nb_frames)).toBe(fps/10);
    expect(Number(probe.duration)).toBeCloseTo(.1,3);
    const raw = execFileSync("ffmpeg",["-v","error","-i",filename,"-f","rawvideo","-pix_fmt","rgb24","pipe:1"]);
    const frameSize = 128*96*3;
    // The real frame remains red, not the opaque green product overlay above it.
    const pixel=(10*128+10)*3;expect(raw[pixel]).toBeGreaterThan(200);expect(raw[pixel+1]).toBeLessThan(40);
    expect(raw.subarray(0,frameSize).equals(raw.subarray(raw.length-frameSize))).toBe(false);
    expect((await readdir(root)).some(name=>name.startsWith('.flute-export-'))).toBe(false);
  },30_000);
  it("rejects invalid URLs, rates, dimensions and escaped/protected paths before capture", async () => {
    const count=requests;
    for (const input of [{url:"https://example.com"},{url:"http://user:pass@localhost"},{fps:24},{width:127},{output:"../escape.mp4"},{output:".git/clip.mp4"},{output:"/tmp/clip.mp4"}]) expect((await run(input)).success).toBe(false);
    expect(requests).toBe(count);
  });
  it("rejects symlinks and refuses to overwrite existing bytes", async () => {
    await writeFile(path.join(root,"existing.mp4"),"keep");
    expect(await run({output:"existing.mp4"})).toMatchObject({success:false,issues:[{code:"output-exists"}]});
    expect(await readFile(path.join(root,"existing.mp4"),"utf8")).toBe("keep");
    await symlink(tmpdir(),path.join(root,"linked"));
    expect(await run({output:"linked/escape.mp4"})).toMatchObject({success:false,issues:[{code:"denied-path"}]});
  });
  it.each(["missing","wrong"])("rejects a %s bridge and cleans up", async route => {
    expect(await run({url:`${url}/${route}`})).toMatchObject({success:false,issues:[{code:route==="missing"?"missing-capture":"invalid-capture"}]});
    expect(await readdir(root)).not.toContain("clip.mp4");
    expect((await readdir(root)).some(name=>name.startsWith('.flute-export-'))).toBe(false);
  },15_000);
  it("cleans partial encoding after the scene seek fails", async () => {
    expect((await run({url:`${url}/throw`,output:"throw.mp4"})).success).toBe(false);
    expect(await readdir(root)).not.toContain("throw.mp4");
    expect((await readdir(root)).some(name=>name.startsWith('.flute-export-'))).toBe(false);
  },15_000);
  it("reports missing FFmpeg and removes its temporary output", async () => {
    const previousPath = process.env.PATH;
    try {
      process.env.PATH = root;
      expect(await run({output:"missing-encoder.mp4"})).toMatchObject({success:false,issues:[{code:"missing-ffmpeg"}]});
    } finally { process.env.PATH = previousPath; }
    expect(await readdir(root)).not.toContain("missing-encoder.mp4");
    expect((await readdir(root)).some(name=>name.startsWith('.flute-export-'))).toBe(false);
  },15_000);
  it("cancels active encoding and removes temporary files", async () => {
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),1500);
    try {
      expect(await executeVideoExport({url:`${url}/cancel`,output:"interrupted.mp4",width:128,height:96},{root,signal:controller.signal})).toMatchObject({success:false,issues:[{code:"export-cancelled"}]});
    } finally { clearTimeout(timer); }
    expect(await readdir(root)).not.toContain("interrupted.mp4");
    expect((await readdir(root)).some(name=>name.startsWith('.flute-export-'))).toBe(false);
  },15_000);
  it("cancels before browser effects", async () => {
    const controller=new AbortController(); controller.abort();
    expect(await executeVideoExport({url,output:"cancel.mp4"},{root,signal:controller.signal})).toMatchObject({success:false,issues:[{code:"export-cancelled"}]});
    expect(await readdir(root)).not.toContain("cancel.mp4");
  });
});
