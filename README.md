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

## Add to a Project

Create a local ignored environment file such as `.env.swagger`:

```text
SWAGGER_URL=https://api.example.com/openapi.json
SWAGGER_API_KEY_LOCATION=none
```

Use one of the client-specific configurations below. Keep `.env.swagger`
outside version control.

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
args = ["-y", "swagger-reader-mcp"]
env_vars = [
  "SWAGGER_URL",
  "SWAGGER_API_KEY_LOCATION",
  "SWAGGER_API_KEY_NAME",
  "SWAGGER_API_KEY",
  "SWAGGER_CACHE_TTL_MS",
]
```

Load `.env.swagger` in your shell before starting Codex, or use a small
project-local wrapper script that sources the ignored file before running
`npx -y swagger-reader-mcp`.

### Codex Project Wrapper

Add `.env.swagger` to the consuming project's `.gitignore`, then create
`tool/run-swagger-reader-mcp.sh`:

```sh
#!/bin/sh
set -eu

repo_root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

set -a
. "$repo_root/.env.swagger"
set +a

exec npx -y swagger-reader-mcp
```

Point the project's `.codex/config.toml` at the wrapper:

```toml
[mcp_servers.swagger_reader]
command = "/bin/sh"
args = ["tool/run-swagger-reader-mcp.sh"]
enabled = true
```

## Claude Code

Load the environment variables in your shell, then run:

```bash
claude mcp add --transport stdio --scope local swagger_reader -- \
  npx -y swagger-reader-mcp
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
      "args": ["-y", "swagger-reader-mcp"],
      "envFile": "${workspaceFolder}/.env.swagger"
    }
  }
}
```

## Pre-Publish Verification

Test the package exactly as an installed MCP before publishing:

```bash
mkdir -p /tmp/swagger-reader-npm-cache /tmp/swagger-reader-pack
npm_config_cache=/tmp/swagger-reader-npm-cache \
  npm pack --pack-destination /tmp/swagger-reader-pack

set -a
source .env.swagger
set +a
npx --yes \
  --package=/tmp/swagger-reader-pack/swagger-reader-mcp-0.1.0.tgz \
  swagger-reader-mcp
```

## Publication

Publish from this package directory only after the tests and tarball smoke test
pass:

```bash
npm login
npm whoami
npm publish --access public
```

The consuming project supplies its own local environment variables. Do not
bundle project secrets in the package.
