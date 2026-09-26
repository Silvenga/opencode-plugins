import { run } from "./run.js";

const code = await run(
  process.argv.slice(2),
  {
    out: (chunk) => process.stdout.write(chunk),
    err: (chunk) => process.stderr.write(chunk),
  },
  { version: CLI_VERSION },
);

process.exitCode = code;

declare const CLI_VERSION: string;
