# @slvnco-opencode/model-providers

Add or customize OpenCode providers and models using shared configuration and local overrides.

## Configuration

Add to `opencode.jsonc`. Local options override shared configuration from `config-resolver`, when available:

```jsonc
{
  "plugins": [
    {
      "package": "@slvnco-opencode/model-providers",
      "options": {
        "providers": {
          "custom-provider": {
            "name": "Custom Provider"
          }
        }
      }
    }
  ]
}
```

## Authentication

By default, `@slvnco-opencode/model-providers` will register an integration for each provider configured.

```bash
oc2 auth login custom-provider
```
