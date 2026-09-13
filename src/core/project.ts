import { z } from "zod";

/** SOURCE OF TRUTH: project command contracts.
 * WHAT: inputs and results exchanged by local project adapters and trusted commands.
 * WHY: adapters share runtime validation without importing filesystem or process code.
 * WHERE: RESOURCES binds input schemas; project/commands executes them; cli presents results.
 */
export const InitProjectSchema = z.strictObject({
  packageSource: z.string().min(1).optional(),
});
export const LoadProjectSchema = z.strictObject({});
export const ValidateProjectSchema = z.strictObject({});
export const OpenPreviewSchema = z.strictObject({
  url: z.url().superRefine((value, ctx) => {
    const url = new URL(value);
    if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
      ctx.addIssue({code:"custom",message:"Use an HTTP loopback dev-server origin, for example http://127.0.0.1:5173."});
  }),
  launch: z.boolean().default(true),
});
export const ProjectStateSchema = z.strictObject({
  version: z.literal(1),
  projectId: z.uuid(),
  entry: z.string().min(1),
  packageManager: z.literal("npm"),
});
export const ProjectResultSchema = z.discriminatedUnion("success", [
  z.strictObject({success:z.literal(true),data:z.strictObject({
    project:ProjectStateSchema.optional(),url:z.string().optional(),changed:z.boolean().optional(),
  })}),
  z.strictObject({success:z.literal(false),issues:z.array(z.strictObject({
    code:z.string(),message:z.string(),path:z.string().optional(),
  }))}),
]);
export type ProjectState = z.output<typeof ProjectStateSchema>;
export type ProjectResult = z.output<typeof ProjectResultSchema>;
