const DEFAULT_CACHE_TTL_MS = 3 * 60 * 1000;
const AUTH_LOCATIONS = new Set(["none", "query", "header", "bearer"]);

export function readConfig(env = process.env) {
  const swaggerUrl = env.SWAGGER_URL?.trim();
  if (!swaggerUrl) {
    throw new Error("SWAGGER_URL is required");
  }
  try {
    new URL(swaggerUrl);
  } catch {
    throw new Error("SWAGGER_URL must be a valid URL");
  }

  const apiKeyLocation = (env.SWAGGER_API_KEY_LOCATION ?? "none")
    .trim()
    .toLowerCase();
  if (!AUTH_LOCATIONS.has(apiKeyLocation)) {
    throw new Error(
      "SWAGGER_API_KEY_LOCATION must be one of: none, query, header, bearer",
    );
  }

  const apiKey = env.SWAGGER_API_KEY?.trim() || undefined;
  const apiKeyName = env.SWAGGER_API_KEY_NAME?.trim() || undefined;
  if (apiKeyLocation !== "none" && !apiKey) {
    throw new Error("SWAGGER_API_KEY is required");
  }
  if (["query", "header"].includes(apiKeyLocation) && !apiKeyName) {
    throw new Error("SWAGGER_API_KEY_NAME is required");
  }

  const cacheTtlMs = Number(env.SWAGGER_CACHE_TTL_MS ?? DEFAULT_CACHE_TTL_MS);
  if (!Number.isInteger(cacheTtlMs) || cacheTtlMs < 0) {
    throw new Error("SWAGGER_CACHE_TTL_MS must be a non-negative integer");
  }

  return { swaggerUrl, apiKeyLocation, apiKey, apiKeyName, cacheTtlMs };
}

export function createRequestDescriptor(config) {
  const url = new URL(config.swaggerUrl);
  const headers = {};
  if (config.apiKeyLocation === "query") {
    url.searchParams.set(config.apiKeyName, config.apiKey);
  }
  if (config.apiKeyLocation === "header") {
    headers[config.apiKeyName] = config.apiKey;
  }
  if (config.apiKeyLocation === "bearer") {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  return {
    url,
    options: Object.keys(headers).length > 0 ? { headers } : {},
  };
}
