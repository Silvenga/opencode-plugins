# @slvnco-opencode/context-trim

Lets the agent reclaim context by replacing spent tool call inputs and outputs with tool calls. The agent registers a `context.forget` tool that replaces spent tool call content with short stubs, and a `context.restore` tool that returns originals.

## Install

```jsonc
// opencode.jsonc
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

## Behavior

- `context.forget` takes targets: `{ id, parts, reason }` pairs. `id` is the tool call ID from the agent's own tool call block, `parts` selects `output`, `input`, or `both`, and `reason` is the note kept in place of the content.
- Persisted session history is never modified. Stubs apply only to the assembled model request, so transcripts, undo, and the user's view keep the original content.
- Stubs are computed once at record time and replayed verbatim, so prefix caches stay stable.
- `context.restore` returns the original input and output of any call still in the session context view, trimmed or not.
- Directive state is scoped to a session and removed when the session is deleted.

See [the spec](../../docs/specs/context-trim-spec.md) for the full behavioral contract.