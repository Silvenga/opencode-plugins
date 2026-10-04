import { pluginConfigSchema, type ServerConfig } from "./config.js";
import type { Status } from "./rpc/contract.js";

export interface Editor {
  set(name: string, config: ServerConfig): void;
}

export interface Runtime {
  resolve(): Promise<unknown>;
  transform(callback: (editor: Editor) => void): Promise<unknown>;
  register(status: () => Status): Promise<{ dispose(): Promise<void> }>;
}

export async function setup(runtime: Runtime, options: unknown): Promise<() => Promise<void>> {
  let status: Status = { state: "ready", resolver: "unknown" };
  const fail = (stage: NonNullable<Status["error"]>["stage"], message: string) => {
    status = { state: "failed", resolver: status.resolver, error: { stage, message } };
  };
  let central: unknown;
  try {
    const response = await runtime.resolve();
    if (
      typeof response !== "object" ||
      response === null ||
      Array.isArray(response) ||
      !Object.hasOwn(response, "config")
    ) {
      fail("resolver", "Incompatible resolver response");
    } else {
      central = (response as { config: unknown }).config;
      status.resolver = "available";
    }
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "rpc.unavailable"
    ) {
      status.resolver = "unavailable";
    } else {
      fail("resolver", "Configuration resolver failed");
    }
  }
  if (status.state === "ready") {
    const configs: Array<Record<string, ServerConfig>> = [];
    for (const [stage, raw] of [
      ["central", central],
      ["local", options],
    ] as const) {
      const parsed = pluginConfigSchema.safeParse(raw);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.code}`);
        fail(stage, `Invalid configuration: ${issues.join("; ")}`);
        break;
      }
      configs.push(parsed.data.servers);
    }
    if (status.state === "ready") {
      try {
        await runtime.transform((editor) => {
          let name: string | undefined;
          try {
            for (const servers of configs) {
              for (const [id, config] of Object.entries(servers)) {
                name = id;
                editor.set(id, structuredClone(config));
              }
            }
          } catch {
            fail(
              "application",
              name === undefined
                ? "MCP configuration application failed"
                : `MCP configuration application failed for server ${name}`,
            );
          }
        });
      } catch {
        fail("application", "MCP transform registration failed");
      }
    }
  }
  let registration: { dispose(): Promise<void> } | undefined;
  try {
    registration = await runtime.register(() => structuredClone(status));
  } catch {
    // Reporting must not prevent configuration application.
  }
  return async () => {
    try {
      await registration?.dispose();
    } catch {
      /* Fail open during unload. */
    }
  };
}
