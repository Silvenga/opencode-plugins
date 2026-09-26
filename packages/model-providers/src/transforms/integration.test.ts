import { describe, expect, test } from "vitest";
import { makeIntegrationEditor } from "../_tests/fake-integration-editor.js";
import type { ProviderConfig } from "../config.js";
import { registerIntegration } from "./integration.js";

describe("registerIntegration", () => {
  test("When the integration does not exist then registerIntegration should create it with a key method", () => {
    const editor = makeIntegrationEditor();

    registerIntegration(editor, "my-provider", { name: "My Provider" });

    const integration = editor.integrations.get("my-provider");
    expect(integration).toBeDefined();
    expect(integration?.name).toBe("My Provider");
    expect(integration?.methods).toEqual([
      { integrationID: "my-provider", method: { type: "key", label: "Manually enter API Key" } },
    ]);
  });

  test("When the integration exists then registerIntegration should keep its methods and update the name", () => {
    const editor = makeIntegrationEditor([{ id: "my-provider", name: "Other Name" }]);
    const existing = editor.integrations.get("my-provider");
    if (existing == null) {
      throw new Error("fixture missing");
    }
    existing.methods.push({
      integrationID: "my-provider",
      method: { type: "oauth", id: "custom", label: "Custom OAuth" },
      authorize: undefined as never,
    });
    registerIntegration(editor, "my-provider", { name: "My Provider" });

    expect(editor.integrations.get("my-provider")?.name).toBe("My Provider");
    expect(editor.integrations.get("my-provider")?.methods).toHaveLength(1);
  });

  test("When the provider defines env then registerIntegration should also add an env method", () => {
    const editor = makeIntegrationEditor();

    registerIntegration(editor, "my-provider", { name: "My Provider", env: ["MY_API_KEY"] });

    expect(editor.integrations.get("my-provider")?.methods).toEqual([
      { integrationID: "my-provider", method: { type: "key", label: "Manually enter API Key" } },
      { integrationID: "my-provider", method: { type: "env", names: ["MY_API_KEY"] } },
    ]);
  });

  test("When the provider has no name then registerIntegration should use the provider id as the integration name", () => {
    const editor = makeIntegrationEditor();

    registerIntegration(editor, "my-provider", {});

    expect(editor.integrations.get("my-provider")?.name).toBe("my-provider");
  });

  test("When the integration exists and the provider has no name then registerIntegration should keep the existing name", () => {
    const editor = makeIntegrationEditor([{ id: "my-provider", name: "Existing Name" }]);

    registerIntegration(editor, "my-provider", {} satisfies ProviderConfig);

    expect(editor.integrations.get("my-provider")?.name).toBe("Existing Name");
  });
});
