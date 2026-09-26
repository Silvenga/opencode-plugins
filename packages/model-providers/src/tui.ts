import { Plugin } from "@opencode/plugin/tui";
import { ModelProvidersRpc } from "./rpc/contract.js";

export default Plugin.define({
  id: "slvn-opencode.model-providers-tui",
  async setup(context) {
    const client = context.client.rpc(ModelProvidersRpc);
    const status = await client.status({}).catch(() => undefined);
    if (status?.state === "failed") {
      context.ui.toast.show({
        message: `@slvnco-opencode/model-providers failed to apply config${status.error === undefined ? "" : `: ${status.error.stage}: ${status.error.message}`}`,
        variant: "error",
      });
    }
  },
});
