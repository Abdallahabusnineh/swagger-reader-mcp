import assert from "node:assert/strict";
import test from "node:test";

import {
  createRequestHandler,
  createToolHandlers,
  tools,
} from "../src/server.mjs";

test("exposes only read-only Swagger tools", () => {
  assert.deepEqual(
    tools.map((tool) => tool.name),
    [
      "search_api",
      "get_endpoint",
      "get_schema",
      "get_api_overview",
      "refresh_api_spec",
    ],
  );
});

test("dispatches all Swagger tools to the catalog", async () => {
  const calls = [];
  const handlers = createToolHandlers({
    search: async (query) => calls.push(["search", query]),
    getEndpoint: async (path, method) =>
      calls.push(["getEndpoint", path, method]),
    getSchema: async (name) => calls.push(["getSchema", name]),
    getOverview: async () => calls.push(["getOverview"]),
    refresh: async () => calls.push(["refresh"]),
  });

  await handlers.search_api({ query: "wallet" });
  await handlers.get_endpoint({ path: "/wallet", method: "get" });
  await handlers.get_schema({ name: "WalletDto" });
  await handlers.get_api_overview({});
  await handlers.refresh_api_spec({});

  assert.deepEqual(calls, [
    ["search", "wallet"],
    ["getEndpoint", "/wallet", "get"],
    ["getSchema", "WalletDto"],
    ["getOverview"],
    ["refresh"],
  ]);
});

test("initializes as the generic Swagger reader", async () => {
  const handler = createRequestHandler({ catalog: {}, secrets: [] });
  const result = await handler({
    method: "initialize",
    params: { protocolVersion: "2025-06-18" },
  });

  assert.equal(result.serverInfo.name, "swagger-reader");
  assert.deepEqual(result.capabilities, { tools: { listChanged: false } });
});

test("redacts configured secrets from tool errors", async () => {
  const handler = createRequestHandler({
    catalog: {
      async search() {
        throw new Error("Failed with local-test-secret");
      },
    },
    secrets: ["local-test-secret"],
  });
  const result = await handler({
    method: "tools/call",
    params: { name: "search_api", arguments: { query: "wallet" } },
  });

  assert.equal(result.isError, true);
  assert.equal(result.content[0].text.includes("local-test-secret"), false);
  assert.equal(result.content[0].text.includes("[REDACTED]"), true);
});
