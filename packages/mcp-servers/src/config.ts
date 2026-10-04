import { z } from "zod";

const timeout = z.strictObject({
  startup: z.number().int().positive().optional(),
  catalog: z.number().int().positive().optional(),
  execution: z.number().int().positive().optional(),
});
const common = {
  disabled: z.boolean().optional(),
  codemode: z.boolean().optional(),
  timeout: timeout.optional(),
  protocol: z.enum(["legacy", "auto", "2026-07-28"]).optional(),
};
const oauth = z.strictObject({
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  scope: z.string().optional(),
  callback_port: z.number().int().min(1).max(65535).optional(),
  redirect_uri: z.string().optional(),
  auth_server_metadata_url: z.string().optional(),
});
export const serverSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("local"),
    command: z.tuple([z.string().min(1)]).rest(z.string()),
    cwd: z.string().optional(),
    environment: z.record(z.string(), z.string()).optional(),
    ...common,
  }),
  z.strictObject({
    type: z.literal("remote"),
    url: z.url({ protocol: /^https?$/ }),
    headers: z.record(z.string(), z.string()).optional(),
    oauth: z.union([oauth, z.literal(false)]).optional(),
    ...common,
  }),
]);
export const pluginConfigSchema = z
  .strictObject({
    servers: z.record(z.string().min(1), serverSchema).optional(),
  })
  .nullish()
  .transform((config) => ({ servers: config?.servers ?? {} }));

export type ServerConfig = z.output<typeof serverSchema>;
