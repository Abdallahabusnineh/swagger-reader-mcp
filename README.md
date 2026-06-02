# Swagger Reader MCP

Read-only MCP server for searching live Swagger 2 and OpenAPI 3 JSON documents.
Give your AI coding agent access to the latest API paths, schemas, and fields
without copying backend documentation into every prompt.

The server runs locally through `npx`, fetches the configured Swagger document,
and exposes read-only inspection tools. It does not call product API operations.

## Requirements

- Node.js 20 or newer
- A Swagger 2 or OpenAPI 3 JSON URL
- An AI client that supports local MCP `stdio` servers

## Quick Start

For a public Swagger document, add this MCP server entry to your AI client's
configuration:

```json
{
  "mcpServers": {
    "swagger_reader": {
      "command": "npx",
      "args": ["-y", "swagger-reader-mcp"],
      "env": {
        "SWAGGER_URL": "https://api.example.com/openapi.json"
      }
    }
  }
}
```

That is all you need. Authentication settings are optional.

## Protected Swagger Documents

If the Swagger document requires authentication, add only the values required
by your project.

### Query Parameter

```json
{
  "mcpServers": {
    "swagger_reader": {
      "command": "npx",
      "args": ["-y", "swagger-reader-mcp"],
      "env": {
        "SWAGGER_URL": "https://api.example.com/docs-json",
        "SWAGGER_API_KEY_LOCATION": "query",
        "SWAGGER_API_KEY_NAME": "apiKey",
        "SWAGGER_API_KEY": "project-secret"
      }
    }
  }
}
```

### Header

```json
{
  "env": {
    "SWAGGER_URL": "https://api.example.com/openapi.json",
    "SWAGGER_API_KEY_LOCATION": "header",
    "SWAGGER_API_KEY_NAME": "X-API-Key",
    "SWAGGER_API_KEY": "project-secret"
  }
}
```

### Bearer Token

```json
{
  "env": {
    "SWAGGER_URL": "https://api.example.com/openapi.json",
    "SWAGGER_API_KEY_LOCATION": "bearer",
    "SWAGGER_API_KEY": "project-secret"
  }
}
```

Never commit real API keys to a shared repository.

## Cursor

Add the Quick Start JSON to one of these files:

- `~/.cursor/mcp.json` for all projects
- `.cursor/mcp.json` for one project

Cursor also accepts an explicit `type`:

```json
{
  "mcpServers": {
    "swagger_reader": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "swagger-reader-mcp"],
      "env": {
        "SWAGGER_URL": "https://api.example.com/openapi.json"
      }
    }
  }
}
```

Restart Cursor after editing the file.

## Codex

Add the server from a terminal:

```bash
codex mcp add swagger_reader \
  --env "SWAGGER_URL=https://api.example.com/openapi.json" \
  -- npx -y swagger-reader-mcp
```

Verify the installation:

```bash
codex mcp get swagger_reader
```

For a protected Swagger document, add the required authentication values:

```bash
codex mcp add swagger_reader \
  --env "SWAGGER_URL=https://api.example.com/docs-json" \
  --env "SWAGGER_API_KEY_LOCATION=query" \
  --env "SWAGGER_API_KEY_NAME=apiKey" \
  --env "SWAGGER_API_KEY=project-secret" \
  -- npx -y swagger-reader-mcp
```

## Claude Code

Add the server with one command:

```bash
claude mcp add-json --scope user swagger_reader \
  '{"type":"stdio","command":"npx","args":["-y","swagger-reader-mcp"],"env":{"SWAGGER_URL":"https://api.example.com/openapi.json"}}'
```

Verify the installation:

```bash
claude mcp get swagger_reader
```

## Claude Desktop

Open the Claude Desktop MCP configuration from **Settings > Developer > Edit
Config**, then add the Quick Start JSON and restart the app.

The configuration file is stored at:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

## Other AI Clients

Use the Quick Start JSON with any MCP client that supports local `stdio`
servers. The client must be able to run:

```bash
npx -y swagger-reader-mcp
```

Cloud-only integrations that require a remote HTTP URL cannot run this local
`stdio` package directly.

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `SWAGGER_URL` | Yes | Live Swagger or OpenAPI JSON URL. |
| `SWAGGER_API_KEY_LOCATION` | No | `none`, `query`, `header`, or `bearer`. Defaults to `none`. |
| `SWAGGER_API_KEY_NAME` | Conditional | Query parameter or header name for `query` and `header`. |
| `SWAGGER_API_KEY` | Conditional | Secret value for authenticated modes. |
| `SWAGGER_CACHE_TTL_MS` | No | In-memory cache duration. Defaults to `180000`. |

## Tools

| Tool | Purpose |
| --- | --- |
| `search_api` | Search paths, operation metadata, schemas, and schema fields. |
| `get_endpoint` | Return details for one path and optional HTTP method. |
| `get_schema` | Return one component schema by name. |
| `get_api_overview` | Return API metadata, endpoint count, schema count, tags, and cache details. |
| `refresh_api_spec` | Bypass the cache and fetch the latest Swagger document immediately. |

Ask your agent to refresh the spec after backend changes:

```text
Use refresh_api_spec, then search for the updated subscription endpoint.
```

## Local Execution

```bash
SWAGGER_URL=https://api.example.com/openapi.json npx -y swagger-reader-mcp
```

The process communicates through MCP JSON-RPC over standard input and output.
Normally, your AI client starts and manages it for you.

## Development

Run the tests:

```bash
npm test
```

Preview the npm package contents:

```bash
npm pack --dry-run
```
