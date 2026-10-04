export function parseOptions(options: Readonly<Record<string, unknown>>): {
  paths: string[];
  timeoutMs: number;
  vars: Record<string, string>;
} {
  const rawPaths = options.paths;
  const paths = Array.isArray(rawPaths)
    ? rawPaths.filter((path): path is string => typeof path === "string")
    : [];
  const rawTimeout = options.timeoutMs;
  const timeoutMs =
    typeof rawTimeout === "number" && Number.isFinite(rawTimeout) && rawTimeout > 0
      ? rawTimeout
      : 5000;
  const vars = isVars(options.vars) ? options.vars : {};
  return { paths, timeoutMs, vars };
}

function isVars(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}
