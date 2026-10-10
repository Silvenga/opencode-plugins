import { fileURLToPath } from "node:url";
import { Skill } from "@opencode/plugin";

export function skill(): Skill.Info {
  return Skill.Info.make({
    id: Skill.ID.make("context-trim"),
    name: Skill.Name.make("Context Trim"),
    description:
      "Trim large spent tool outputs and inputs from context with context.forget, and restore originals with context.restore. Load for long sessions, repeated tool output, browser automation loops, or ahead of context pressure.",
    autoinvoke: true,
    path: Skill.Info.fields.path.make(fileURLToPath(import.meta.url)),
    content: [
      "## Trimming with context.forget",
      "",
      "- Every tool result starts with its call id as `[call <id>]`; copy the id from that marker, or from the tool call block of the assistant turn that made the call.",
      "- `parts` selects what is replaced: `output` (the result), `input` (the arguments), or `both` (large script or command payloads).",
      "- `reason` is the note kept in place of the content. Write one a future turn can act on.",
      "",
      "## What to trim",
      "",
      "- When a more recent tool call supersedes an older one, trim the older one when the output is longer relevant.",
      "- After tool calls with large inputs or outputs, trim the tool calls if you no longer need the context.",
      "",
      "## Batching",
      "",
      "- Batch several targets into one call, preferring end-of-subtask checkpoints over per-call trimming.",
      "- The receipt reports a one-time re-prefill cost from the oldest edited message; larger batches amortize it.",
      "",
      "## Recovering content",
      "",
      "- `context.restore` can be used to recover the original input and output of a call that was accidentally removed.",
      "",
    ].join("\n"),
  });
}
