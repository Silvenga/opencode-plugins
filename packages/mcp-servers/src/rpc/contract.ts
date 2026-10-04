import { Rpc } from "@opencode/plugin/rpc";
import { z } from "zod";

export const statusSchema = z.object({
  state: z.enum(["ready", "failed"]),
  resolver: z.enum(["available", "unavailable", "unknown"]),
  error: z
    .object({
      stage: z.enum(["resolver", "central", "local", "application"]),
      message: z.string(),
    })
    .optional(),
});
export type Status = z.output<typeof statusSchema>;
export const McpServersRpc = Rpc.define({
  id: "slvn-opencode.mcp-servers",
  methods: { status: { input: z.object({}), output: statusSchema } },
  events: {},
});
