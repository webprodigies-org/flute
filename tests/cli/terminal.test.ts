import { describe, it, expect, vi } from "vitest";
import { runCli } from "../../src/cli";
import { terminalWelcome, formatOnboarding, terminalText } from "../../src/cli/terminal";
import { FLUTE_BRAND } from "../../src/core/branding";
import type { ProjectResult } from "../../src/core/project";
const terminal = {interactive:true, colorDepth:24, columns:90, version:"9.8.7"};
const handoff = {path:"FLUTE.md" as const,guideCommand:"npx flute guide --json" as const,guideVersion:1,prompt:"Read FLUTE.md and animate <page route or component path>."};
const ready = (kind?:string, changed=true): Extract<ProjectResult,{success:true}> => ({success:true,data:{changed,handoff,
 project:{version:1,projectId:"00000000-0000-4000-8000-000000000000",entry:"src/main.tsx",packageManager:"npm"},
 ...(kind?{integration:{kind,component:"src/flute/ProjectPreview.jsx",...(kind==='react'?{}:{route:"/flute"}),instructions:"Canonical host instructions."}}:{})}});
const plain = (text:string) => text.replace(/\x1b\[[0-9;]*m/g, "");
describe("Amethyst terminal onboarding",()=>{
 it("uses the approved wordmark, real supplied version and canonical brand",()=>{
  const text=terminalWelcome(terminal);
  expect(text).toContain("\x1b[38;2;191;161;255m");
  for(const value of ["███████",FLUTE_BRAND.title,FLUTE_BRAND.url,"v9.8.7","cinematic 3D mockups"])expect(plain(text)).toContain(value);
 });
 it.each([0,4,8,24])("adapts ANSI to color depth %s",colorDepth=>{
  const text=terminalWelcome({...terminal,colorDepth});
  expect(text.includes("\x1b[")).toBe(colorDepth>0);
  expect(plain(text)).toContain("Flute by Web Prodigies");
 });
 it.each([{interactive:false},{columns:40},{unicode:false}])("uses compact type when large lettering is unsuitable: %j",overrides=>{
  const text=terminalWelcome({...terminal,...overrides});
  expect(text).not.toContain("█");expect(plain(text)).toContain("Flute");
 });
 it.each([[undefined,"React · Vite"],["next-app","Next.js · App Router"],["next-pages","Next.js · Pages Router"],["react","React · Custom renderer"]])("describes confirmed host %s",(kind,label)=>{
  const text=plain(formatOnboarding(ready(kind),terminal));
  expect(text).toContain(label);expect(text).toContain(handoff.prompt);
  if(kind==='react'){expect(text).toContain("One connection left");expect(text).not.toContain("Ready. Your first");}
  else expect(text).toContain("Ready. Your first");
  if(kind)expect(text).toContain("Canonical host instructions.");
  expect(text).not.toContain("localhost:3000");
 });
 it("reports retries accurately and only prints a URL returned by the operation",()=>{
  const result=ready('next-app',false);result.data.url="http://localhost:4321/flute?flute-preview=1";
  const text=plain(formatOnboarding(result,terminal));
  expect(text).toContain("Verified your existing connection");expect(text).not.toContain("Added your");expect(text).toContain(result.data.url);
 });
 it("fits narrow terminals and removes terminal commands from host text",()=>{
  const result=ready('react');result.data.integration!.instructions="\x1b[2JInjected \x1b]0;malicious\x07 title";
  const text=formatOnboarding(result,{...terminal,columns:32,colorDepth:0,unicode:false});
  // Wordmark/brand header is compact; body wraps paths, prompts and instructions.
  const body=text.slice(text.indexOf("+ Detected"));
  expect(body.split("\n").every(row=>row.length<=32)).toBe(true);
  expect(text).not.toContain("\x1b");expect(text).not.toContain("malicious");
  expect(terminalText("safe\x1b[2Jtext")).toBe("safetext");
 });
 it("emits pending feedback before setup resolves, then confirmed results with one banner",async()=>{
  const progress=vi.fn();const execute=vi.fn(async()=>{expect(progress).toHaveBeenCalledOnce();expect(progress.mock.calls[0][0]).not.toContain("✓");return ready('next-app')});
  const result=await runCli(['init'],{root:'/host',terminal,progress},execute);
  expect(plain(progress.mock.calls[0][0]+result.stdout).split(FLUTE_BRAND.title)).toHaveLength(2);
  expect(plain(result.stdout)).toContain('Detected Next.js');
 });
 it("never decorates JSON or calls human progress in machine mode",async()=>{
  const progress=vi.fn();const result=await runCli(['init','--json'],{root:'/host',terminal,progress},vi.fn().mockResolvedValue(ready('react')));
  expect(JSON.parse(result.stdout)).toEqual(ready('react'));expect(progress).not.toHaveBeenCalled();expect(result.stdout).not.toContain('\x1b');
 });
 it("never reports success or fabricates completed steps on setup failure",async()=>{
  const progress=vi.fn();const failure={success:false,issues:[{code:'conflict',message:'Preserve FLUTE.md and retry.'}]};
  const result=await runCli(['init'],{root:'/host',terminal,progress},vi.fn().mockResolvedValue(failure));
  expect(result.code).toBe(1);expect(result.stdout).toBe('');expect(result.stderr).toContain('Preserve FLUTE.md');
  expect(progress.mock.calls[0][0]).not.toContain('Ready.');
 });
 it("keeps successful setup and repair instructions when opening fails",async()=>{
  const execute=vi.fn().mockResolvedValueOnce(ready('next-app')).mockResolvedValueOnce({success:false,issues:[{code:'missing-dev-server',message:'Start your app and retry.'}]});
  const result=await runCli(['init','--url','http://localhost:4321'],{root:'/host',terminal},execute);
  expect(result.code).toBe(1);expect(plain(result.stdout)).toContain(handoff.prompt);expect(result.stderr).toContain('Start your app');
 });
 it("versions/help are side effect free and invalid options do not start setup",async()=>{
  const execute=vi.fn(),progress=vi.fn();const env={root:'/host',terminal,progress};
  expect((await runCli(['--version'],env,execute)).stdout).toBe('9.8.7\n');
  expect((await runCli(['--help'],env,execute)).stdout).toContain('███████');
  expect((await runCli(['init','--bad'],env,execute)).code).toBe(2);
  expect(execute).not.toHaveBeenCalled();expect(progress).not.toHaveBeenCalled();
 });
});
