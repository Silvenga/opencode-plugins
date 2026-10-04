import { describe, expect, test } from "vitest";
import type { Status } from "./rpc/contract.js";
import { setup, type Editor, type Runtime } from "./runtime.js";

const remote = { type: "remote", url: "https://example.com" };
function fixture(overrides: Partial<Runtime> = {}) {
  const records = new Map<string, unknown>([["untouched", remote]]);
  let apply: ((editor: Editor) => void) | undefined;
  let status: (() => Status) | undefined;
  let registrations = 0;
  const runtime: Runtime = {
    resolve: async () => ({
      config: { servers: { shared: { ...remote, headers: { Secret: "secret" } } } },
    }),
    transform: async (callback) => {
      apply = callback;
      callback({ set: (name, config) => records.set(name, config) });
    },
    register: async (read) => {
      registrations++;
      status = read;
      return { dispose: async () => {} };
    },
    ...overrides,
  };
  return {
    runtime,
    records,
    replay: (editor: Editor) => apply?.(editor),
    status: () => status?.(),
    registrations: () => registrations,
  };
}

describe("setup", () => {
  test("When both sources define a server then local should replace it and preserve unrelated servers", async () => {
    const f = fixture();
    await setup(f.runtime, { servers: { shared: { ...remote, disabled: true } } });
    expect(f.records.get("shared")).toEqual({ ...remote, disabled: true });
    expect(f.records.has("untouched")).toBe(true);
    expect(f.status()).toEqual({ state: "ready", resolver: "available" });
  });

  test.each([
    { type: "rpc.unavailable", message: "RPC is unavailable: slvn-opencode.config-resolver" },
    Object.assign(new Error("RPC is unavailable: slvn-opencode.config-resolver"), {
      type: "rpc.unavailable",
    }),
  ])(
    "When the resolver returns unavailable failure %j then local configuration should apply",
    async (error) => {
      const f = fixture({
        resolve: async () => {
          throw error;
        },
      });
      await setup(f.runtime, { servers: { local: remote } });
      expect(f.records.get("local")).toEqual(remote);
      expect(f.status()).toEqual({ state: "ready", resolver: "unavailable" });
    },
  );

  test.each([
    new Error("Unexpected failure mentioning rpc.unavailable"),
    Object.assign(new Error("Unexpected failure mentioning rpc.unavailable"), {
      type: "rpc.internal",
    }),
  ])(
    "When another resolver failure mentions unavailability %j then local configuration should not apply",
    async (error) => {
      const f = fixture({
        resolve: async () => {
          throw error;
        },
      });
      await setup(f.runtime, { servers: { local: remote } });
      expect(f.records.has("local")).toBe(false);
      expect(f.status()).toMatchObject({
        state: "failed",
        resolver: "unknown",
        error: { stage: "resolver" },
      });
      expect(JSON.stringify(f.status())).not.toContain("rpc.unavailable");
    },
  );

  test.each([
    { response: {}, options: {}, stage: "resolver", resolver: "unknown" },
    {
      response: { config: { servers: { bad: { disabled: true } } } },
      options: {},
      stage: "central",
      resolver: "available",
    },
    {
      response: { config: { servers: { central: remote } } },
      options: { servers: { bad: false } },
      stage: "local",
      resolver: "available",
    },
  ])(
    "When preparation fails at $stage then no definitions should apply",
    async ({ response, options, stage, resolver }) => {
      const f = fixture({ resolve: async () => response });
      await setup(f.runtime, options);
      expect(f.records.size).toBe(1);
      expect(f.status()).toMatchObject({ state: "failed", resolver, error: { stage } });
    },
  );

  test("When the resolver throws a secret then status should not expose it", async () => {
    const f = fixture({
      resolve: async () => {
        throw new Error("secret");
      },
    });
    await setup(f.runtime, {});
    expect(f.status()).toMatchObject({ state: "failed", error: { stage: "resolver" } });
    expect(JSON.stringify(f.status())).not.toContain("secret");
  });

  test("When registration is pending then status should remain unavailable", async () => {
    let finish!: () => void;
    const f = fixture({
      transform: async () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    });
    const pending = setup(f.runtime, {});
    await Promise.resolve();
    await Promise.resolve();
    expect(f.registrations()).toBe(0);
    finish();
    await pending;
    expect(f.status()?.state).toBe("ready");
  });

  test("When transform registration fails then setup should report application failure", async () => {
    const f = fixture({
      transform: async () => {
        throw new Error("secret");
      },
    });
    await setup(f.runtime, {});
    expect(f.status()).toMatchObject({ state: "failed", error: { stage: "application" } });
    expect(JSON.stringify(f.status())).not.toContain("secret");
  });

  test("When replay mutates an input and throws then later replay should retain the original configuration and failed status", async () => {
    const f = fixture();
    await setup(f.runtime, {});
    f.replay({
      set: (_name, config) => {
        if (config.type === "remote" && config.headers !== undefined) {
          config.headers.Secret = "changed";
        }
        throw new Error("secret");
      },
    });
    const values: unknown[] = [];
    f.replay({ set: (_name, config) => values.push(config) });
    expect(values).toEqual([{ ...remote, headers: { Secret: "secret" } }]);
    expect(f.status()).toMatchObject({ state: "failed", error: { stage: "application" } });
    expect(JSON.stringify(f.status())).not.toContain("secret");
  });

  test("When status registration fails then configuration should still apply", async () => {
    const f = fixture({
      register: async () => {
        throw new Error("unavailable");
      },
    });
    const cleanup = await setup(f.runtime, {});
    expect(f.records.has("shared")).toBe(true);
    await expect(cleanup()).resolves.toBeUndefined();
  });

  test("When cleanup fails then cleanup should not reject", async () => {
    const f = fixture({
      register: async () => ({
        dispose: async () => {
          throw new Error("failed");
        },
      }),
    });
    const cleanup = await setup(f.runtime, {});
    await expect(cleanup()).resolves.toBeUndefined();
  });
});
