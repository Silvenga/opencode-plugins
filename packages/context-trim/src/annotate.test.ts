import { describe, expect, test } from "vitest";
import { annotateCallIDs, type RequestMessage } from "./annotate.js";
import { ContextPatcher } from "./context-patcher.js";
import { DirectiveStore, type Directive } from "./store/directive-store.js";
import { makeStorage } from "./store/fixtures.js";
import { requestTurn } from "./trim/fixtures.js";

function partOf(messages: readonly unknown[], messageIndex: number, partIndex: number) {
  const message = messages[messageIndex] as { content?: readonly unknown[] };
  const part = message.content?.[partIndex];
  if (part == null) {
    throw new Error("missing part");
  }
  return part as Record<string, unknown>;
}

function resultValueOf(messages: readonly unknown[]): string {
  return (partOf(messages, 1, 0).result as { value: string }).value;
}

function outputDirective(callID: string): Directive {
  return {
    callID,
    tool: "bash",
    primaryArgument: "npm test",
    parts: "output",
    estimatedTokens: 5000,
    outputStub: "[trimmed: bash npm test, ~5000 tokens, call " + callID + "]. spent log.",
  };
}

describe("annotateCallIDs", () => {
  test("When a text tool result is present then annotateCallIDs should prefix the call id marker", () => {
    const messages = requestTurn({ callID: "call_1", tool: "bash", result: "full test output" });

    annotateCallIDs(messages);

    expect(resultValueOf(messages)).toBe("[call call_1] full test output");
  });

  test("When the result value is empty then annotateCallIDs should emit the marker alone", () => {
    const messages = requestTurn({ callID: "call_1", tool: "bash", result: "" });

    annotateCallIDs(messages);

    expect(resultValueOf(messages)).toBe("[call call_1]");
  });

  test("When the result is not text then annotateCallIDs should leave the part unchanged", () => {
    const messages = [
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            id: "call_1",
            name: "browser_capture",
            result: { type: "image", media: "x" },
          },
        ],
      },
    ];
    const before = JSON.stringify(messages);

    annotateCallIDs(messages);

    expect(JSON.stringify(messages)).toBe(before);
  });

  test("When the part has no id then annotateCallIDs should leave the result unchanged", () => {
    const messages = [
      {
        role: "tool",
        content: [{ type: "tool-result", name: "bash", result: { type: "text", value: "ok" } }],
      },
    ];

    annotateCallIDs(messages);

    expect((partOf(messages, 0, 0).result as { value: string }).value).toBe("ok");
  });

  test("When the tool call input is present then annotateCallIDs should leave it untouched", () => {
    const messages = requestTurn({
      callID: "call_1",
      tool: "bash",
      input: { command: "npm test" },
      result: "ok",
    });

    annotateCallIDs(messages);

    expect(partOf(messages, 0, 1).input).toEqual({ command: "npm test" });
    expect(partOf(messages, 0, 1).id).toBe("call_1");
  });

  test("When the walk meets malformed content then annotateCallIDs should not throw", () => {
    const messages = [
      null,
      { role: "user", content: "not-an-array" },
      {
        role: "tool",
        content: [
          null,
          42,
          { type: "tool-result", id: "", result: { type: "text", value: "x" } },
          { type: "tool-result", id: "call_1", result: null },
          { type: "tool-result", id: "call_2", result: { type: "text", value: 7 } },
        ],
      },
    ] as unknown as readonly RequestMessage[];

    expect(() => annotateCallIDs(messages)).not.toThrow();
  });

  test("When a directive covers the call then the stub should replace the annotation", async () => {
    const storage = makeStorage();
    const store = new DirectiveStore(storage);
    await store.record("ses_1", outputDirective("call_1"));
    const messages = requestTurn({ callID: "call_1", tool: "bash", result: "full test output" });

    annotateCallIDs(messages);
    await new ContextPatcher(store).patch("ses_1", messages);

    expect(resultValueOf(messages)).toBe(outputDirective("call_1").outputStub);
  });
});
