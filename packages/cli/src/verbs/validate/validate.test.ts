import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { makeRuntime, type RuntimeDeps } from "./runtime.js";
import { validateFile } from "./validate.js";

const dirs: string[] = [];

afterEach(async () => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir !== undefined) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

async function fixture(yaml: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "cli-validate-"));
  dirs.push(dir);
  const file = join(dir, "config.yaml");
  await writeFile(file, yaml);
  return file;
}

function runtime(env: Record<string, string> = {}): RuntimeDeps {
  return makeRuntime({ readEnv: (name) => env[name] });
}

describe("validateFile", () => {
  test("When a document matches the plugin schema then validateFile should print PASS with no error", async () => {
    const file = await fixture(`
name: model-providers
config:
  providers:
    my-provider:
      name: My Provider
`);
    const lines: string[] = [];
    const code = await validateFile(file, runtime(), (line) => lines.push(line));
    expect(lines).toEqual(["PASS: model-providers"]);
    expect(code).toBe(0);
  });

  test("When a document violates the schema then validateFile should print FAILED with the issue", async () => {
    const file = await fixture(`
name: model-providers
config:
  providers:
    my-provider:
      name: 42
`);
    const lines: string[] = [];
    const code = await validateFile(file, runtime(), (line) => lines.push(line));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^FAILED: model-providers: /);
    expect(code).toBe(1);
  });

  test("When a document name is not registered then validateFile should print FAILED with an unknown plugin error", async () => {
    const file = await fixture("name: not-a-plugin\nconfig: {}");
    const lines: string[] = [];
    const code = await validateFile(file, runtime(), (line) => lines.push(line));
    expect(lines).toEqual(["FAILED: not-a-plugin: unknown plugin name"]);
    expect(code).toBe(1);
  });

  test("When a document has no name then validateFile should print FAILED with the unknown name", async () => {
    const file = await fixture("config: {}");
    const lines: string[] = [];
    const code = await validateFile(file, runtime(), (line) => lines.push(line));
    expect(lines).toEqual(["FAILED: <unknown>: config document has no valid name"]);
    expect(code).toBe(1);
  });

  test("When yaml cannot be parsed then validateFile should print FAILED with the unknown name", async () => {
    const file = await fixture("key: [unclosed");
    const lines: string[] = [];
    const code = await validateFile(file, runtime(), (line) => lines.push(line));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^FAILED: <unknown>: /);
    expect(code).toBe(1);
  });

  test("When multiple documents are validated then validateFile should print one line per document in order", async () => {
    const file = await fixture(`
---
name: model-providers
config:
  providers: {}
---
name: not-a-plugin
config: {}
---
name: model-providers
config: 42
`);
    const lines: string[] = [];
    const code = await validateFile(file, runtime(), (line) => lines.push(line));
    expect(lines[0]).toBe("PASS: model-providers");
    expect(lines[1]).toBe("FAILED: not-a-plugin: unknown plugin name");
    expect(lines[2]).toMatch(/^FAILED: model-providers: /);
    expect(code).toBe(1);
  });

  test("When the file is empty of documents then validateFile should print nothing and exit 0", async () => {
    const file = await fixture("# just a comment\n");
    const lines: string[] = [];
    const code = await validateFile(file, runtime(), (line) => lines.push(line));
    expect(lines).toEqual([]);
    expect(code).toBe(0);
  });

  test("When a trailing separator yields a null document then validateFile should skip it", async () => {
    const file = await fixture("name: model-providers\nconfig:\n  providers: {}\n---\n");
    const lines: string[] = [];
    const code = await validateFile(file, runtime(), (line) => lines.push(line));
    expect(lines).toEqual(["PASS: model-providers"]);
    expect(code).toBe(0);
  });

  test("When a file reference points at a missing file then validateFile should fail the document", async () => {
    const file = await fixture(`
name: model-providers
config:
  providers:
    p:
      headers:
        X: $(file:missing.txt)
`);
    const lines: string[] = [];
    const code = await validateFile(file, runtime(), (line) => lines.push(line));
    expect(lines[0]).toMatch(/^FAILED: model-providers: /);
    expect(code).toBe(1);
  });

  test("When a file reference resolves then validateFile should validate the inserted content", async () => {
    const file = await fixture(`
name: model-providers
config:
  providers:
    p:
      headers:
        X: $(file:token.txt)
`);
    const dir = file.replace(/\/[^/]*$/, "");
    await writeFile(join(dir, "token.txt"), "abc123");
    const lines: string[] = [];
    const code = await validateFile(file, runtime(), (line) => lines.push(line));
    expect(lines).toEqual(["PASS: model-providers"]);
    expect(code).toBe(0);
  });

  test("When an env reference is unset then validateFile should keep the raw reference and still pass", async () => {
    const file = await fixture(`
name: model-providers
config:
  providers:
    p:
      headers:
        X: $(env:SOME_TOKEN)
`);
    const lines: string[] = [];
    const code = await validateFile(file, runtime(), (line) => lines.push(line));
    expect(lines).toEqual(["PASS: model-providers"]);
    expect(code).toBe(0);
  });

  test("When an env reference is set then validateFile should insert the value", async () => {
    const file = await fixture(`
name: model-providers
config:
  providers:
    p:
      headers:
        X: prefix-$(env:SOME_TOKEN)-suffix
`);
    const lines: string[] = [];
    const code = await validateFile(file, runtime({ SOME_TOKEN: "abc" }), (line) =>
      lines.push(line),
    );
    expect(lines).toEqual(["PASS: model-providers"]);
    expect(code).toBe(0);
  });

  test("When an env reference is empty then validateFile should treat it as unset", async () => {
    const file = await fixture(`
name: model-providers
config:
  providers:
    p:
      headers:
        X: $(env:SOME_TOKEN)
`);
    const lines: string[] = [];
    const code = await validateFile(file, runtime({ SOME_TOKEN: "" }), (line) => lines.push(line));
    expect(lines).toEqual(["PASS: model-providers"]);
    expect(code).toBe(0);
  });

  test("When an unset env reference lands in a non-string field then validateFile should fail the schema check", async () => {
    const file = await fixture(`
name: model-providers
config:
  providers:
    p:
      models:
        m:
          limit:
            context: $(env:NOT_SET_ANYWHERE)
`);
    const lines: string[] = [];
    const code = await validateFile(file, runtime(), (line) => lines.push(line));
    expect(lines[0]).toMatch(/^FAILED: model-providers: /);
    expect(code).toBe(1);
  });

  test("When the config file is given as a relative path then validateFile should resolve it against the working directory", async () => {
    const file = await fixture("name: model-providers\nconfig:\n  providers: {}");
    const name = file.replace(/\/[^/]*$/, "");
    process.chdir(name);
    try {
      const lines: string[] = [];
      const code = await validateFile("config.yaml", runtime(), (line) => lines.push(line));
      expect(lines).toEqual(["PASS: model-providers"]);
      expect(code).toBe(0);
    } finally {
      process.chdir("/");
    }
  });

  test("When the config file cannot be read then validateFile should raise an error", async () => {
    const deps = makeRuntime({
      fetcher: {
        fetch: async () => {
          throw new Error("no such file");
        },
      },
    });
    const lines: string[] = [];
    await expect(
      validateFile("/missing/config.yaml", deps, (line) => lines.push(line)).catch((error) => {
        lines.push(String(error));
        throw error;
      }),
    ).rejects.toThrow(/no such file/);
  });
});
