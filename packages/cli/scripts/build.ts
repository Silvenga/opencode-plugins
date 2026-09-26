import { readFileSync } from "node:fs";
import { build } from "esbuild";

const version = JSON.parse(readFileSync("package.json", "utf8")).version as string;

await build({
  entryPoints: ["src/cli.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outfile: "dist/cli.mjs",
  define: {
    CLI_VERSION: JSON.stringify(version),
  },
  banner: {
    js: [
      "#!/usr/bin/env node",
      "import { createRequire } from 'node:module';",
      "const require = createRequire(import.meta.url);",
    ].join("\n"),
  },
});
