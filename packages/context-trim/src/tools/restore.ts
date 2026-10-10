import type { SessionView } from "../trim/session-view.js";

export function restoreTool(deps: {
  readonly readView: (sessionID: string) => Promise<SessionView>;
}) {
  return {
    name: "restore",
    description:
      "Return the original input and output of a tool call as this result, appended at the current tail. Works for any call still in the session context view, trimmed or not. Calls older than the latest compaction are not restorable.",
    input: {
      type: "object",
      properties: {
        id: { type: "string", description: "Tool call ID copied from the tool call block" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    options: { namespace: "context" },
    execute: async (
      rawInput: unknown,
      context: { sessionID: string },
    ): Promise<{ content: string }> => {
      const id = readID(rawInput);
      const view = await deps.readView(context.sessionID);
      const call = view.resolve(id);
      if (call === undefined) {
        throw new Error(`context.restore: ${id} not found in the session context view`);
      }
      const omittedNote =
        call.omittedPartCount > 0 ? `\n(${call.omittedPartCount} non-text parts omitted)` : "";
      return {
        content: `restored ${call.tool} ${call.callID}\ninput:\n${JSON.stringify(call.input, null, 2)}\noutput:\n${call.outputText}${omittedNote}`,
      };
    },
  };
}

function readID(rawInput: unknown): string {
  if (typeof rawInput !== "object" || rawInput === null) {
    throw new Error("context.restore: id must be a string");
  }
  const id = (rawInput as { id?: unknown }).id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("context.restore: id must be a string");
  }
  return id;
}
