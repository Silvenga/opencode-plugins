export interface Options {
  readonly minTokens: number;
}

export function parseOptions(
  options: Readonly<Record<string, unknown>> | undefined | null,
): Options {
  const raw = options?.minTokens;
  const minTokens = typeof raw === "number" && Number.isInteger(raw) && raw > 0 ? raw : 400;
  return { minTokens };
}
