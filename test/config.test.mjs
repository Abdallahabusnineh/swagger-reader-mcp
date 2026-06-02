import assert from "node:assert/strict";
import test from "node:test";

import { createRequestDescriptor, readConfig } from "../src/config.mjs";

test("requires SWAGGER_URL", () => {
  assert.throws(() => readConfig({}), /SWAGGER_URL is required/);
});

test("rejects an invalid SWAGGER_URL", () => {
  assert.throws(
    () => readConfig({ SWAGGER_URL: "not-a-url" }),
    /SWAGGER_URL must be a valid URL/,
  );
});

test("defaults to unauthenticated requests", () => {
  assert.deepEqual(
    readConfig({ SWAGGER_URL: "https://example.com/openapi.json" }),
    {
      swaggerUrl: "https://example.com/openapi.json",
      apiKeyLocation: "none",
      apiKey: undefined,
      apiKeyName: undefined,
      cacheTtlMs: 180_000,
    },
  );
});

test("adds query authentication", () => {
  const descriptor = createRequestDescriptor(
    readConfig({
      SWAGGER_URL: "https://example.com/openapi.json",
      SWAGGER_API_KEY_LOCATION: "query",
      SWAGGER_API_KEY_NAME: "apiKey",
      SWAGGER_API_KEY: "secret",
    }),
  );

  assert.equal(descriptor.url.searchParams.get("apiKey"), "secret");
  assert.deepEqual(descriptor.options, {});
});

test("adds header authentication", () => {
  const descriptor = createRequestDescriptor(
    readConfig({
      SWAGGER_URL: "https://example.com/openapi.json",
      SWAGGER_API_KEY_LOCATION: "header",
      SWAGGER_API_KEY_NAME: "X-API-Key",
      SWAGGER_API_KEY: "secret",
    }),
  );

  assert.deepEqual(descriptor.options, {
    headers: { "X-API-Key": "secret" },
  });
});

test("adds bearer authentication", () => {
  const descriptor = createRequestDescriptor(
    readConfig({
      SWAGGER_URL: "https://example.com/openapi.json",
      SWAGGER_API_KEY_LOCATION: "bearer",
      SWAGGER_API_KEY: "secret",
    }),
  );

  assert.deepEqual(descriptor.options, {
    headers: { Authorization: "Bearer secret" },
  });
});

test("rejects unsupported authentication modes", () => {
  assert.throws(
    () =>
      readConfig({
        SWAGGER_URL: "https://example.com/openapi.json",
        SWAGGER_API_KEY_LOCATION: "cookie",
      }),
    /SWAGGER_API_KEY_LOCATION must be one of: none, query, header, bearer/,
  );
});

test("requires a key for authenticated modes", () => {
  assert.throws(
    () =>
      readConfig({
        SWAGGER_URL: "https://example.com/openapi.json",
        SWAGGER_API_KEY_LOCATION: "bearer",
      }),
    /SWAGGER_API_KEY is required/,
  );
});

test("requires a name for query and header authentication", () => {
  for (const apiKeyLocation of ["query", "header"]) {
    assert.throws(
      () =>
        readConfig({
          SWAGGER_URL: "https://example.com/openapi.json",
          SWAGGER_API_KEY_LOCATION: apiKeyLocation,
          SWAGGER_API_KEY: "secret",
        }),
      /SWAGGER_API_KEY_NAME is required/,
    );
  }
});

test("reads a custom cache TTL", () => {
  assert.equal(
    readConfig({
      SWAGGER_URL: "https://example.com/openapi.json",
      SWAGGER_CACHE_TTL_MS: "250",
    }).cacheTtlMs,
    250,
  );
});

test("rejects an invalid cache TTL", () => {
  for (const value of ["-1", "1.5", "text"]) {
    assert.throws(
      () =>
        readConfig({
          SWAGGER_URL: "https://example.com/openapi.json",
          SWAGGER_CACHE_TTL_MS: value,
        }),
      /SWAGGER_CACHE_TTL_MS must be a non-negative integer/,
    );
  }
});
