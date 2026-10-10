import { describe, expect, test } from "vitest";
import { assistantToolMessage, userMessage } from "./fixtures.js";
import { primaryArgumentOf, SessionView } from "./session-view.js";

describe("SessionView", () => {
  test("When the view contains the completed call then resolve should return it with sizes", () => {
    const view = new SessionView([
      userMessage("hello"),
      assistantToolMessage({
        id: "call_1",
        name: "read",
        input: { path: "/src/a.ts" },
        output: "file contents",
      }),
    ]);

    const call = view.resolve("call_1");

    expect(call).toBeDefined();
    expect(call?.messageIndex).toBe(1);
    expect(call?.tool).toBe("read");
    expect(call?.primaryArgument).toBe("/src/a.ts");
    expect(call?.outputText).toBe("file contents");
    expect(call?.outputChars).toBe(
      JSON.stringify([{ type: "text", text: "file contents" }]).length,
    );
    expect(call?.inputChars).toBe(JSON.stringify({ path: "/src/a.ts" }).length);
  });

  test("When ids differ only in wire-unsafe characters then resolve should match by scrub equality", () => {
    const view = new SessionView([
      assistantToolMessage({ id: "call.1", name: "read", output: "x" }),
    ]);

    expect(view.resolve("call_1")?.callID).toBe("call.1");
  });

  test("When the call has not completed then resolve should return undefined", () => {
    const view = new SessionView([
      assistantToolMessage({ id: "call_1", name: "read", status: "running" }),
    ]);

    expect(view.resolve("call_1")).toBeUndefined();
  });

  test("When the call is absent then resolve should return undefined", () => {
    const view = new SessionView([assistantToolMessage({ id: "call_1", name: "read" })]);

    expect(view.resolve("call_missing")).toBeUndefined();
  });

  test("When the target is the newest call for its tool and argument then resolve should report isLatestForArgument true", () => {
    const view = new SessionView([
      assistantToolMessage({ id: "call_1", name: "read", input: { path: "/a.ts" }, output: "old" }),
      assistantToolMessage({ id: "call_2", name: "read", input: { path: "/a.ts" }, output: "new" }),
    ]);

    expect(view.resolve("call_2")?.isLatestForArgument).toBe(true);
    expect(view.resolve("call_1")?.isLatestForArgument).toBe(false);
  });

  test("When calls share the tool but differ in argument then isLatestForArgument should track the argument pair", () => {
    const view = new SessionView([
      assistantToolMessage({ id: "call_1", name: "read", input: { path: "/a.ts" }, output: "a" }),
      assistantToolMessage({ id: "call_2", name: "read", input: { path: "/b.ts" }, output: "b" }),
    ]);

    expect(view.resolve("call_1")?.isLatestForArgument).toBe(true);
    expect(view.resolve("call_2")?.isLatestForArgument).toBe(true);
  });

  test("When input has no string property then primaryArgument should be empty", () => {
    const view = new SessionView([
      assistantToolMessage({ id: "call_1", name: "bash", input: { timeout: 5000 }, output: "ok" }),
    ]);

    expect(view.resolve("call_1")?.primaryArgument).toBe("");
  });

  test("When the primary argument exceeds 80 characters then resolve should truncate it", () => {
    const long = "x".repeat(120);
    const view = new SessionView([
      assistantToolMessage({ id: "call_1", name: "read", input: { path: long }, output: "ok" }),
    ]);

    expect(view.resolve("call_1")?.primaryArgument).toBe("x".repeat(80));
  });

  test("When asked for the tail then tailTokens should estimate from that message to the end", () => {
    const messages = [
      userMessage("first"),
      assistantToolMessage({ id: "call_1", name: "read", output: "big output" }),
      userMessage("last"),
    ];
    const view = new SessionView(messages);

    const expected = Math.ceil(
      (JSON.stringify(messages[1]).length + JSON.stringify(messages[2]).length) / 4,
    );

    expect(view.tailTokens(1)).toBe(expected);
    expect(view.count).toBe(3);
  });

  test("When a tool part has no state then resolve should treat it as not found", () => {
    const view = new SessionView([
      {
        id: "msg_1",
        type: "assistant",
        content: [{ type: "tool", id: "call_broken", name: "read" }],
      },
    ]);

    expect(view.resolve("call_broken")).toBeUndefined();
  });

  test("When the input is a raw string then primaryArgumentOf should use the string itself", () => {
    expect(primaryArgumentOf("npm test")).toBe("npm test");
    expect(primaryArgumentOf("x".repeat(120))).toBe("x".repeat(80));
  });

  test("When the call has non-text parts then resolve should count them as omitted", () => {
    const view = new SessionView([
      {
        id: "msg_1",
        type: "assistant",
        content: [
          {
            type: "tool",
            id: "call_1",
            name: "browser_capture",
            state: {
              status: "completed",
              input: { label: "page" },
              content: [
                { type: "text", text: "description" },
                { type: "image", media: "x" },
                { type: "image", media: "y" },
              ],
            },
          },
        ],
      },
    ]);

    expect(view.resolve("call_1")?.omittedPartCount).toBe(2);
  });
});
