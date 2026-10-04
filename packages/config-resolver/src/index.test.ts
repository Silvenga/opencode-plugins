import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@opencode/plugin", () => ({ Plugin: { define: (plugin: unknown) => plugin } }));
vi.mock("./runtime.js", () => ({
  nodeFetcher: { fetch: vi.fn() },
  osHomedir: () => "/home/test",
  readProcessEnv: () => undefined,
}));

import { CACHE_KEY } from "./cache.js";
import plugin from "./index.js";
import type { makeHandlers } from "./rpc/handlers.js";
import { nodeFetcher } from "./runtime.js";

beforeEach(() => vi.mocked(nodeFetcher.fetch).mockReset());

async function setup(options: Record<string, unknown>, yaml: string, cached?: unknown) {
  vi.mocked(nodeFetcher.fetch).mockResolvedValue(yaml);
  const data = new Map<string, unknown>();
  if (cached !== undefined) {
    data.set(CACHE_KEY, cached);
  }
  const storage = {
    get: async (key: string) => data.get(key),
    set: vi.fn(async (key: string, value: unknown) => {
      data.set(key, value);
    }),
  };
  const register = vi.fn(
    async (_contract: unknown, _handlers: ReturnType<typeof makeHandlers>) => ({
      dispose: async () => {},
    }),
  );
  const context = { options, storage, rpc: { register } };

  await plugin.setup(context as unknown as Parameters<typeof plugin.setup>[0]);

  return { handlers: register.mock.calls[0][1], storage, data };
}

describe("var provider setup", () => {
  test("When vars appear in paths and config then setup should resolve and cache them", async () => {
    const options = {
      paths: ["$(var:ROOT)/config.yaml"],
      vars: { ROOT: "/configs", KEY: "value", LITERAL: "$(env:MISSING)" },
    };
    const yaml =
      "name: example\nconfig:\n  text: prefix $(var:KEY) suffix\n  literal: $(var:LITERAL)";

    const { handlers, data } = await setup(options, yaml);

    expect(nodeFetcher.fetch).toHaveBeenCalledWith(
      { kind: "local", path: "/configs/config.yaml" },
      expect.any(AbortSignal),
    );
    await expect(handlers.status()).resolves.toEqual({ state: "fresh" });
    await expect(handlers.getConfig({ name: "example" })).resolves.toEqual({
      config: { text: "prefix value suffix", literal: "$(env:MISSING)" },
    });
    expect(data.get(CACHE_KEY)).toEqual([
      ["example", { text: "prefix value suffix", literal: "$(env:MISSING)" }],
    ]);
  });

  test.each([false, true])(
    "When a var is missing and cache availability is %s then setup should discard the fresh load and use the fallback state",
    async (hasCache) => {
      const cached = hasCache ? [["example", { text: "cached" }]] : undefined;
      const yaml = "name: partial\nconfig: valid\n---\nname: example\nconfig: $(var:MISSING)";

      const { handlers, storage, data } = await setup({ paths: ["/config.yaml"] }, yaml, cached);

      await expect(handlers.status()).resolves.toEqual({
        state: hasCache ? "cache" : "failed",
        error: "configured variable is not set: MISSING",
      });
      await expect(handlers.getConfig({ name: "example" })).resolves.toEqual({
        config: hasCache ? { text: "cached" } : {},
      });
      await expect(handlers.getConfig({ name: "partial" })).resolves.toEqual({ config: {} });
      expect(storage.set).not.toHaveBeenCalled();
      expect(data.get(CACHE_KEY)).toEqual(cached);
    },
  );
});
