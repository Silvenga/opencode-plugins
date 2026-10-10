import { describe, expect, test } from "vitest";
import { assistantToolMessage, userMessage } from "../trim/fixtures.js";
import { SessionView } from "../trim/session-view.js";
import { restoreTool } from "./restore.js";

function makeView() {
  return new SessionView([
    userMessage("start"),
    assistantToolMessage({
      id: "call_1",
      name: "bash",
      input: { command: "npm test" },
      output: "full test output",
    }),
  ]);
}

describe("restoreTool", () => {
  test("When the call is in the view then execute should return the original input and output", async () => {
    const tool = restoreTool({ readView: async () => makeView() });

    const result = await tool.execute({ id: "call_1" }, { sessionID: "ses_1" });

    expect(result.content).toContain("restored bash call_1");
    expect(result.content).toContain('"command": "npm test"');
    expect(result.content).toContain("full test output");
  });

  test("When the call is absent then execute should reject with not found", async () => {
    const tool = restoreTool({ readView: async () => makeView() });

    await expect(tool.execute({ id: "call_missing" }, { sessionID: "ses_1" })).rejects.toThrow(
      "not found",
    );
  });

  test("When the id is missing then execute should reject", async () => {
    const tool = restoreTool({ readView: async () => makeView() });

    await expect(tool.execute({}, { sessionID: "ses_1" })).rejects.toThrow("id must be a string");
  });

  test("When the call has non-text parts then execute should note their omission", async () => {
    const view = new SessionView([
      {
        id: "msg_1",
        type: "assistant",
        content: [
          {
            type: "tool",
            id: "call_shot",
            name: "browser_capture",
            state: {
              status: "completed",
              input: { label: "page" },
              content: [
                { type: "text", text: "snapshot description" },
                { type: "image", media: "omitted" },
              ],
            },
          },
        ],
      },
    ]);
    const tool = restoreTool({ readView: async () => view });

    const result = await tool.execute({ id: "call_shot" }, { sessionID: "ses_1" });

    expect(result.content).toContain("snapshot description");
    expect(result.content).toContain("(1 non-text parts omitted)");
  });
});
