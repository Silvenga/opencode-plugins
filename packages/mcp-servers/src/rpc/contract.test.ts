import { expect, test } from "vitest";
import { McpServersRpc, statusSchema } from "./contract.js";

test("When the RPC contract is inspected then it should expose only status under the plugin ID", () => {
  expect(McpServersRpc.id).toBe("slvn-opencode.mcp-servers");
  expect(Object.keys(McpServersRpc.methods)).toEqual(["status"]);
  expect(McpServersRpc.events).toEqual({});
  expect(statusSchema.safeParse({ state: "ready", resolver: "available" }).success).toBe(true);
  expect(statusSchema.safeParse({ state: "connected", resolver: "available" }).success).toBe(false);
});
