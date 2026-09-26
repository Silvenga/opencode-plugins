import type { Plugin } from "@opencode/plugin";

type PluginArg = Parameters<typeof Plugin.define>[0];

/** OpenCode v2 plugin Context, derived from the public entrypoint. */
type Context = PluginArg extends { setup: (ctx: infer C) => unknown } ? C : never;

type ProviderDomain = Context extends { provider: infer P } ? P : never;
type IntegrationDomain = Context extends { integration: infer I } ? I : never;
type TransformInput<T> = T extends {
  transform: (callback: (input: infer I) => void) => Promise<unknown>;
}
  ? I
  : never;

/** The editor passed to provider transforms: the full ProviderEditor surface. */
export type ProviderEditor = TransformInput<ProviderDomain>;

/** The editor passed to integration transforms: the full IntegrationEditor surface. */
export type IntegrationEditor = TransformInput<IntegrationDomain>;
