import { ConfigResolverRpc } from "@slvnco-opencode/config-resolver/rpc";
import { describe, expect, test } from "vitest";
import { ModelProvidersRpc, type Status } from "./contract.js";
import { makeHandlers } from "./handlers.js";

describe("ModelProvidersRpc contract", () => {
  test("When the contract is defined then it should expose status under the plugin id", () => {
    expect(ModelProvidersRpc.id).toBe("slvn-opencode.model-providers");
    expect(Object.keys(ModelProvidersRpc.methods).sort()).toEqual(["status"]);
    expect(ModelProvidersRpc.events).toEqual({});
  });

  test("When status input is validated then any object should pass", async () => {
    const input = ModelProvidersRpc.methods.status?.input;
    expect(input).toBeDefined();
    const result = await input?.["~standard"]?.validate({});
    expect(result).toEqual({ value: {} });
  });

  test("When the resolver contract is imported then it should be distinct from this contract", () => {
    expect(ConfigResolverRpc.id).toBe("slvn-opencode.config-resolver");
  });
});

describe("makeHandlers", () => {
  test("When status is ready then the handler should omit the error field", async () => {
    const handlers = makeHandlers({ status: { state: "ready", resolver: "available" } });
    await expect(handlers.status({})).resolves.toEqual({ state: "ready", resolver: "available" });
  });

  test("When status is failed then the handler should include the error", async () => {
    const status: Status = {
      state: "failed",
      resolver: "unknown",
      error: { stage: "central", message: "invalid configuration: providers.p.name: invalid_type" },
    };
    const handlers = makeHandlers({ status });
    await expect(handlers.status({})).resolves.toEqual(status);
  });
});
