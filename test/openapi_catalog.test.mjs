import assert from "node:assert/strict";
import test from "node:test";

import { OpenApiCatalog } from "../src/openapi_catalog.mjs";

const secret = "local-test-secret";

function createSpec({ suffix = "" } = {}) {
  return {
    openapi: "3.0.0",
    info: { title: `Example${suffix}`, version: "1.0.0" },
    tags: [{ name: "Subscription" }],
    paths: {
      "/subscriptions": {
        get: {
          operationId: "SubscriptionController_findAll",
          summary: "List subscriptions",
          tags: ["Subscription"],
          responses: {
            200: {
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/SubscriptionDto" },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        SubscriptionDto: {
          type: "object",
          properties: {
            paidAmount: { type: "number" },
          },
        },
      },
    },
  };
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

function createCatalog(overrides = {}) {
  return new OpenApiCatalog({
    requestDescriptor: {
      url: new URL("https://example.com/openapi.json"),
      options: { headers: { Authorization: `Bearer ${secret}` } },
    },
    secrets: [secret],
    fetchImpl: async () => jsonResponse(createSpec()),
    ...overrides,
  });
}

test("requires a Swagger request descriptor", () => {
  assert.throws(
    () => new OpenApiCatalog({}),
    /A Swagger request descriptor is required/,
  );
});

test("fetches the configured URL and options", async () => {
  const catalog = createCatalog({
    fetchImpl: async (url, options) => {
      assert.equal(url.href, "https://example.com/openapi.json");
      assert.deepEqual(options, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      return jsonResponse(createSpec());
    },
  });

  await catalog.getOverview();
});

test("reuses the live document within the cache TTL", async () => {
  let fetchCount = 0;
  const catalog = createCatalog({
    fetchImpl: async () => {
      fetchCount += 1;
      return jsonResponse(createSpec());
    },
    now: () => 1_000,
  });

  await catalog.getOverview();
  await catalog.search("subscription");

  assert.equal(fetchCount, 1);
});

test("reloads the live document after the cache TTL expires", async () => {
  let fetchCount = 0;
  let now = 1_000;
  const catalog = createCatalog({
    fetchImpl: async () => {
      fetchCount += 1;
      return jsonResponse(createSpec({ suffix: String(fetchCount) }));
    },
    cacheTtlMs: 100,
    now: () => now,
  });

  await catalog.getOverview();
  now = 1_101;
  const overview = await catalog.getOverview();

  assert.equal(fetchCount, 2);
  assert.equal(overview.info.title, "Example2");
});

test("forced refresh bypasses the in-memory cache", async () => {
  let fetchCount = 0;
  const catalog = createCatalog({
    fetchImpl: async () => {
      fetchCount += 1;
      return jsonResponse(createSpec({ suffix: String(fetchCount) }));
    },
  });

  await catalog.getOverview();
  const refreshed = await catalog.refresh();

  assert.equal(fetchCount, 2);
  assert.equal(refreshed.info.title, "Example2");
});

test("searches endpoints and schema fields", async () => {
  const catalog = createCatalog();

  assert.equal((await catalog.search("subscriptions")).endpoints.length, 1);
  assert.equal(
    (await catalog.search("paidAmount")).schemas[0].name,
    "SubscriptionDto",
  );
});

test("returns endpoint, schema, and overview details", async () => {
  const catalog = createCatalog();

  assert.equal(
    (await catalog.getEndpoint("/subscriptions", "get")).method,
    "get",
  );
  assert.equal(
    (await catalog.getSchema("SubscriptionDto")).properties.paidAmount.type,
    "number",
  );
  assert.equal((await catalog.getOverview()).endpointCount, 1);
});

test("supports Swagger 2 definitions", async () => {
  const catalog = createCatalog({
    fetchImpl: async () =>
      jsonResponse({
        swagger: "2.0",
        info: { title: "Legacy API", version: "1.0.0" },
        paths: {
          "/legacy-subscriptions": {
            get: {
              operationId: "LegacySubscriptionController_findAll",
              responses: { 200: { description: "OK" } },
            },
          },
        },
        definitions: {
          LegacySubscriptionDto: {
            type: "object",
            properties: {
              paidAmount: { type: "number" },
            },
          },
        },
      }),
  });

  assert.equal(
    (await catalog.getSchema("LegacySubscriptionDto")).properties.paidAmount
      .type,
    "number",
  );
  assert.equal(
    (await catalog.search("paidAmount")).schemas[0].name,
    "LegacySubscriptionDto",
  );
  assert.equal((await catalog.getOverview()).swagger, "2.0");
});

test("rejects missing endpoints and schemas", async () => {
  const catalog = createCatalog();

  await assert.rejects(
    () => catalog.getEndpoint("/missing"),
    /Endpoint path not found/,
  );
  await assert.rejects(
    () => catalog.getSchema("MissingDto"),
    /Schema not found/,
  );
});

test("rejects invalid JSON responses", async () => {
  const catalog = createCatalog({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        throw new Error(secret);
      },
    }),
  });

  await assert.rejects(() => catalog.getOverview(), /not valid JSON/);
});

test("rejects invalid documents without leaking secrets", async () => {
  const catalog = createCatalog({
    fetchImpl: async () => jsonResponse({ message: secret }),
  });

  await assert.rejects(
    () => catalog.getOverview(),
    (error) =>
      !error.message.includes(secret) && error.message.includes("OpenAPI"),
  );
});

test("rejects backend errors without leaking secrets", async () => {
  const catalog = createCatalog({
    fetchImpl: async () =>
      jsonResponse({ message: secret }, { ok: false, status: 403 }),
  });

  await assert.rejects(
    () => catalog.getOverview(),
    (error) =>
      !error.message.includes(secret) &&
      error.message.includes("status 403"),
  );
});

test("rejects connection failures without leaking secrets", async () => {
  const catalog = createCatalog({
    fetchImpl: async () => {
      throw new Error(`Failed to load ${secret}`);
    },
  });

  await assert.rejects(
    () => catalog.getOverview(),
    (error) =>
      !error.message.includes(secret) &&
      error.message.includes("Unable to reach the Swagger endpoint"),
  );
});
