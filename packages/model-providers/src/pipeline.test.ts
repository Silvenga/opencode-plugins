import { describe, expect, test } from "vitest";
import { makeEditor } from "./_tests/fake-editor.js";
import { makeIntegrationEditor } from "./_tests/fake-integration-editor.js";
import type { PluginConfig } from "./config.js";
import { preparePipeline, type RemoteConfigResolver } from "./pipeline.js";

const remoteConfigResolver: RemoteConfigResolver = () =>
  Promise.resolve({ config: { providers: { central: { name: "Central" } } } });

const localConfig: PluginConfig = { providers: { local: { name: "Local" } } };

describe("preparePipeline acquisition and validation", () => {
  test("When the resolver answers then preparePipeline should return a ready pipeline", async () => {
    const { status } = await preparePipeline(remoteConfigResolver, localConfig);
    expect(status).toEqual({ state: "ready", resolver: "available" });
  });

  test("When the plan is ready then Pipeline.transform should apply both configs in order", async () => {
    const editor = makeEditor();
    const { pipeline } = await preparePipeline(remoteConfigResolver, localConfig);
    pipeline.transform(editor);
    expect(editor.get("central")?.provider).toMatchObject({ name: "Central" });
    expect(editor.get("local")?.provider).toMatchObject({ name: "Local" });
  });

  test("When the resolver is unavailable then the plan skips central and local still applies", async () => {
    const editor = makeEditor();
    const unavailable = Object.assign(new Error("no server"), { type: "rpc.unavailable" });
    const { pipeline, status } = await preparePipeline(
      () => Promise.reject(unavailable),
      localConfig,
    );
    expect(status).toEqual({ state: "ready", resolver: "unavailable" });
    pipeline.transform(editor);
    expect(editor.get("central")).toBeUndefined();
    expect(editor.get("local")?.provider).toMatchObject({ name: "Local" });
  });

  test("When the resolver fails differently then the plan fails with resolver unknown", async () => {
    const editor = makeEditor();
    const { pipeline, status } = await preparePipeline(
      () => Promise.reject(new Error("connection reset")),
      localConfig,
    );
    expect(status).toEqual({
      state: "failed",
      resolver: "unknown",
      error: { stage: "resolver", message: "connection reset" },
    });
    pipeline.transform(editor);
    expect(editor.get("local")).toBeUndefined();
  });

  test("When the resolver returns an incompatible shape then the plan fails with stage central", async () => {
    const { pipeline, status } = await preparePipeline(
      () => Promise.resolve({ config: { providers: "not-a-map" } }),
      localConfig,
    );
    expect(status.state).toBe("failed");
    expect(status.resolver).toBe("available");
    expect(status.error).toMatchObject({ stage: "central" });
    expect(pipeline.configs).toEqual([]);
  });

  test("When local config is invalid then the plan fails with stage local and applies nothing", async () => {
    const editor = makeEditor();
    const { pipeline, status } = await preparePipeline(remoteConfigResolver, {
      providers: { bad: { env: "not-an-array" } },
    });
    expect(status.state).toBe("failed");
    expect(status.error).toMatchObject({ stage: "local" });
    pipeline.transform(editor);
    expect(editor.get("central")).toBeUndefined();
    expect(editor.get("local")).toBeUndefined();
  });

  test("When central config is invalid then the plan fails with stage central and local does not apply", async () => {
    const editor = makeEditor();
    const { pipeline, status } = await preparePipeline(
      () => Promise.resolve({ config: { providers: { bad: { name: 42 } } } }),
      localConfig,
    );
    expect(status.state).toBe("failed");
    pipeline.transform(editor);
    expect(editor.get("local")).toBeUndefined();
  });

  test("When both configs are valid and empty then the plan is ready with no error", async () => {
    const { status } = await preparePipeline(() => Promise.resolve({ config: {} }), {
      providers: {},
    });
    expect(status).toEqual({ state: "ready", resolver: "available" });
    expect(status.error).toBeUndefined();
  });

  test("When local config is undefined then the plan should apply only central config", async () => {
    const editor = makeEditor();
    const { pipeline } = await preparePipeline(remoteConfigResolver, undefined);
    pipeline.transform(editor);
    expect(editor.get("central")?.provider).toMatchObject({ name: "Central" });
  });
});

describe("preparePipeline error sanitization", () => {
  test("When validation fails then the error message names the path without echoing raw config", async () => {
    const { status } = await preparePipeline(
      () => Promise.resolve({ config: { providers: { leak: { headers: "nope" } } } }),
      localConfig,
    );
    expect(status.error?.message).toContain("providers.leak");
    expect(status.error?.message).not.toContain("nope");
  });

  test("When the resolver error carries a message then it should be reported without config values", async () => {
    const { status } = await preparePipeline(
      () =>
        Promise.reject(Object.assign(new Error("secret-key-xyz failed"), { type: "rpc.internal" })),
      localConfig,
    );
    expect(status.error?.stage).toBe("resolver");
    expect(status.error?.message).toContain("secret-key-xyz");
  });
});

describe("Pipeline.transform application failure", () => {
  test("When the editor throws during application then Pipeline.transform should rethrow for status capture", async () => {
    const editor = makeEditor();
    editor.add = () => {
      throw new Error("editor exploded");
    };
    const { pipeline } = await preparePipeline(
      () => Promise.resolve({ config: { providers: { boom: {} } } }),
      { providers: {} },
    );
    expect(() => pipeline.transform(editor)).toThrow("editor exploded");
  });

  test("When a failed plan is applied then Pipeline.transform should mutate nothing", async () => {
    const editor = makeEditor();
    const { pipeline } = await preparePipeline(
      () => Promise.resolve({ config: { providers: { bad: { name: 42 } } } }),
      localConfig,
    );
    pipeline.transform(editor);
    expect(editor.list()).toEqual([]);
  });
});

describe("Pipeline capture", () => {
  test("When local config is invalid and the resolver is unavailable then preparation should return an empty pipeline with failed status", async () => {
    const editor = makeEditor();
    const unavailable = Object.assign(new Error("no server"), { type: "rpc.unavailable" });

    const { pipeline, status } = await preparePipeline(() => Promise.reject(unavailable), {
      providers: "invalid",
    });
    pipeline.transform(editor);

    expect(status).toMatchObject({
      state: "failed",
      resolver: "unavailable",
      error: { stage: "local" },
    });
    expect(pipeline.configs).toEqual([]);
    expect(editor.list()).toEqual([]);
  });

  test("When the same pipeline is transformed twice then transformation should be idempotent", async () => {
    const editor = makeEditor();
    const { pipeline } = await preparePipeline(remoteConfigResolver, localConfig);
    pipeline.transform(editor);
    const first = editor.get("central")?.provider;
    pipeline.transform(editor);
    expect(editor.get("central")?.provider).toBe(first);
  });
});

describe("Pipeline.registerIntegrations", () => {
  test("When no config suppresses then registerIntegrations should register every provider", async () => {
    const integrationEditor = makeIntegrationEditor();
    const { pipeline } = await preparePipeline(remoteConfigResolver, localConfig);

    pipeline.registerIntegrations(integrationEditor);

    expect(integrationEditor.integrations.get("central")).toMatchObject({
      id: "central",
      name: "Central",
    });
    expect(integrationEditor.integrations.get("local")).toMatchObject({
      id: "local",
      name: "Local",
    });
  });

  test("When the last config suppresses then registerIntegrations should register nothing", async () => {
    const integrationEditor = makeIntegrationEditor();
    const { pipeline } = await preparePipeline(remoteConfigResolver, {
      providers: { local: { name: "Local" } },
      suppressRegisteringIntegrations: true,
    });

    pipeline.registerIntegrations(integrationEditor);

    expect(integrationEditor.integrations.size).toBe(0);
  });

  test("When only an earlier config suppresses then the last specified value wins", async () => {
    const integrationEditor = makeIntegrationEditor();
    const { pipeline } = await preparePipeline(
      () =>
        Promise.resolve({
          config: {
            providers: { central: { name: "Central" } },
            suppressRegisteringIntegrations: true,
          },
        }),
      { providers: { local: { name: "Local" } }, suppressRegisteringIntegrations: false },
    );

    pipeline.registerIntegrations(integrationEditor);

    expect(integrationEditor.integrations.get("central")).toBeDefined();
    expect(integrationEditor.integrations.get("local")).toBeDefined();
  });

  test("When a config leaves the flag unspecified then it should not override an earlier one", async () => {
    const integrationEditor = makeIntegrationEditor();
    const { pipeline } = await preparePipeline(
      () =>
        Promise.resolve({
          config: {
            providers: { central: { name: "Central" } },
            suppressRegisteringIntegrations: true,
          },
        }),
      { providers: { local: { name: "Local" } } },
    );

    pipeline.registerIntegrations(integrationEditor);

    expect(integrationEditor.integrations.size).toBe(0);
  });

  test("When the plan failed then registerIntegrations should register nothing", async () => {
    const integrationEditor = makeIntegrationEditor();
    const { pipeline } = await preparePipeline(
      () => Promise.resolve({ config: { providers: { bad: { name: 42 } } } }),
      localConfig,
    );

    pipeline.registerIntegrations(integrationEditor);

    expect(integrationEditor.integrations.size).toBe(0);
  });

  test("When the resolver is unavailable then registerIntegrations should register local providers only", async () => {
    const integrationEditor = makeIntegrationEditor();
    const unavailable = Object.assign(new Error("no server"), { type: "rpc.unavailable" });
    const { pipeline } = await preparePipeline(() => Promise.reject(unavailable), localConfig);

    pipeline.registerIntegrations(integrationEditor);

    expect(integrationEditor.integrations.size).toBe(1);
    expect(integrationEditor.integrations.get("local")).toBeDefined();
  });
});
