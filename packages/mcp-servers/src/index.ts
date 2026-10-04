import { Plugin } from "@opencode/plugin";
import { ConfigResolverRpc } from "@slvnco-opencode/config-resolver/rpc";
import { McpServersRpc } from "./rpc/contract.js";
import { setup } from "./runtime.js";

export default Plugin.define({
  id: "slvn-opencode.mcp-servers",
  setup: (ctx) =>
    setup(
      {
        resolve: () => ctx.rpc(ConfigResolverRpc).getConfig({ name: "mcp-servers" }),
        transform: (callback) => ctx.mcp.transform(callback),
        register: (status) => ctx.rpc.register(McpServersRpc, { status: async () => status() }),
      },
      ctx.options,
    ),
});
