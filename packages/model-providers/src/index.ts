import { Plugin } from "@opencode/plugin";
import { ConfigResolverRpc } from "@slvnco-opencode/config-resolver/rpc";
import { preparePipeline } from "./pipeline.js";
import { ModelProvidersRpc, type Status } from "./rpc/contract.js";
import { makeHandlers } from "./rpc/handlers.js";

export default Plugin.define({
  id: "slvn-opencode.model-providers",
  async setup(ctx) {
    const state: { status: Status } = { status: { state: "ready", resolver: "unknown" } };
    const registration = await ctx.rpc
      .register(ModelProvidersRpc, makeHandlers(state))
      .catch(() => undefined);
    const resolver = ctx.rpc(ConfigResolverRpc);
    const remoteConfigResolver = async () => resolver.getConfig({ name: "model-providers" });
    const { pipeline, status } = await preparePipeline(remoteConfigResolver, ctx.options);
    state.status = status;
    await ctx.integration.transform((editor) => {
      try {
        pipeline.registerIntegrations(editor);
      } catch (error) {
        state.status = {
          state: "failed",
          resolver: status.resolver,
          error: {
            stage: "application",
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
    });
    await ctx.provider.transform((editor) => {
      try {
        pipeline.transform(editor);
      } catch (error) {
        state.status = {
          state: "failed",
          resolver: status.resolver,
          error: {
            stage: "application",
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
    });
    return () => {
      void registration?.dispose();
    };
  },
});
