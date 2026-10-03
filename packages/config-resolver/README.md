# @slvnco-opencode/config-resolver

Load shared plugin configuration from local or remote YAML files, with environment and file references and a cached fallback.

## Configuration

Add to `opencode.jsonc` before plugins that consume shared configuration:

```jsonc
{
  "plugins": [
    {
      "package": "@slvnco-opencode/config-resolver",
      "options": {
        // Each file may contain one or more YAML documents.
        "paths": [
          "https://infer.service.garland.slvn.co/.well-known/slvn-opencode/config.yaml"
        ]
      }
    }
  ]
}
```
