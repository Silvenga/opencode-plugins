import { resolveReferences } from "@slvnco-opencode/config-resolver/cli";
import { expect, test, vi } from "vitest";
import { makeReferenceProviders, makeRuntime } from "./runtime.js";

test("When var references are scanned then CLI providers should preserve them without consulting the environment", async () => {
  const readEnv = vi.fn(() => "environment value");
  const providers = makeReferenceProviders(makeRuntime({ readEnv }));
  const input = "prefix $(var:KEY) and $(var:key:with:colons) suffix";

  const resolved = await resolveReferences(input, providers, undefined);

  expect(resolved).toBe(input);
  expect(readEnv).not.toHaveBeenCalled();
});
