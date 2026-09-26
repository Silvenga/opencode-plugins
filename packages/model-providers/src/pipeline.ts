import { pluginConfigSchema, type PluginConfig } from "./config.js";
import type { Status } from "./rpc/contract.js";
import { registerIntegration } from "./transforms/integration.js";
import { transformConfig } from "./transforms/transform.js";
import type { IntegrationEditor, ProviderEditor } from "./types.js";

export type RemoteConfigResolver = () => Promise<{ config: unknown }>;

export class Pipeline {
  readonly configs: ReadonlyArray<PluginConfig>;

  constructor(configs: ReadonlyArray<PluginConfig>) {
    this.configs = configs;
  }

  transform(editor: ProviderEditor): void {
    for (const config of this.configs) {
      transformConfig(editor, config);
    }
  }

  registerIntegrations(editor: IntegrationEditor): void {
    const suppressed = this.configs.reduce<boolean | undefined>(
      (current, config) => config.suppressRegisteringIntegrations ?? current,
      undefined,
    );
    if (suppressed) {
      return;
    }
    for (const config of this.configs) {
      for (const [id, providerConfig] of Object.entries(config.providers)) {
        registerIntegration(editor, id, providerConfig);
      }
    }
  }
}

interface Preparation {
  readonly pipeline: Pipeline;
  readonly status: Status;
}

export async function preparePipeline(
  remoteConfigResolver: RemoteConfigResolver,
  localRaw: unknown,
): Promise<Preparation> {
  let remoteConfigRaw: unknown;
  try {
    const response = await remoteConfigResolver();
    remoteConfigRaw = response.config;
  } catch (error) {
    if (isRpcUnavailable(error)) {
      return prepareLocalOnly(localRaw, "unavailable");
    }
    return {
      status: {
        state: "failed",
        resolver: "unknown",
        error: { stage: "resolver", message: messageOf(error) },
      },
      pipeline: new Pipeline([]),
    };
  }
  const remoteConfig = pluginConfigSchema.safeParse(remoteConfigRaw);
  if (!remoteConfig.success) {
    return {
      status: {
        state: "failed",
        resolver: "available",
        error: { stage: "central", message: formatIssues(remoteConfig.error.issues) },
      },
      pipeline: new Pipeline([]),
    };
  }
  const local = pluginConfigSchema.safeParse(localRaw);
  if (!local.success) {
    return {
      status: {
        state: "failed",
        resolver: "available",
        error: { stage: "local", message: formatIssues(local.error.issues) },
      },
      pipeline: new Pipeline([]),
    };
  }
  return {
    status: { state: "ready", resolver: "available" },
    pipeline: new Pipeline([remoteConfig.data, local.data]),
  };
}

function prepareLocalOnly(localRaw: unknown, resolver: Status["resolver"]): Preparation {
  const local = pluginConfigSchema.safeParse(localRaw);
  if (!local.success) {
    return {
      status: {
        state: "failed",
        resolver,
        error: { stage: "local", message: formatIssues(local.error.issues) },
      },
      pipeline: new Pipeline([]),
    };
  }
  return {
    status: { state: "ready", resolver },
    pipeline: new Pipeline([local.data]),
  };
}

function isRpcUnavailable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  return (
    ("type" in error && (error as { type: unknown }).type === "rpc.unavailable") ||
    (error instanceof Error && error.message.includes("rpc.unavailable"))
  );
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return String(error);
}

function formatIssues(issues: ReadonlyArray<{ path: PropertyKey[]; code: string }>): string {
  const listed = issues
    .slice(0, 5)
    .map((issue) => `${issue.path.length === 0 ? "(root)" : issue.path.join(".")}: ${issue.code}`);
  return `invalid configuration: ${listed.join("; ")}`;
}
