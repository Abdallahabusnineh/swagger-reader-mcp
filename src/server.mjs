import { createInterface } from "node:readline";

import { createRequestDescriptor, readConfig } from "./config.mjs";
import { OpenApiCatalog } from "./openapi_catalog.mjs";

const SERVER_NAME = "swagger-reader";
const SERVER_VERSION = "0.1.0";
const DEFAULT_PROTOCOL_VERSION = "2025-06-18";

export const tools = [
  {
    name: "search_api",
    description:
      "Search the latest OpenAPI paths, operation metadata, schemas, and schema fields.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description:
            "Text to search for, such as an endpoint path, feature name, operation ID, DTO, or field.",
        },
      },
    },
  },
  {
    name: "get_endpoint",
    description:
      "Read the latest OpenAPI details for one endpoint path and optional HTTP method.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["path"],
      properties: {
        path: {
          type: "string",
          description: "Exact OpenAPI path, such as /subscriptions.",
        },
        method: {
          type: "string",
          description: "Optional HTTP method, such as get or post.",
        },
      },
    },
  },
  {
    name: "get_schema",
    description: "Read one schema from the latest OpenAPI components.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: {
        name: {
          type: "string",
          description: "Exact component schema name.",
        },
      },
    },
  },
  {
    name: "get_api_overview",
    description:
      "Read metadata and counts from the latest OpenAPI document, including cache freshness.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: "refresh_api_spec",
    description:
      "Immediately fetch the latest OpenAPI document and replace the short-lived in-memory cache.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
];

export function createToolHandlers(catalog) {
  return {
    search_api: ({ query }) => catalog.search(query),
    get_endpoint: ({ path, method }) => catalog.getEndpoint(path, method),
    get_schema: ({ name }) => catalog.getSchema(name),
    get_api_overview: () => catalog.getOverview(),
    refresh_api_spec: () => catalog.refresh(),
  };
}

function toTextContent(value) {
  return [
    {
      type: "text",
      text: JSON.stringify(value, null, 2),
    },
  ];
}

function sanitizeError(error, secrets = []) {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of secrets.filter(Boolean)) {
    message = message.replaceAll(secret, "[REDACTED]");
  }
  return message;
}

export function createRequestHandler({ catalog, secrets = [] }) {
  const handlers = createToolHandlers(catalog);

  return async function handleRequest(request) {
    switch (request.method) {
      case "initialize":
        return {
          protocolVersion:
            request.params?.protocolVersion ?? DEFAULT_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          instructions:
            "Use this read-only server to inspect the latest Swagger or OpenAPI contract before backend-backed feature work. Call refresh_api_spec when the backend changed recently or an expected endpoint, DTO, or field is missing.",
        };
      case "notifications/initialized":
        return undefined;
      case "ping":
        return {};
      case "tools/list":
        return { tools };
      case "tools/call": {
        const toolName = request.params?.name;
        const handler = handlers[toolName];
        if (!handler) {
          return {
            content: toTextContent(`Unknown tool: ${toolName}`),
            isError: true,
          };
        }

        try {
          return {
            content: toTextContent(
              await handler(request.params?.arguments ?? {}),
            ),
          };
        } catch (error) {
          return {
            content: toTextContent(sanitizeError(error, secrets)),
            isError: true,
          };
        }
      }
      default:
        throw new Error(`Unsupported MCP method: ${request.method}`);
    }
  };
}

export function startServer({
  input = process.stdin,
  output = process.stdout,
  env = process.env,
} = {}) {
  const config = readConfig(env);
  const catalog = new OpenApiCatalog({
    requestDescriptor: createRequestDescriptor(config),
    secrets: [config.apiKey],
    cacheTtlMs: config.cacheTtlMs,
  });
  const handleRequest = createRequestHandler({
    catalog,
    secrets: [config.apiKey],
  });
  const lines = createInterface({ input, crlfDelay: Infinity });

  lines.on("line", async (line) => {
    if (!line.trim()) {
      return;
    }

    let request;
    try {
      request = JSON.parse(line);
      const result = await handleRequest(request);
      if (request.id === undefined || result === undefined) {
        return;
      }
      output.write(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, result })}\n`);
    } catch (error) {
      if (request?.id === undefined) {
        return;
      }
      output.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32603,
            message: sanitizeError(error, [config.apiKey]),
          },
        })}\n`,
      );
    }
  });
}
