import { fileURLToPath } from "node:url";
import { Skill } from "@opencode/plugin";

export function skill(): Skill.Info {
  return {
    id: "context-trim" as Skill.Info["id"],
    name: "Context Trim" as Skill.Info["name"],
    description:
      "Trim large spent tool outputs and inputs from context with context.forget, and restore originals with context.restore. Load for long sessions, repeated tool output, browser automation loops, or ahead of context pressure.",
    autoinvoke: true,
    path: fileURLToPath(import.meta.url) as Skill.Info["path"],
    content: [
      "## Trimming with context.forget",
      "",
      "- Copy the call id from the tool call block of the assistant turn that made the call. Only trim calls whose result you have already seen.",
      "- `parts` selects what is replaced: `output` (the result), `input` (the arguments), or `both` (large script or command payloads).",
      "- `reason` is the note kept in place of the content. Write one a future turn can act on.",
      "",
      "## What to trim",
      "",
      "- Superseded file reads: once a newer read of the same file exists, trim the older one.",
      "- Duplicate outputs and spent build, test, or browser logs.",
      "- The previous browser snapshot once a newer one has arrived.",
      "- Never trim the newest read of a resource; it is what you remember.",
      "",
      "## Batching",
      "",
      "- Batch several targets into one call, preferring end-of-subtask checkpoints over per-call trimming.",
      "- The receipt reports a one-time re-prefill cost from the oldest edited message; larger batches amortize it.",
      "",
      "## Recovering content",
      "",
      "- Prefer `context.restore` over re-running tools when the original was trimmed. It returns the original input and output as its own result, without touching history.",
      "- Calls older than the latest compaction are not restorable.",
    ].join("\n"),
  };
}
