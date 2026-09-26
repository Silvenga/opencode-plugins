# @slvnco-opencode/plugins

A pnpm workspace of independent plugins for OpenCode v2.

## Spec-Driven Design

Behavioral decisions live in `docs/<plugin-name>-spec.md`. Read the relevant spec before changing plugin behavior, and update it in the same change when behavior changes. `docs/AGENTS.md` defines the spec conventions.

## Development Conventions

- Use package scope is `@slvnco-opencode` for new packages.
- Write the minimal tests required to prove the functionality matches the spec.
    - Tests live next to source: `src/foo.ts` pairs with `src/foo.test.ts`.
    - Test names follow `When <condition> then <action> should <expected>` in Arrange-Act-Assert form.
    - When changing behavior, update the code using TDD. Create the tests for the new behavior and stub the relevant code. Confirm the tests are red. Implement the code. Confirm the tests are now green.
    - For the purpose of testability, use a think glue layer for injectable units (e.g., file system, network, process access, etc.) - i.e., `runtime.ts`. If logic cannot be unit-tested without a server, the plugin's shape is wrong.
- Commits follow Conventional Commits, single line, American English. Do not commit unless asked.
- Do not run opencode binaries during development; they may conflict with a running instance.
    - The dev harness (`pnpm run dev`) is for the user to run manually.

## OpenCode Plugin Conventions

- Plugin IDs use `slvn-opencode.<plugin-name>`.
- Fail open. A plugin must never block usage of OpenCode.
- Do not call async functions within the transform closure.

Plugins should be independent and may be loaded in any order.

The `@slvnco-opencode/config-resolver` is a shared plugin and provides central configuration management using RPC (`getConfig`). The `config-resolver` is assumed to be setup first (meaning, will be accessible to all other plugins).Within the context of a separate plugin, do not assume `config-resolver` is providing configurations (was loaded previously, or will be loaded at all), each plugin should support configuration independently as a fallback.

Before starting work, make you've read at least once:

- https://github.com/anomalyco/opencode/raw/refs/heads/v2/services/www/src/docs/content/build/plugins/index.mdx
- https://raw.githubusercontent.com/anomalyco/opencode/refs/heads/v2/services/www/src/docs/content/build/plugins/rpc.mdx

## Validation

- Run `pnpm fmt` after editing/creating any file.
- Run `pnpm lint` and `pnpm test` after editing/creating a ts file.
