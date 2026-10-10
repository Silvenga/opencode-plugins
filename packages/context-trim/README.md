# @slvnco-opencode/context-trim

Lets the agent manage its own context by removing the input or output of tool calls when the agent determines it is no longer relevant.

## Install

```jsonc
{
  "plugins": ["@slvnco-opencode/context-trim"]
}
```

## Options

```jsonc
{
  "package": "@slvnco-opencode/context-trim",
  "options": {
    "minTokens": 400
  }
}
```

- `minTokens` skips targets whose estimated trimmed tokens fall below it. Defaults to `400`.
