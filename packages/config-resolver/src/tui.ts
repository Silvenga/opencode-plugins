import { Plugin } from "@opencode/plugin/tui";
import { ConfigResolverRpc } from "./rpc/contract.js";

export default Plugin.define({
  id: "slvn-opencode.config-resolver-tui",
  async setup(context) {
    const resolver = context.client.rpc(ConfigResolverRpc);
    const status = await resolver.status({}).catch(() => undefined);
    if (status?.state === "failed") {
      context.ui.toast.show({
        message: `@slvnco-opencode/config-resolver failed to load configs${status.error === undefined ? "" : `: ${status.error}`}`,
        variant: "error",
      });
    }
  },
});
