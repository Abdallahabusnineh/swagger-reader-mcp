const DEFAULT_CACHE_TTL_MS = 3 * 60 * 1000;

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
]);

function getSchemas(spec) {
  return spec.components?.schemas ?? spec.definitions ?? {};
}

export class OpenApiCatalog {
  constructor({
    requestDescriptor,
    secrets = [],
    fetchImpl = globalThis.fetch,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    now = () => Date.now(),
  }) {
    if (!requestDescriptor?.url) {
      throw new Error("A Swagger request descriptor is required");
    }
    if (typeof fetchImpl !== "function") {
      throw new Error("A fetch implementation is required");
    }

    this.requestDescriptor = requestDescriptor;
    this.secrets = secrets.filter(Boolean);
    this.fetchImpl = fetchImpl;
    this.cacheTtlMs = cacheTtlMs;
    this.now = now;
    this.cachedSpec = null;
    this.fetchedAt = null;
  }

  async load({ force = false } = {}) {
    const cacheIsFresh =
      this.cachedSpec !== null &&
      this.fetchedAt !== null &&
      this.now() - this.fetchedAt < this.cacheTtlMs;
    if (!force && cacheIsFresh) {
      return this.cachedSpec;
    }

    let response;
    try {
      response = await this.fetchImpl(
        this.requestDescriptor.url,
        this.requestDescriptor.options,
      );
    } catch {
      throw new Error("Unable to reach the Swagger endpoint");
    }

    if (!response.ok) {
      throw new Error(`Swagger fetch failed with status ${response.status}`);
    }

    let spec;
    try {
      spec = await response.json();
    } catch {
      throw new Error("Swagger response is not valid JSON");
    }

    if (
      !spec ||
      typeof spec !== "object" ||
      (!spec.openapi && !spec.swagger) ||
      !spec.paths
    ) {
      throw new Error("Swagger response is not a valid OpenAPI document");
    }

    this.cachedSpec = spec;
    this.fetchedAt = this.now();
    return spec;
  }

  async refresh() {
    const spec = await this.load({ force: true });
    return this.buildOverview(spec);
  }

  async search(query) {
    const normalized = query?.trim().toLowerCase();
    if (!normalized) {
      throw new Error("query is required");
    }

    const spec = await this.load();
    const endpoints = [];
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!HTTP_METHODS.has(method)) {
          continue;
        }

        const searchable = JSON.stringify({ path, method, operation });
        if (searchable.toLowerCase().includes(normalized)) {
          endpoints.push({
            path,
            method,
            operationId: operation.operationId,
            summary: operation.summary,
            tags: operation.tags,
          });
        }
      }
    }

    const schemas = [];
    for (const [name, schema] of Object.entries(getSchemas(spec))) {
      const searchable = JSON.stringify({ name, schema });
      if (searchable.toLowerCase().includes(normalized)) {
        schemas.push({ name, schema });
      }
    }

    return { query, endpoints, schemas };
  }

  async getEndpoint(path, method) {
    const spec = await this.load();
    const pathItem = spec.paths[path];
    if (!pathItem) {
      throw new Error(`Endpoint path not found: ${path}`);
    }
    if (!method) {
      return { path, operations: pathItem };
    }

    const normalizedMethod = method.toLowerCase();
    if (!pathItem[normalizedMethod]) {
      throw new Error(`Endpoint method not found: ${normalizedMethod} ${path}`);
    }
    return { path, method: normalizedMethod, operation: pathItem[normalizedMethod] };
  }

  async getSchema(name) {
    const spec = await this.load();
    const schema = getSchemas(spec)[name];
    if (!schema) {
      throw new Error(`Schema not found: ${name}`);
    }
    return { name, ...schema };
  }

  async getOverview() {
    return this.buildOverview(await this.load());
  }

  buildOverview(spec) {
    const endpointCount = Object.values(spec.paths).reduce(
      (count, pathItem) =>
        count +
        Object.keys(pathItem).filter((method) => HTTP_METHODS.has(method)).length,
      0,
    );
    const tags = [
      ...new Set(
        Object.values(spec.paths)
          .flatMap((pathItem) =>
            Object.entries(pathItem)
              .filter(([method]) => HTTP_METHODS.has(method))
              .flatMap(([, operation]) => operation.tags ?? []),
          )
          .concat((spec.tags ?? []).map((tag) => tag.name)),
      ),
    ].sort();

    return {
      openapi: spec.openapi,
      swagger: spec.swagger,
      info: spec.info ?? {},
      endpointCount,
      schemaCount: Object.keys(getSchemas(spec)).length,
      tags,
      fetchedAt: this.fetchedAt,
      cacheTtlMs: this.cacheTtlMs,
    };
  }
}
