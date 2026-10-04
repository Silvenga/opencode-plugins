# @slvnco-opencode/plugins

My personal OpenCode stack - custom plugins for my fleet of agents.

## Plugins

### @slvnco-opencode/config-resolver

Provides centralized configuration resolution for other slvnco-opencode plugins.

```jsonc
{
  "plugins": [
    {
      "package": "@slvnco-opencode/config-resolver",
      "options": {
        // Accepts a list of one or YAML documents.
        "paths": [
          "https://infer.service.garland.slvn.co/.well-known/slvn-opencode/config.yaml"
        ]
      }
    }
  ]
}
```

### @slvnco-opencode/model-providers

Configures providers/models and registers integrations to support OpenCode managed auth.

```jsonc
{
  "plugins": [
    "@slvnco-opencode/model-providers"
  ]
}
```

### @slvnco-opencode/mcp-servers

Configures MCP servers.

```jsonc
{
  "plugins": [
    "@slvnco-opencode/mcp-servers"
  ]
}
```
