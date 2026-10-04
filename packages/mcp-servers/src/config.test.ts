import { describe, expect, test } from "vitest";
import { pluginConfigSchema } from "./config.js";

describe("configuration", () => {
  test.each([undefined, null, {}])(
    "When configuration is %j then validation should return no servers",
    (input) => {
      expect(pluginConfigSchema.parse(input)).toEqual({ servers: {} });
    },
  );

  test("When all supported fields are supplied then validation should preserve them", () => {
    const config = {
      servers: {
        local: {
          type: "local",
          command: ["command", ""],
          cwd: ".",
          environment: { TOKEN: "literal" },
          disabled: true,
          codemode: false,
          timeout: { startup: 1, catalog: 2, execution: 3 },
          protocol: "auto",
        },
        remote: {
          type: "remote",
          url: "https://example.com/mcp",
          headers: { Authorization: "secret" },
          oauth: {
            client_id: "id",
            client_secret: "secret",
            scope: "tools",
            callback_port: 65535,
            redirect_uri: "literal",
            auth_server_metadata_url: "literal",
          },
          protocol: "2026-07-28",
        },
        anonymous: {
          type: "remote",
          url: "http://localhost/mcp",
          oauth: false,
          protocol: "legacy",
        },
      },
    };
    expect(pluginConfigSchema.parse(config)).toEqual(config);
  });

  test.each([
    { extra: true },
    { servers: { "": { type: "local", command: ["x"] } } },
    { servers: { s: null } },
    { servers: { s: false } },
    { servers: { s: { disabled: true } } },
    { servers: { s: { type: "local", command: [] } } },
    { servers: { s: { type: "local", command: [""] } } },
    { servers: { s: { type: "local", command: ["x"], oauth: false } } },
    ...[
      { url: "relative" },
      { url: "ftp://example.com" },
      { enabled: false },
      { command: ["x"] },
      { timeout: { startup: 0 } },
      { timeout: { catalog: 1.5 } },
      { timeout: { extra: 1 } },
      { oauth: true },
      { oauth: { callback_port: 65536 } },
      { oauth: { extra: "x" } },
      { protocol: "unknown" },
      { headers: { X: 1 } },
    ].map((fields) => ({
      servers: { s: { type: "remote", url: "https://example.com", ...fields } },
    })),
  ])("When configuration is invalid %j then validation should reject it", (input) => {
    expect(pluginConfigSchema.safeParse(input).success).toBe(false);
  });
});
