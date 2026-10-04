import { Plugin } from "@opencode/plugin";
import { loadConfigs } from "./load.js";
import { parseOptions } from "./options.js";
import { makeEnvProvider } from "./references/providers/env.js";
import { makeFileProvider } from "./references/providers/file.js";
import { makeVarProvider } from "./references/providers/var.js";
import { ConfigResolverRpc } from "./rpc/contract.js";
import { makeHandlers } from "./rpc/handlers.js";
import { nodeFetcher, osHomedir, readProcessEnv } from "./runtime.js";

export default Plugin.define({
  id: "slvn-opencode.config-resolver",
  async setup(ctx) {
    const { paths, timeoutMs, vars } = parseOptions(ctx.options);
    const fetcher = nodeFetcher;
    const providers = {
      env: makeEnvProvider(readProcessEnv),
      file: makeFileProvider(fetcher, timeoutMs, osHomedir),
      var: makeVarProvider(vars),
    };
    const state = await loadConfigs(
      paths,
      { timeoutMs, homedir: osHomedir },
      { storage: ctx.storage, fetcher, providers },
    );
    const registration = await ctx.rpc.register(ConfigResolverRpc, makeHandlers(state));
    return () => {
      void registration.dispose();
    };
  },
});
