# @slvnco-opencode/mcp-servers

Goal: Supply OpenCode MCP server definitions from central configuration and local plugin options.

## Configuration

Read central configuration through `getConfig({ name: "mcp-servers" })` and local configuration from plugin options. Both use the same shape:

```yaml
name: mcp-servers
config:
  servers:
    company:
      type: remote
      url: https://mcp.example.com/mcp
    workspace:
      type: local
      command: ["bunx", "@example/workspace-mcp"]
      environment:
        API_KEY: $(env:WORKSPACE_API_KEY)
      timeout:
        startup: 45000
```

Absent or null configuration is treated as `{}`. The optional `servers` map defaults to `{}` and is keyed by non-empty server names. Names are passed to OpenCode unchanged.

Each entry is a complete local or remote server definition. Partial definitions, null entries, and boolean shorthand are invalid.

### Local Servers

Local servers accept the following fields:

| Field         | Requirement                                                                                 |
|---------------|---------------------------------------------------------------------------------------------|
| `type`        | Required. Must be `"local"`.                                                                |
| `command`     | Required. Non-empty array of strings. The executable, its first element, must be non-empty. |
| `cwd`         | Optional string. Process working directory.                                                 |
| `environment` | Optional map of strings to strings. Added to the inherited process environment.             |
| `disabled`    | Optional boolean. Prevents connection when true.                                            |
| `codemode`    | Optional boolean. Selects Code Mode or direct tool exposure.                                |
| `timeout`     | Optional timeout object.                                                                    |
| `protocol`    | Optional protocol selection.                                                                |

Commands are executable-and-argument arrays, not shell command strings. The plugin does not invoke a shell or inspect executable availability.

### Remote Servers

Remote servers accept the following fields:

| Field      | Requirement                                                  |
|------------|--------------------------------------------------------------|
| `type`     | Required. Must be `"remote"`.                                |
| `url`      | Required. Absolute HTTP or HTTPS Streamable HTTP endpoint.   |
| `headers`  | Optional map of strings to strings.                          |
| `oauth`    | Optional OAuth object or `false`.                            |
| `disabled` | Optional boolean. Prevents connection when true.             |
| `codemode` | Optional boolean. Selects Code Mode or direct tool exposure. |
| `timeout`  | Optional timeout object.                                     |
| `protocol` | Optional protocol selection.                                 |

OAuth is left to OpenCode when omitted. Setting `oauth: false` disables OAuth for servers using header credentials or another authentication mechanism.

The OAuth object accepts only these optional fields:

- `client_id`: String.
- `client_secret`: String.
- `scope`: String containing space-delimited scopes.
- `callback_port`: Integer from 1 through 65535.
- `redirect_uri`: String. OpenCode validates callback suitability during authentication.
- `auth_server_metadata_url`: String. OpenCode handles metadata retrieval during authentication.

### Shared Fields

The `timeout` object accepts `startup`, `catalog`, and `execution`. Each is optional and must be a positive integer in milliseconds.

The `protocol` field accepts `"legacy"`, `"auto"`, or `"2026-07-28"`.

Omitted optional fields remain omitted. OpenCode supplies its native defaults, including applicable global MCP timeout settings. The plugin does not configure global MCP defaults.

## Validation

Validate central and local configuration independently before applying either. If either is invalid, apply neither.

Unknown fields are rejected at the configuration root, in server definitions, and in timeout and OAuth objects. Environment and header maps accept arbitrary string keys.

Fields belonging to the other transport are invalid. For example, a remote server cannot include `command`, and a local server cannot include `oauth`.

Disabled definitions are validated in full. Validation does not connect to endpoints, start processes, inspect credentials, or check whether working directories exist.

Publish a `./schema` export under the document name `mcp-servers` for the shared CLI's validation and JSON Schema export.

## Precedence and Application

Validate both inputs before applying any definitions. Apply central definitions first, then local definitions.

Each definition replaces the entire existing server definition with the same name. Nested objects and arrays are not merged. Unmentioned servers remain unchanged.

This replacement rule also applies to definitions supplied by native OpenCode configuration or earlier transforms. Later transforms may change the result according to OpenCode's registration order.

An empty server map changes nothing. It does not clear definitions from an earlier source.

A local override must repeat every required field, even when only disabling a central server. For example, the local options below replace the central `company` definition:

```json
{
  "servers": {
    "company": {
      "type": "remote",
      "url": "https://mcp.example.com/mcp",
      "disabled": true
    }
  }
}
```

There is no removal directive, partial override syntax, or separate disable list. OpenCode reconciles connection lifecycle from the resulting definitions.

Repeated application must produce the same definitions from the same inputs.

## Paths and References

Local servers execute on the OpenCode server machine, not necessarily the machine running the TUI.

Working directories follow OpenCode's native semantics. Relative `cwd` values resolve from the workspace, not from the central YAML file's location. The plugin passes paths through without rebasing them.

Central references are resolved by `config-resolver` before this plugin receives configuration. The plugin performs no additional reference scanning or environment substitution on either input.

Local options are validated as received from OpenCode. All received strings are treated literally, including reference-like strings.

## Failure Handling

On `rpc.unavailable`, continue with local configuration alone. Other resolver errors or incompatible responses fail acquisition and apply neither configuration.

Acquisition or validation failure leaves existing MCP definitions unchanged. The plugin does not independently cache configuration; cached central configuration remains the resolver's responsibility.

Setup, registration, application, and cleanup failures must not block OpenCode. Unexpected application failures are reported through status when available. Rollback of mutations already accepted by the host is not guaranteed.

Failure to register the status RPC must not prevent configuration application. No status report is required when that RPC is unavailable.

Configuration values must not appear in plugin logs or status responses.

## Status and Notification

Expose a `status` RPC under `slvn-opencode.mcp-servers`, with empty input and the following response:

```ts
{
  state: "ready" | "failed"
  resolver: "available" | "unavailable" | "unknown"
  error?: {
    stage: "resolver" | "central" | "local" | "application"
    message: string
  }
}
```

State meanings:

- `ready`: Both inputs were validated and the MCP transform was registered successfully, with no observed application failure. Omit `error`.
- `failed`: Acquisition, validation, transform registration, or application failed. Include `error`.

Status is unavailable until configuration preparation and the MCP transform registration attempt finish. Acquisition or validation failure skips that registration attempt and exposes `failed` status.

Successful registration is the readiness boundary. It does not guarantee that OpenCode has evaluated the transform or connected any server.

An application failure during registration or a later replay produces `failed` status. That failure remains recorded until setup runs again, even if a subsequent replay succeeds.

Resolver meanings:

- `available`: A compatible resolver response was received, even if its configuration failed validation.
- `unavailable`: The resolver returned `rpc.unavailable`.
- `unknown`: Another resolver or response failure prevented obtaining central configuration.

Transform registration failures use stage `application`. Error messages identify stages, server names, and field paths without echoing configuration values or untrusted exception messages.

On TUI startup, request status and show an error toast for `failed`. Remain silent for `ready` or an unreachable status RPC.

## Lifecycle

Configuration is acquired once during setup. Configuration changes require plugin setup to run again. Transform replay alone does not re-fetch configuration.

Unloading the plugin removes its transform through OpenCode's registration lifecycle. The plugin does not persist definitions into native configuration files or delete stored MCP credentials.
