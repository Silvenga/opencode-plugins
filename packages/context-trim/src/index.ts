import { Plugin } from "@opencode/plugin";
import { ContextPatcher } from "./context-patcher.js";
import { parseOptions } from "./parse-options.js";
import { Runtime } from "./runtime.js";
import { skill } from "./skill.js";
import { DirectiveStore } from "./store/directive-store.js";
import { SessionCleanup } from "./store/session-cleanup.js";
import { forgetTool } from "./tools/forget.js";
import { restoreTool } from "./tools/restore.js";

export default Plugin.define({
  id: "slvn-opencode.context-trim",
  async setup(ctx) {
    const options = parseOptions(ctx.options);
    const runtime = Runtime.fromContext(ctx);
    const store = new DirectiveStore(runtime.storage);
    const patcher = new ContextPatcher(store);
    const cleanup = new SessionCleanup(store, runtime.events);

    const toolRegistration = await ctx.tool
      .transform((editor) => {
        editor.namespace({
          name: "context",
          description: "Context hygiene: trim spent tool call content and restore originals",
        });
        editor.add(
          forgetTool({
            store,
            readView: runtime.readView,
            minTokens: options.minTokens,
          }),
        );
        editor.add(restoreTool({ readView: runtime.readView }));
      })
      .catch(() => undefined);

    const skillRegistration = await ctx.skill
      .transform((editor) => editor.add(skill()))
      .catch(() => undefined);

    const hookRegistration = await ctx.session
      .hook("context", (event) => patcher.patch(event.sessionID, event.messages))
      .catch(() => undefined);

    const controller = new AbortController();
    cleanup.start(controller.signal);

    return () => {
      controller.abort();
      toolRegistration?.dispose().catch(() => undefined);
      skillRegistration?.dispose().catch(() => undefined);
      hookRegistration?.dispose().catch(() => undefined);
    };
  },
});
