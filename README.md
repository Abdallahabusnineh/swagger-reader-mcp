# Swagger Reader MCP

Read-only local MCP server for searching the latest Swagger 2 or OpenAPI 3 JSON
contract. It exposes endpoint and schema inspection without calling product API
operations.

## Requirements

- Node.js 20 or newer
- A Swagger or OpenAPI JSON URL

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `SWAGGER_URL` | Yes | Live Swagger or OpenAPI JSON URL. |
| `SWAGGER_API_KEY_LOCATION` | No | `none`, `query`, `header`, or `bearer`. Defaults to `none`. |
| `SWAGGER_API_KEY` | Conditional | Secret value for authenticated modes. |
| `SWAGGER_API_KEY_NAME` | Conditional | Query parameter or header name for `query` and `header`. |
| `SWAGGER_CACHE_TTL_MS` | No | In-memory cache duration. Defaults to `180000`. |

Keep secrets in a local ignored environment file or your shell environment.
Never commit them.

### No Authentication

```text
SWAGGER_URL=https://api.example.com/openapi.json
SWAGGER_API_KEY_LOCATION=none
```

### Query Parameter

```text
SWAGGER_URL=https://api.example.com/docs-json
SWAGGER_API_KEY_LOCATION=query
SWAGGER_API_KEY_NAME=apiKey
SWAGGER_API_KEY=local-secret
```

### Header

```text
SWAGGER_URL=https://api.example.com/openapi.json
SWAGGER_API_KEY_LOCATION=header
SWAGGER_API_KEY_NAME=X-API-Key
SWAGGER_API_KEY=local-secret
```

### Bearer Token

```text
SWAGGER_URL=https://api.example.com/openapi.json
SWAGGER_API_KEY_LOCATION=bearer
SWAGGER_API_KEY=local-secret
```

## Tools

| Tool | Purpose |
| --- | --- |
| `search_api` | Search paths, operation metadata, schemas, and schema fields. |
| `get_endpoint` | Return details for one path and optional HTTP method. |
| `get_schema` | Return one component schema by name. |
| `get_api_overview` | Return metadata, endpoint count, schema count, tags, and cache details. |
| `refresh_api_spec` | Bypass the cache and fetch the newest OpenAPI document. |

## Local Execution

```bash
set -a
source .env.swagger
set +a
node bin/swagger-reader-mcp.mjs
```

Run tests:

```bash
npm test
```

## Codex

Forward shell environment variables to the package:

```toml
[mcp_servers.swagger_reader]
command = "npx"
args = ["-y", "@scope/swagger-reader-mcp"]
env_vars = [
  "SWAGGER_URL",
  "SWAGGER_API_KEY_LOCATION",
  "SWAGGER_API_KEY_NAME",
  "SWAGGER_API_KEY",
  "SWAGGER_CACHE_TTL_MS",
]
```

For a project-local checkout, point `command` and `args` to a wrapper script
that loads an ignored environment file before starting
`bin/swagger-reader-mcp.mjs`.

## Claude Code

Load the environment variables in your shell, then run:

```bash
claude mcp add --transport stdio --scope local swagger_reader -- \
  npx -y @scope/swagger-reader-mcp
```

Verify:

```bash
claude mcp list
```

## Cursor

Create `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "swagger_reader": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@scope/swagger-reader-mcp"],
      "envFile": "${workspaceFolder}/.env.swagger"
    }
  }
}
```

## Publication

Before npm publication, remove `"private": true` from `package.json`, choose an
available package scope and name, and publish from this package directory.

Until then, the package can run from a local checkout or a standalone GitHub
repository checkout. The consuming project supplies its own local environment
variables. Do not bundle project secrets in the package.
