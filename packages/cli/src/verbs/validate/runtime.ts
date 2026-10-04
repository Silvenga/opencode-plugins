import {
  makeFileProvider,
  nodeFetcher,
  type Fetcher,
  type ReferenceProvider,
  resolvePath,
} from "@slvnco-opencode/config-resolver/cli";

export interface RuntimeDeps {
  readonly fetcher: Fetcher;
  readonly homedir: () => string | undefined;
  readonly readEnv: (name: string) => string | undefined;
}

const DEFAULT_TIMEOUT_MS = 5000;

export function makeRuntime(overrides: Partial<RuntimeDeps> = {}): RuntimeDeps {
  return {
    fetcher: nodeFetcher,
    homedir: () => {
      const home = process.env.HOME;
      return home === undefined || home.length === 0 ? undefined : home;
    },
    readEnv: (name) => process.env[name],
    ...overrides,
  };
}

export function makeLenientEnvProvider(
  readEnv: (name: string) => string | undefined,
): ReferenceProvider {
  return {
    resolve: async (input) => {
      const value = readEnv(input);
      if (value === undefined || value.length === 0) {
        return `$(env:${input})`;
      }
      return value;
    },
  };
}

export function makeReferenceProviders(deps: RuntimeDeps): {
  file: ReferenceProvider;
  env: ReferenceProvider;
  var: ReferenceProvider;
} {
  return {
    file: makeFileProvider(deps.fetcher, DEFAULT_TIMEOUT_MS, deps.homedir),
    env: makeLenientEnvProvider(deps.readEnv),
    var: { resolve: async (input) => `$(var:${input})` },
  };
}

export function toLocalTarget(raw: string): { kind: "local"; path: string } {
  const home = () => {
    const h = process.env.HOME;
    return h === undefined || h.length === 0 ? undefined : h;
  };
  const input = raw.startsWith("/") || raw.startsWith("~") ? raw : `${process.cwd()}/${raw}`;
  const target = resolvePath(input, home);
  if (target.kind !== "local") {
    throw new Error(`remote paths are not supported for validation: ${target.url}`);
  }
  return target;
}
