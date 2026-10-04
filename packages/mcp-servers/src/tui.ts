import { Plugin } from "@opencode/plugin/tui";
import { McpServersRpc } from "./rpc/contract.js";

export default Plugin.define({
  id: "slvn-opencode.mcp-servers-tui",
  async setup(context) {
    try {
      const status = await context.client.rpc(McpServersRpc).status({});
      if (status.state === "failed") {
        context.ui.toast.show({
          message: `@slvnco-opencode/mcp-servers failed to apply config${status.error === undefined ? "" : `: ${status.error.stage}: ${status.error.message}`}`,
          variant: "error",
        });
      }
    } catch {
      // An unavailable status RPC or notification surface must not block the TUI.
    }
  },
});
