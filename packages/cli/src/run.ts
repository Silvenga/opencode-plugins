import { Command } from "commander";
import type { Output } from "./output.js";
import { exportSchemaVerb } from "./verbs/export-schema/verb.js";
import { validateVerb } from "./verbs/validate/verb.js";

export interface RunOptions {
  readonly version: string;
}

export function run(
  argv: ReadonlyArray<string>,
  output: Output,
  options: RunOptions,
): Promise<number> {
  const program = new Command();
  program
    .name("cli")
    .description("Validate OpenCode plugin configuration files")
    .version(options.version)
    .showHelpAfterError()
    .exitOverride();

  let exitCode = 0;

  program
    .command("validate")
    .description("validate a YAML config file against the plugin schema registry")
    .argument("<config-file>", "path to the YAML config file")
    .allowExcessArguments(false)
    .exitOverride()
    .action(async (file: string) => {
      exitCode = await validateVerb(file, output);
    });

  program
    .command("export-schema")
    .description("write the unified JSON schema to stdout")
    .allowExcessArguments(false)
    .exitOverride()
    .action(() => {
      exportSchemaVerb(output);
    });

  const sinks = {
    writeOut: output.out,
    writeErr: output.err,
  };
  program.configureOutput(sinks);
  for (const command of program.commands) {
    command.configureOutput(sinks);
  }

  return program.parseAsync(argv, { from: "user" }).then(
    () => exitCode,
    (error: unknown) => {
      if (isCommanderSignal(error)) {
        return error.exitCode ?? 1;
      }
      output.err(`error: ${error instanceof Error ? error.message : String(error)}\n`);
      return 1;
    },
  );
}

interface CommanderSignal extends Error {
  readonly code: string;
  readonly exitCode?: number;
}

function isCommanderSignal(error: unknown): error is CommanderSignal {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code.startsWith("commander.")
  );
}
