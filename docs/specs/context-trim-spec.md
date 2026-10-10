# @slvnco-opencode/context-trim

Lets the agent reclaim context by replacing spent tool call inputs and outputs with tool calls.

## Plugin Inputs

Options belong to the plugin entry in `opencode.json(c)`:

```jsonc
{
  "minTokens": 400
}
```

- `minTokens` accepts a positive integer and defaults to `400`. A target whose combined estimated trimmed tokens fall below it is skipped.

Invalid or missing options use their defaults without failing the load.

## Rules

- Persisted session history is never modified. Stubs apply only to the assembled model request. Transcripts, undo, the user's view, and the compaction input keep the original content.
- The patcher runs for model requests only, never for compaction.
- Stub text is computed once at record time and replayed verbatim on every request; a recorded directive never changes afterward.
- Directives are scoped to one session. Child sessions do not inherit them.
- The plugin writes no files. All state is plugin storage.
- Content is replaced, never removed: no message or part is deleted, reordered, or renamed, and tool call and tool result counts stay equal, so call and result pairing stays valid on every protocol.

## Tools

### context.forget

Replaces spent tool call content with stubs.

Input:

```json
{
  "targets": [
    {
      "id": "tool_01abcd",
      "parts": "both",
      "reason": "pre-edit read of src/foo.ts, superseded by call_123"
    }
  ]
}
```

- `targets` is required and non-empty.
- `id` is the tool call ID as it appears in the `[call <id>]` marker at the start of the tool result, or in the agent's own tool call block. Matching scrubs both sides with `[^a-zA-Z0-9_-]` to `_` before comparing, because protocols may rewrite IDs on the wire.
- `parts` is required and accepts `output`, `input`, or `both`.
- `reason` is optional. It becomes the stub text the model reads in place of the content.

Behavior per target:

1. Resolve the target against the session context view. An ID absent from the view is skipped with reason `not found`. A sibling call from the same turn whose result is not recorded yet is also `not found`; the agent must have seen the content it trims.
2. A target already covered by a recorded directive is skipped with reason `already trimmed`. First directive wins; reasons are never updated.
3. Estimate trimmed tokens as `ceil(chars / 4)` summed over the parts selected. Below `minTokens`, skip with reason `too small`.
4. Latest-read warning: when the target is the newest call for its tool and primary argument and no newer call for the same pair exists, record the directive anyway and report a warning with reason `latest <tool> of <primary argument>`. The agent is presumed to know why it is trimming; the warning keeps the risk visible in the transcript. The primary argument is the value of the first string-valued property of the call input, truncated to 80 characters, or the string input itself.
5. Accepted targets record a directive.

The receipt is text. Per target it shows the outcome, the estimated tokens, the stub, and any skip or warning reason, and it ends with a totals line and a cache line showing the position of the oldest affected message and the estimated tokens from there to the end of the view, the one-time re-prefill cost:

```text
trimmed 3 targets, ~16,200 tokens reclaimed
- call_abc bash: output ~8,432 tokens -> "spent build log, tests passed" (restorable with context.restore)
- call_def read: input+output ~5,778 tokens -> "old read, superseded" (restorable with context.restore)
- call_jkl read: output ~1,990 tokens -> "older snapshot, superseded" (restorable with context.restore)
skipped call_ghi: not found
warning call_jkl: latest read of src/foo.ts - trimmed anyway
cache: oldest edit at message 42 of 88, ~46,000 tokens re-prefill once
```

### context.restore

Returns the original input and output of a call as this call's result, appended at the current tail. The result is new content at the end; nothing above it changes.

Input:

```json
{"id": "tool_01abcd"}
```

- Resolution uses the session context view, the same view `context.forget` resolves targets against.
- Any call in the view can be restored, trimmed or not, regardless of directive state. The view is bounded by the latest compaction; a call older than that, or removed by an undo rewind, fails with `not found`.

## Stubs

- Output stub: `[trimmed: <tool> <signature>, ~<N> tokens, call <id>]. <reason or "original restorable with context.restore">.`
- Input stub: the JSON object `{"_trimmed": "<tool> <signature>, ~<N> tokens. <reason>"}`. The input stub must remain valid JSON on every protocol.
- Signature: the primary argument truncated to 60 characters on a single line.
- A target with no `reason` uses the default stub text, which names `context.restore` as the recovery path.

## Call IDs

- Every text tool result in an assembled model request is prefixed with `[call <id>]`, using the canonical call ID from the session view, so the agent can target calls even when its protocol does not show tool call IDs.
- A stubbed result shows only the stub; the stub already carries the call ID.
- Non-text results, parts without an ID, and tool call inputs are never modified by annotation.
- Annotation is request-only: persisted session history, transcripts, the user's view, and the compaction input keep the original result text. It applies to the same model requests as stubs and never to compaction.

## Skill

The plugin registers the skill `context-trim` with `autoinvoke: true`. Its description advertises it for long sessions and ahead of context pressure. The body must teach:

- Copying the call ID from the `[call <id>]` marker that starts each tool result, or from the tool call block of the assistant turn.
- Trimming superseded reads, duplicate outputs, spent build, test, and browser logs, and the previous browser snapshot once a newer one has arrived.
- Never trimming the newest read of a resource.
- Writing reasons a future turn can act on.
- Batching several targets into one call, preferring end-of-subtask checkpoints over per-call trimming.
- Preferring `context.restore` over re-running tools when the original was trimmed.

The `context.forget` description must state where IDs come from, the reason purpose, and the batching preference. Tool descriptions travel in the tools prefix of every request, so they are the always-present instruction layer; the skill body loads on demand.

## States

| State     | Condition                                                        |
|-----------|------------------------------------------------------------------|
| `applied` | Target appears in the assembled context and stubs are visible.  |
| `orphaned`| Target appears nowhere in the assembled context, typically after compaction. |

State flow:

- A recorded directive starts `applied`; acceptance requires the target in the view.
- `applied` becomes `orphaned` when the target stops appearing in the assembled context, and `orphaned` is pruned on the next patcher run.

## Storage Keys

One key per directive:

| Key                              | Value                                              |
|----------------------------------|----------------------------------------------------|
| `directives/<sessionID>/<callID>`| The directive: parts, reason, stubs, signature, sizes. |

Per-entry keys make recording append-only: parallel `context.forget` calls cannot lose each other's entries, `already trimmed` is key existence, and listing is a prefix scan. No removed content is stored.

### Cleanup

- On the `session.deleted` event, the plugin removes every `directives/<sessionID>/*` key for that session.
- The subscription is live; a deletion while the plugin is not loaded leaves a small orphan key set.

## Failure Handling

Fail open. The plugin never blocks OpenCode, never blocks a model request, and `setup` never throws.

| Stage             | Failure                                       | Result                                             |
|-------------------|-----------------------------------------------|----------------------------------------------------|
| Setup             | Registration fails.                           | Tools and skill absent; sessions run untouched.     |
| `context.forget`  | Session context read fails.                   | Error result; nothing recorded.                     |
| Patcher            | Any error while patching messages.          | Request is sent with messages unmodified.           |
| Annotation         | Any error while annotating results.         | Annotated results keep their markers; the rest are sent unannotated. |
| `context.restore` | Call ID absent from the session context view. | `not found` error.                                  |
| Cleanup           | Storage removal fails.                        | Keys remain; retried on the next `session.deleted`. |