# @slvnco-opencode/cli

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHOULD NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

## Goal

Provide configuration validation as a CLI tool. The CLI is not an OpenCode plugin.

The CLI MUST run under Node.js and Bun, via `npx` or `bunx`. To that end the package ships a compiled, self-contained JavaScript bundle in `dist/` with zero runtime dependencies; the bundle is built before publishing.

## Schema Registry

Each plugin that consumes a named config document publishes a `./schema` subpath export. The export is an object with two fields: `name`, the document `name` the plugin consumes (matching `@slvnco-opencode/config-resolver`'s document format), and `schema`, a Zod schema validating that plugin's `config` value. The module MUST NOT import `@opencode/plugin`, so consumers can load schemas without loading plugin implementations.

The CLI's registry combines every `./schema` export. Registry names MUST be unique; a duplicate is an internal error.

## Verbs

### Validate

```bash
bunx @slvnco-opencode/cli@latest validate <config-file>
```

Accepts a YAML configuration file to validate. If the file cannot be read, an error MUST be raised. The input is a local file path, resolved against the working directory when relative; `~` follows the config-resolver expansion. Remote URLs are not accepted.

The YAML configuration file may contain multiple YAML documents. Each document MUST be validated separately. For each document, the following line MUST be printed to stdout.

```plaintext
<STATUS>: <NAME>[: ERROR]
```

`STATUS`: One of `PASS` (YAML document is valid against the schema) or `FAILED` (YAML document couldn't be parsed as YAML, or was invalid against the schema).
`NAME`: The name of the plugin this config is for. For a document that fails before a name exists (unparseable YAML, missing or empty `name`), the name is `<unknown>`.
`ERROR`: The error encountered while validating the document. Omitted when the document passes.

```plaintext
FAILED: a-plugin: unknown key "blah".
PASS: model-providers
```

Document validation, in order:

1. Parse the YAML document. A YAML parse error fails the document.
2. The document must be an object with a non-empty string `name`. Otherwise the document fails with `<unknown>`.
3. The registry must contain the document's `name`. An unregistered name fails the document.
4. String values inside `config` are processed for references. `file` references are resolved, and a missing referenced file fails the document. `env` references resolve when the variable is set to a non-empty value; when unset or empty (matching the config-resolver env provider's failure condition), the raw reference remains in place and is not an error. Resolution follows the config-resolver scanning rules, relative to the config file being validated, inserted verbatim and non-recursively.
5. The `config` value must validate against the registry entry's schema. A schema failure fails the document.

Reference resolution differs from `@slvnco-opencode/config-resolver` deliberately, because validation is likely not run on the target machine. A missing file fails since the file ships with the config; an unset env variable does not fail since the target machine may define it.

An empty document (null, produced by separators such as a trailing `---`) is skipped with no output line. Extra keys in a document are allowed and ignored. Each document is validated independently; duplicate names do not merge.

An example multi-document file:

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
```

See `@slvnco-opencode/config-resolver`.

### Export Schema

```bash
bunx @slvnco-opencode/cli@latest export-schema
```

Writes one JSON Schema (draft 2020-12) to stdout, and exits. The schema is a `oneOf` over the registry's document variants: each variant is an object pinning `name` to a const equal to the plugin's document name, with an optional `config` matching that plugin's schema in input mode. Extra keys in a document are allowed. The output is deterministic.

## Errors

Errors may be raised. If so, a message MUST be written to stderr and the CLI MUST exit with a non-0 exit code. An exit code of 1 is preferred as no exit codes have semantic meaning.

For `validate`, the exit code is 0 when every document line is `PASS` (including zero documents), and 1 when any line is `FAILED` or an error is raised.

## CLI Surface

- Document lines from `validate` and the exported schema from `export-schema` are written to stdout. Help text, usage, and error messages are written to stderr when they report a failure, and to stdout when explicitly requested.
- `--help` (or no arguments at all) prints the usage overview. `--help` exits 0; no arguments at all exits 1, as does any malformed invocation (unknown verb, missing required argument, excess arguments).
- `--version` prints the CLI version and exits 0.
- The version reported by `--version` is the package version, baked into the distributed bundle at build time.
