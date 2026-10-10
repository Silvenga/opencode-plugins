import { describe, expect, test } from "vitest";
import { DirectiveStore, type Directive } from "./directive-store.js";
import { makeStorage } from "./fixtures.js";

function directive(callID: string): Directive {
  return {
    callID,
    tool: "read",
    primaryArgument: "/a.ts",
    parts: "output",
    estimatedTokens: 5000,
    outputStub: "[trimmed]",
  };
}

describe("DirectiveStore", () => {
  test("When recording then the store should write one key per call", async () => {
    const storage = makeStorage();
    const store = new DirectiveStore(storage);

    await store.record("ses_1", directive("call.1"));

    expect(storage.map.size).toBe(1);
    expect(storage.map.has("directives/ses_1/call_1")).toBe(true);
  });

  test("When recording two directives for one session in parallel then both should persist", async () => {
    const storage = makeStorage();
    const store = new DirectiveStore(storage);

    await Promise.all([
      store.record("ses_1", directive("call_1")),
      store.record("ses_1", directive("call_2")),
    ]);

    expect(await store.list("ses_1")).toHaveLength(2);
  });

  test("When the directive exists then has should return true", async () => {
    const store = new DirectiveStore(makeStorage());
    await store.record("ses_1", directive("call.1"));

    expect(await store.has("ses_1", "call_1")).toBe(true);
    expect(await store.has("ses_1", "call.1")).toBe(true);
    expect(await store.has("ses_1", "call_other")).toBe(false);
    expect(await store.has("ses_other", "call.1")).toBe(false);
  });

  test("When listing then the store should return only that session's directives", async () => {
    const storage = makeStorage();
    const store = new DirectiveStore(storage);
    await store.record("ses_1", directive("call_1"));
    await store.record("ses_2", directive("call_2"));

    const directives = await store.list("ses_1");

    expect(directives.map((entry) => entry.callID)).toEqual(["call_1"]);
  });

  test("When removing all for a session then only that session's keys should go", async () => {
    const storage = makeStorage();
    const store = new DirectiveStore(storage);
    await store.record("ses_1", directive("call_1"));
    await store.record("ses_1", directive("call_2"));
    await store.record("ses_2", directive("call_3"));

    await store.removeAll("ses_1");

    expect(await store.list("ses_1")).toEqual([]);
    expect(await store.list("ses_2")).toHaveLength(1);
  });

  test("When a sessionID contains separators then its keys should stay isolated from other prefixes", async () => {
    const storage = makeStorage();
    const store = new DirectiveStore(storage);
    await store.record("ses/1", directive("call_1"));

    expect(await store.list("ses")).toEqual([]);
    expect(await store.list("ses/1")).toHaveLength(1);
    expect(await store.has("ses/1", "call_1")).toBe(true);
    expect(await store.has("ses", "1/call_1")).toBe(false);
  });

  test("When a directive already exists then record should keep the first directive", async () => {
    const storage = makeStorage();
    const store = new DirectiveStore(storage);
    const first = directive("call_1");
    const second = { ...directive("call_1"), reason: "overwritten note" };

    await store.record("ses_1", first);
    await store.record("ses_1", second);

    const recorded = await store.list("ses_1");
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.reason).toBeUndefined();
  });

  test("When the stored value is corrupt then has should return false and record should replace it", async () => {
    const storage = makeStorage();
    storage.map.set("directives/ses_1/call_1", "not a directive");
    const store = new DirectiveStore(storage);

    expect(await store.has("ses_1", "call_1")).toBe(false);
    await store.record("ses_1", directive("call_1"));
    expect(await store.has("ses_1", "call_1")).toBe(true);
  });
});
