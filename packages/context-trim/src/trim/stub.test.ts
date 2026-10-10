import { describe, expect, test } from "vitest";
import { inputStub, outputStub, signatureOf } from "./stub.js";

describe("stubs", () => {
  test("When a reason is given then outputStub should embed it", () => {
    const stub = outputStub(
      { tool: "bash", signature: "npm test", tokens: 500, callID: "call_1" },
      "spent log",
    );

    expect(stub).toBe("[trimmed: bash npm test, ~500 tokens, call call_1]. spent log.");
  });

  test("When no reason is given then outputStub should name context.restore", () => {
    const stub = outputStub({ tool: "read", signature: "/a.ts", tokens: 100, callID: "call_1" });

    expect(stub).toBe(
      "[trimmed: read /a.ts, ~100 tokens, call call_1]. original restorable with context.restore.",
    );
  });

  test("When building an input stub then it should remain valid JSON with _trimmed", () => {
    const stub = inputStub(
      { tool: "bash", signature: "npm test", tokens: 500, callID: "call_1" },
      "big script",
    );

    expect(JSON.parse(JSON.stringify(stub))).toEqual({
      _trimmed: "bash npm test, ~500 tokens. big script",
    });
  });

  test("When the signature has collapsed whitespace and length then signatureOf should normalize it", () => {
    const signature = signatureOf("  npm   test --watch\n--filter  ");

    expect(signature).toBe("npm test --watch --filter");
  });

  test("When the signature exceeds 60 characters then signatureOf should truncate it", () => {
    expect(signatureOf("x".repeat(120))).toBe("x".repeat(60));
  });
});
