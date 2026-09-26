import type { ProviderConfig } from "../config.js";
import type { IntegrationEditor } from "../types.js";

export function registerIntegration(
  editor: IntegrationEditor,
  id: string,
  providerConfig: ProviderConfig,
): void {
  const { name, env } = providerConfig;
  if (editor.get(id) == null) {
    editor.method.update({
      integrationID: id,
      method: { type: "key", label: "Manually enter API Key" },
    });
  }
  if (name != null) {
    editor.update(id, (integration) => {
      integration.name = name;
    });
  }
  if (env != null) {
    editor.method.update({
      integrationID: id,
      method: { type: "env", names: [...env] },
    });
  }
}
