import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { run } from "./run.js";

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
  const dir = await mkdtemp(join(tmpdir(), "cli-run-"));
  dirs.push(dir);
  const file = join(dir, "config.yaml");
  await writeFile(file, yaml);
  return file;
}

interface Captured {
  out: string[];
  err: string[];
}

function capture(): Captured {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err };
}

async function exec(captured: Captured, argv: string[]): Promise<number> {
  return run(
    argv,
    {
      out: (chunk) => captured.out.push(chunk),
      err: (chunk) => captured.err.push(chunk),
    },
    { version: "0.1.0" },
  );
}

describe("run", () => {
  test("When no verb is given then run should print help to stderr and exit 1", async () => {
    const c = capture();
    expect(await exec(c, [])).toBe(1);
    expect(c.out).toEqual([]);
    expect(c.err.join("\n")).toMatch(/Usage: cli/);
    expect(c.err.join("\n")).toMatch(/validate/);
    expect(c.err.join("\n")).toMatch(/export-schema/);
  });

  test("When --help is given then run should print help to stdout and exit 0", async () => {
    const c = capture();
    expect(await exec(c, ["--help"])).toBe(0);
    expect(c.err).toEqual([]);
    expect(c.out.join("\n")).toMatch(/Usage: cli/);
    expect(c.out.join("\n")).toMatch(/validate/);
  });

  test("When --version is given then run should print the CLI version to stdout and exit 0", async () => {
    const c = capture();
    expect(await exec(c, ["--version"])).toBe(0);
    expect(c.out.length).toBe(1);
    expect(c.out[0]).toMatch(/^[0-9]+\.[0-9]+\.[0-9]+/);
  });

  test("When an unknown verb is given then run should print an error to stderr and exit 1", async () => {
    const c = capture();
    expect(await exec(c, ["bogus"])).toBe(1);
    expect(c.out).toEqual([]);
    expect(c.err.join("\n")).toMatch(/unknown command/);
  });

  test("When validate runs without a file argument then run should print an error to stderr and exit 1", async () => {
    const c = capture();
    expect(await exec(c, ["validate"])).toBe(1);
    expect(c.err.join("\n")).toMatch(/missing required argument/);
  });

  test("When validate gets extra arguments then run should print an error to stderr and exit 1", async () => {
    const c = capture();
    expect(await exec(c, ["validate", "a", "b"])).toBe(1);
    expect(c.err.join("\n")).toMatch(/too many arguments/);
  });

  test("When validate runs on a passing file then run should print the pass line to stdout and exit 0", async () => {
    const file = await fixture("name: model-providers\nconfig:\n  providers: {}");
    const c = capture();
    expect(await exec(c, ["validate", file])).toBe(0);
    expect(c.out.join("")).toBe("PASS: model-providers\n");
    expect(c.err).toEqual([]);
  });

  test("When validate runs on a failing file then run should print the failed line and exit 1", async () => {
    const file = await fixture("name: model-providers\nconfig: 42");
    const c = capture();
    expect(await exec(c, ["validate", file])).toBe(1);
    expect(c.out[0]).toMatch(/^FAILED: model-providers: /);
  });

  test("When validate runs on an unreadable file then run should print an error to stderr and exit 1", async () => {
    const c = capture();
    expect(await exec(c, ["validate", "/missing/config.yaml"])).toBe(1);
    expect(c.out).toEqual([]);
    expect(c.err.join("\n")).toMatch(/error:/);
  });

  test("When export-schema runs then run should print the unified schema and exit 0", async () => {
    const c = capture();
    expect(await exec(c, ["export-schema"])).toBe(0);
    const schema = JSON.parse(c.out.join("\n"));
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(Array.isArray(schema.oneOf)).toBe(true);
  });

  test("When export-schema gets extra arguments then run should print an error to stderr and exit 1", async () => {
    const c = capture();
    expect(await exec(c, ["export-schema", "extra"])).toBe(1);
    expect(c.err.join("\n")).toMatch(/too many arguments/);
  });

  test("When validate --help is given then run should print validate help and exit 0", async () => {
    const c = capture();
    expect(await exec(c, ["validate", "--help"])).toBe(0);
    expect(c.out.join("\n")).toMatch(/validate/);
  });
});
