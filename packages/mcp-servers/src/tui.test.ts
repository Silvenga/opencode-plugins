import { expect, test, vi } from "vitest";

vi.mock("@opencode/plugin/tui", () => ({ Plugin: { define: (plugin: unknown) => plugin } }));
import plugin from "./tui.js";

test.each(["ready", "failed", "unreachable"])(
  "When status is %s then TUI notification should match the failure state",
  async (state) => {
    const show = vi.fn();
    const context = {
      client: {
        rpc: () => ({
          status: async () => {
            if (state === "unreachable") {
              throw new Error("unavailable");
            }
            return {
              state,
              resolver: "available",
              ...(state === "failed"
                ? { error: { stage: "local", message: "Invalid configuration" } }
                : {}),
            };
          },
        }),
      },
      ui: { toast: { show } },
    };
    await plugin.setup(context as unknown as Parameters<typeof plugin.setup>[0]);
    expect(show).toHaveBeenCalledTimes(state === "failed" ? 1 : 0);
    if (state === "failed") {
      expect(show).toHaveBeenCalledWith({
        variant: "error",
        message: expect.stringContaining("local: Invalid configuration"),
      });
    }
  },
);
