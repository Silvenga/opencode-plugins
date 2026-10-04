# @slvnco-opencode/config-resolver

Resolves shared configuration for `@slvnco-opencode` plugins.

## Plugin Inputs

Options belong to the plugin entry in `opencode.json(c)`:

```jsonc
{
  "paths": [
    "/some/physical/path",
    "~/should-resolve-home-too",
    "$(env:CONFIG_SERVER)/file.yaml",
    "https://example.com/file.yaml",
    "http://example.com/non-tls-file.yaml"
  ],
  "timeoutMs": 5000,
  "vars": {
    "KEY": "value"
  }
}
```

- `paths` defaults to `[]`.
- `timeoutMs` accepts a positive, finite number and defaults to `5000`.
- `vars` accepts a string-valued object, including empty strings, and defaults to `{}`. Null, arrays, non-objects, or any non-string value invalidate the entire option. No coercion occurs.

Missing or invalid `timeoutMs` and `vars` use their defaults without failing the load.

## Path Rules

- Empty `paths` resolves nothing and produces an empty config map.
- Classify each entry after [reference resolution](#references).
- Paths must be non-empty and absolute, `~`-expanded, or `http(s)://` URLs. Relative paths and other schemes are invalid.
- Bare `~` and the `~/` prefix expand to the operating system's home directory. An unavailable home directory fails expansion. `~otheruser` is not expanded.
- Load paths concurrently. Wall-clock load time is bounded by `timeoutMs`, regardless of path count.
- Follow symlinks.
- Apply `timeoutMs` to every fetch, including referenced files.

## Config File Format

Files use multi-document YAML. Non-null documents must match this shape:

```ts
{ name: string; config?: unknown }
```

- `name` is a non-empty string identifying the consuming plugin.
- `config` accepts any JSON value; absent or null values become `{}`. The consuming plugin owns its schema.
- Validate JSON compatibility after parsing. Explicit timestamps and binary scalars are invalid; plain date-like scalars remain strings.
- Ignore extra document keys and skip null documents, including those produced by trailing separators.

A multi-document file:

```yaml
---
name: model-providers
config:
  providers: {}
---
name: mcp-servers
config:
  servers: {}
---
```

## Duplicate Names

Merge documents in `paths` order, then document order. Retain the last config per `name`, regardless of load completion order.

## References

Scan string values inside `config`, never keys. Consumers receive resolved configs.

Replace references with verbatim strings, without recursive resolution.

Scan left to right:

- `$$` emits a literal `$` and consumes both characters. `$$(` produces a literal `$(`.
- `$(provider:input)` splits at the first `:` and ends at the first `)`.
- Any other `$` is emitted as-is.

Unterminated references, missing `:`, empty providers or inputs, and unknown providers are invalid.

Supported providers are `file`, `env`, and `var`. The `env` and `var` providers require non-empty values.

### File Provider

Resolves to the contents of the referenced file. The input is a file path or URL.

- A config-file base is required, so `file` references are invalid in path entries.
- An `http(s)` URL input is fetched directly, regardless of the config file's own location.
- Otherwise, input resolves against the config file's own location. An `http(s)` config file resolves relative input against its URL (`new URL(input, base)` semantics), and a local config file resolves relative input against its parent directory.
- Absolute (`/`) and `~`-expanded input is used as-is, with `~` expanding by the same rule as path entries.

Given the config file path `https://example.com/path/top.yaml`, the references below resolve to `https://example.com/path/file` and `https://example.com/path/relative-file`:

```yaml
name: agents
config:
  - id: config
    name: Coding
    prompt: $(file:/path/to/file)
  - id: research
    name: Research
    prompt: $(file:relative-file)
```

### Env Provider

Resolves the named environment variable:

```yaml
name: model-providers
config:
  api-key: $(env:PROVIDER_API_KEY)
```

### Var Provider

Resolves the named entry in `vars`. Using the [plugin options](#plugin-inputs) above:

```yaml
name: model-providers
config:
  key: $(var:KEY)
```

## Load Process

Load once at startup. Config changes require an OpenCode restart.

1. Evaluate plugin options.
2. Resolve and classify path entries.
3. Fetch config files.
4. Parse and validate documents.
5. Resolve config references.
6. Merge named configs.
7. Replace the single fixed-key cache entry in plugin storage with the resolved map, including empty results.
8. Serve configs over OpenCode V2 RPC.

## Error Handling

Fail open: the plugin must not block OpenCode, and `setup` never throws. Loads are all-or-nothing; any failure discards the fresh result.

When several paths fail, the reported error is the first failure in `paths` array order.

### Expected Failures

| Stage                          | Failure                                                                |
|--------------------------------|------------------------------------------------------------------------|
| Path classification            | Violates [Path Rules](#path-rules).                                    |
| Fetch                          | Missing file, access error, unsupported scheme, or timeout.            |
| Document parsing or validation | Invalid YAML or a [Config File Format](#config-file-format) violation. |
| Reference resolution           | Violates [References](#references) or a provider's requirements.       |

### Resolve States

| State    | Condition                        | Served Configs |
|----------|----------------------------------|----------------|
| `fresh`  | Load succeeded.                  | Resolved map.  |
| `cache`  | Load failed; cache available.    | Cached map.    |
| `failed` | Load failed; no cache available. | Empty map.     |

## Notification

The `./tui` entrypoint requests `status` on TUI startup. Show a toast for `failed`; otherwise remain silent, including when the RPC is unreachable.

## Future

Periodic refresh without restart is deferred.

## RPC

The `./rpc` export exposes the typed contract without loading the plugin implementation.

### GetConfig

- Input: `name`, the config name.
- Output: `config`, or `{}` if no config matches. The method never errors.

### Status

- Input: None.
- Output: `state` from [Resolve States](#resolve-states). Include the last load failure message as `error` for `cache` and `failed`.
