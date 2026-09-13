import { describe, it, expect, vi } from "vitest";
vi.mock("../../src/project/commands", () => ({executeProjectCommand: vi.fn()}));
import { runCli } from "../../src/cli";
import type { ProjectResult } from "../../src/core";
const ready: ProjectResult = {success:true,data:{project:{version:1,projectId:"00000000-0000-4000-8000-000000000000",entry:"src/main.tsx",packageManager:"npm"}}};
const context = {root:"/project"};
describe("CLI adapter", () => {
  it("has side-effect-free help", async () => {
    const execute = vi.fn();
    expect((await runCli(["--help"], context, execute)).stdout).toContain("flute init");
    expect(execute).not.toHaveBeenCalled();
  });
  it.each([["wat"],["init","--wat"],["init","--project"],["init","--url","--json"],["init","--json","--json"],["validate","--package","x"],["load","--url","x"]])("rejects malformed args %j before executing", async (...args) => {
    const execute=vi.fn();
    expect((await runCli(args,context,execute)).code).toBe(2);
    expect(execute).not.toHaveBeenCalled();
  });
  it("initializes then opens through the same command boundary", async () => {
    const execute=vi.fn().mockResolvedValueOnce(ready).mockResolvedValueOnce({success:true,data:{url:"http://127.0.0.1:6199/?flute-preview=1"}});
    const r=await runCli(["init","--project","/host","--package","/tmp/pkg.tgz","--url","http://127.0.0.1:6199","--no-open","--json"],context,execute);
    expect(execute.mock.calls).toEqual([
      ["init-project",{packageSource:"/tmp/pkg.tgz"},{root:"/host"}],
      ["open-preview",{url:"http://127.0.0.1:6199",launch:false},{root:"/host"}],
    ]);
    expect(r.code).toBe(0);expect(JSON.parse(r.stdout).data.url).toContain("flute-preview");
  });
  it("does not open after failed init", async () => {
    const execute=vi.fn().mockResolvedValue({success:false,issues:[{code:"unsupported",message:"Use a Vite React project."}]});
    const r=await runCli(["init","--url","http://127.0.0.1:1234"],context,execute);
    expect(execute).toHaveBeenCalledTimes(1);expect(r.code).toBe(1);expect(r.stderr).toContain("Use a Vite");
  });
  it("uses configured port and passes validation to trusted operation", async () => {
    const execute=vi.fn().mockResolvedValue(ready);
    await runCli(["open","--no-open"],{...context,port:"62123"},execute);
    expect(execute).toHaveBeenCalledWith("open-preview",{url:"http://127.0.0.1:62123",launch:false},context);
  });
  it("loads without starting a preview", async () => {
    const execute=vi.fn().mockResolvedValue(ready);
    expect((await runCli(["load"],context,execute)).code).toBe(0);
    expect(execute).toHaveBeenCalledWith("load-project",{},context);
  });
  it("reports an unexpected failure without dumping credentials", async () => {
    const execute=vi.fn().mockRejectedValue(new Error("secret value"));
    const r=await runCli(["init"],context,execute);
    expect(r.code).toBe(1);expect(r.stderr).not.toContain("secret value");
  });
});

describe("video CLI", () => {
  it("routes video options to the trusted exporter", async () => {
    const execute = vi.fn();
    const exporter = vi.fn().mockResolvedValue({success:true,data:{output:"clip.mp4",fps:120,frames:12,durationMs:100}});
    const result = await runCli(["export","--url","http://localhost:1234/scene?capture=1","--output","clip.mp4","--fps","120","--width","640","--height","480","--json"],context,execute,exporter);
    expect(exporter).toHaveBeenCalledWith({url:"http://localhost:1234/scene?capture=1",output:"clip.mp4",fps:120,width:640,height:480},context);
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.parse(result.stdout).data.fps).toBe(120);
  });
  it("reports canonical export failures and rejects incomplete arguments", async () => {
    const exporter = vi.fn().mockResolvedValue({success:false,issues:[{code:"missing-ffmpeg",message:"Install FFmpeg."}]});
    expect((await runCli(["export","--url","http://localhost","--output","clip.mp4"],context,vi.fn(),exporter)).stderr).toContain("Install FFmpeg");
    exporter.mockClear();
    expect((await runCli(["export","--url","http://localhost"],context,vi.fn(),exporter)).code).toBe(2);
    expect(exporter).not.toHaveBeenCalled();
  });
});
