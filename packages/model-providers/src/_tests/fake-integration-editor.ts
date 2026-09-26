import type { IntegrationMethodRegistration } from "@opencode/plugin/promise/integration";
import type { IntegrationEditor } from "../types.js";

export interface FakeIntegration {
  id: string;
  name: string;
  methods: IntegrationMethodRegistration[];
}

export interface FakeIntegrationEditor extends IntegrationEditor {
  readonly integrations: Map<string, FakeIntegration>;
}

export function makeIntegrationEditor(
  initial: ReadonlyArray<{ id: string; name?: string }> = [],
): FakeIntegrationEditor {
  const integrations = new Map<string, FakeIntegration>();
  for (const entry of initial) {
    integrations.set(entry.id, { id: entry.id, name: entry.name ?? entry.id, methods: [] });
  }
  const editor = {
    integrations,
    list() {
      return [...integrations.values()].map(({ id, name }) => ({ id, name }));
    },
    get(id: string) {
      const integration = integrations.get(id);
      return integration == null ? undefined : { id: integration.id, name: integration.name };
    },
    update(id: string, update: (integration: { id: string; name: string }) => void) {
      const integration = integrations.get(id);
      if (integration == null) {
        throw new Error(`no integration: ${id}`);
      }
      update(integration);
    },
    remove(id: string) {
      integrations.delete(id);
    },
    method: {
      list(integrationID: string) {
        return integrations.get(integrationID)?.methods ?? [];
      },
      update(input: IntegrationMethodRegistration) {
        let integration = integrations.get(input.integrationID);
        if (integration == null) {
          integration = { id: input.integrationID, name: input.integrationID, methods: [] };
          integrations.set(input.integrationID, integration);
        }
        integration.methods.push(input);
      },
      remove(integrationID: string, method: IntegrationMethodRegistration["method"]) {
        const integration = integrations.get(integrationID);
        if (integration == null) {
          return;
        }
        integration.methods = integration.methods.filter((entry) => entry.method !== method);
      },
    },
  };
  return editor as unknown as FakeIntegrationEditor;
}
