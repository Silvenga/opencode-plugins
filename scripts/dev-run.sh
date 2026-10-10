#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
ROOT="$(dirname "$SCRIPT_DIR")"
DIST="$ROOT/dist"
CACHE="$ROOT/node_modules/.opencode-cache"
CONFIG_DIR="$SCRIPT_DIR/config"
STATE="$CONFIG_DIR/.state"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi

OPENCODE_VERSION="${OPENCODE_VERSION:-2.0.22}"
OPENCODE_URL="https://opencode.ai/files/bin/$OPENCODE_VERSION/opencode-linux-x64.tar.gz"

if [ ! -f "$CACHE/opencode" ]; then
  mkdir -p "$CACHE"
  echo "Downloading opencode v$OPENCODE_VERSION..."
  curl -fsSL "$OPENCODE_URL" -o "$CACHE/opencode.tar.gz"
  tar -xzf "$CACHE/opencode.tar.gz" -C "$CACHE"
  rm -f "$CACHE/opencode.tar.gz"
fi

"$CACHE/opencode" --version

rm -rf "$DIST"
for pkg in "$ROOT"/packages/*/; do
  name="$(basename "$pkg")"
  pnpm_config_inject_workspace_packages=true pnpm deploy --filter="@slvnco-opencode/$name" --prod "$DIST/$name"
  printf 'export { default } from "./src/index.js";\n' > "$DIST/$name/index.ts"
  if [ -f "$pkg/src/tui.ts" ]; then
    printf 'export { default } from "./src/tui.js";\n' > "$DIST/$name/tui.ts"
  fi
  if [ -f "$pkg/src/rpc/contract.ts" ]; then
    printf 'export * from "./src/rpc/contract.js";\n' > "$DIST/$name/rpc.ts"
  fi
done

mkdir -p "$STATE"
export OPENCODE_CONFIG_DIR="$STATE"
export SLVN_DEV_CONFIG="$CONFIG_DIR/example.yaml"

cat > "$STATE/opencode.jsonc" <<JSON
{
  "\$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "file://$DIST/config-resolver",
      "options": {
        "paths": [
          "https://infer.service.garland.slvn.co/.well-known/slvn-opencode/config.yaml",
          "\$(env:SLVN_DEV_CONFIG)"
        ]
      }
    },
    {
      "package": "file://$DIST/model-providers",
      "options": {}
    },
    {
      "package": "file://$DIST/mcp-servers",
      "options": {}
    },
    {
      "package": "file://$DIST/context-trim",
      "options": {}
    }
  ]
}
JSON

if [ $# -eq 0 ]; then
  exec "$CACHE/opencode" --standalone
fi
exec "$CACHE/opencode" "$@"
