# @slvnco-opencode/config-resolver

Goal: Provides central config resolution to other @slvnco-opencode plugins.

## Plugin Inputs

Plugin options are passed via the plugin entry in `opencode.json(c)`:

```jsonc
{
  //
  // Defaults to []
  "paths": [
    "/some/physical/path",
    "~/should-resolve-home-too",
    "$(env:CONFIG_SERVER)/file.yaml",
    "https://example.com/file.yaml",
    "http://example.com/non-tls-file.yaml"
  ],
  // Defaults to 5000
  "timeoutMs": 5000
}
```

## Path Rules

- A `paths` array with zero entries is a no-op. Nothing resolves, zero configs are served, and the resolve state is `fresh`.
- Each path entry is reference-resolved before classification, using the same reference scanning rules as `config` values. Only the resulting string is classified; references never produce multi-part values. A `file` reference inside a path entry fails the load because it has no base to resolve against.
- After resolution, an empty-string path entry fails the load.
- After resolution, a relative path entry (e.g. `./config.yaml`) fails the load. A path must be absolute, `~`-expanded, or an `http(s)://` URL.
- `~` (bare, or followed by `/`) expands to the operating system's home directory. If no home directory can be resolved, the path fails the load. `~otheruser` is not expanded.
- `http://` and `https://` are the only remote schemes. Any other scheme (e.g. `ftp://`, `file://`) fails the load.
- Paths load in parallel. Wall-clock load time is bounded by `timeoutMs`, not by the number of paths.
- Merge precedence follows the `paths` array order, independent of load completion order.
- The resolver follows symlinks.
- Every fetch, each path and each referenced file, is gated by `timeoutMs`.

## Config File Format

Each config file is a YAML file that may contain many YAML documents. Every document must match this shape:

```ts
{ name: string; config?: unknown }
```

- `name` is a non-empty string identifying the consuming plugin.
- `config` may be any JSON value: an object, array, string, number, boolean, or null. Its schema belongs to the consuming plugin, not the resolver. When `config` is absent or null, it is stored as `{}`.
- Extra keys in a document are allowed and ignored.
- Documents must be JSON-compatible. After parsing, every `config` value is checked to be a JSON value, so values like explicit timestamps or binary scalars fail the load. Plain date-like scalars are strings and stay valid.

An example file with three documents:

```yaml
---
name: model-providers
config:
  <the model-providers plugin provided schema>
---
name: mcp-servers
config:
  <the mcp-servers plugin provided schema>
---
name: agents
config:
  - id: config
    name: Coding
    prompt: $(file:/path/to/file)
---
```

## Document Validation

A document that is not an object, is missing `name`, or has a `name` that is not a non-empty string fails the load. An empty document (null, produced by separators such as a trailing `---`) is skipped.

## Duplicate Names

At most one config per `name` is kept. Documents are ordered by the position of their path in `paths`, then by their position within the file. When documents share a `name`, the last one wins. Load completion order never affects precedence.

## References

String values inside `config` may contain references in the form `$(provider:input)`. Only string values are scanned, and keys are never scanned. The consuming plugin receives a pre-processed config with references already replaced, and has no concept of reference resolvers.

Resolution is a find-and-replace over each string value, performed after YAML parsing and before caching. Referenced content is inserted verbatim as string content, so referenced files may contain new lines or YAML-significant characters without altering document structure.

Scanning a string value from left to right:

- `$$` emits a literal `$` and consumes both characters. `$$(` produces a literal `$(`.
- `$(provider:input)` is a reference. The `provider` and `input` split at the first `:`, and `input` runs to the first `)`.
- Any other `$` is emitted as-is.

Failure and depth rules:

- A reference with no closing `)`, no `:`, an empty provider, an empty input, or an unknown provider fails the load.
- Resolution is not recursive. References inside referenced content are inserted verbatim, never re-resolved.

The reference providers are `file` and `env`.

## File Provider

Resolves to the contents of the referenced file. The input is a file path or URL.

- An `http(s)` URL input is fetched directly, regardless of the config file's own location.
- Otherwise, input resolves against the config file's own location. An `http(s)` config file resolves relative input against its URL (`new URL(input, base)` semantics), and a local config file resolves relative input against its parent directory.
- Absolute (`/`) and `~`-expanded input is used as-is, with `~` expanding by the same rule as path entries.
- If the referenced file fails to load (missing, access error, unsupported scheme, or timeout), the load fails.

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

## Env Provider

Resolves to the value of an environment variable. The input is the variable name.

- The value is used verbatim as string content, wherever the reference appears.
- An unset or empty environment variable fails the load.

```yaml
name: model-providers
config:
  api-key: $(env:PROVIDER_API_KEY)
```

## Load Process

1. The plugin evaluates its options.
2. Every path entry is reference-resolved, then classified. A failure in any entry fails the load.
3. All paths load in parallel, each fetch gated by `timeoutMs`.
4. Each file parses as multi-document YAML, and every document is validated.
5. References in every string value of each `config` are resolved.
6. Documents merge in path order, then document order. The last document per `name` wins.
7. On a fresh load, the resulting map of `name` to config is cached in plugin storage. The cache is a single fixed key holding the last successful load, so storage stays bounded. The zero-paths no-op also writes the cache, as a successful (empty) load.
8. The map is served to other plugins over OpenCode V2 RPC.

The load is all-or-nothing: a failure in any step fails the whole load.

## Error Handling

Every failure in this spec fails the whole load. The plugin must never block usage of OpenCode, and `setup` never throws.

The load failure sequence:

1. The fresh load fails.
2. Load the cached map from the fixed cache key.
3. On a cache hit, serve the cached map. The resolve state is `cache`.
4. On a cache miss, serve zero configs. The resolve state is `failed`.

When several paths fail, the reported error is the first failure in `paths` array order.

### Expected Failures

- An empty-string path entry, after reference resolution.
- A relative path entry, after reference resolution.
- An unrecognized path scheme (e.g. `ftp://`, `file://`).
- An unresolvable home directory for a `~` path.
- A reference in a path entry fails: it is malformed, names an unknown provider, names `file` (no base to resolve against), or names `env` with an unset or empty variable.
- A file is missing, access throws, or a fetch times out.
- A path is not valid YAML.
- A document contains a non-JSON value or fails validation.
- A reference in a config value fails: it is malformed (no closing `)`, no `:`, empty provider, or empty input), names an unknown provider, or its referenced content fails to load. An `env` reference fails when the variable is unset or empty.

### Resolve States

- `fresh`: the fresh load succeeded, including the zero-paths no-op.
- `cache`: the fresh load failed, and the cached map was served.
- `failed`: the fresh load failed, no cache was available, and zero configs are served.

## Notification

OpenCode V2 has no server-side user notification API. User-visible notifications exist only in the TUI plugin context, so the package ships a TUI entrypoint (`./tui`). On TUI startup it calls the `status` RPC and shows a toast when the state is `failed`. The `cache` state is silent: the plugin did load, just from the cache. When the RPC is unreachable, for example a TUI connected to a remote server that does not load this plugin, the TUI entrypoint stays silent rather than failing.

## Future

Periodic re-fetch (config changes without a restart) is planned for version 2 of this plugin. This version loads once at startup, so config changes require an OpenCode restart.

## RPC

The RPC contract is published via the package's `./rpc` export, so consuming plugins can import the typed definitions without loading the implementation.

### GetConfig

- Input: `name`, the name of the config to get. Typically the consuming plugin's name.
- Output: `config`, the parsed config with references resolved. If the named config does not exist, an empty object is returned. The method never errors.

### Status

- Input: none.
- Output: `state`, the current resolve state. For `cache` and `failed`, also `error`, the last load failure message.