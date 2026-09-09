import type { components } from "./generated/schema";

export type PublicEntry = components["schemas"]["PublicEntry"];
export type EntryPage = components["schemas"]["EntryPage"];
export type CollectionPage = components["schemas"]["CollectionPage"];
export type TagPage = components["schemas"]["TagPage"];
export type SearchPage = components["schemas"]["SearchPage"];
export type EntryResponse = components["schemas"]["EntryResponse"];
export type ApiInfoResponse = components["schemas"]["ApiInfoResponse"];
export type ApiMetadata = components["schemas"]["Metadata"];
export type RightsRegistry = components["schemas"]["RightsRegistry"];

export interface OpenDuaClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export interface PageOptions {
  limit?: number;
  cursor?: string;
  version?: string;
  signal?: AbortSignal;
}

export interface EntryOptions {
  version?: string;
  signal?: AbortSignal;
}

export class OpenDuaError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "OpenDuaError";
  }
}

export class OpenDuaClient {
  readonly baseUrl: string;
  readonly fetch: typeof globalThis.fetch;
  #audioBaseUrl?: string;

  constructor(options: OpenDuaClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://api.staging.opendua.org").replace(/\/$/, "");
    this.fetch = options.fetch ?? globalThis.fetch?.bind(globalThis);
    if (!this.fetch) throw new Error("A Fetch API implementation is required");
  }

  async metadata(options: EntryOptions = {}): Promise<ApiInfoResponse> {
    return this.#request<ApiInfoResponse>("/v2", options);
  }

  listDuas(options: PageOptions = {}): Promise<EntryPage> {
    return this.#request("/v2/duas", options);
  }

  getDua(identifier: string, options: EntryOptions = {}): Promise<EntryResponse> {
    return this.#request<EntryResponse>(
      `/v2/duas/${encodeURIComponent(identifier)}`,
      options,
    );
  }

  listCollection(slug: string, options: PageOptions = {}): Promise<CollectionPage> {
    return this.#request(`/v2/collections/${encodeURIComponent(slug)}`, options);
  }

  listTag(slug: string, options: PageOptions = {}): Promise<TagPage> {
    return this.#request(`/v2/tags/${encodeURIComponent(slug)}`, options);
  }

  search(query: string, options: PageOptions = {}): Promise<SearchPage> {
    return this.#request("/v2/search", { ...options, q: query });
  }

  rights(options: EntryOptions = {}): Promise<RightsRegistry> {
    return this.#request("/v2/rights", options);
  }

  async audioUrl(objectKey: string): Promise<string> {
    if (!objectKey) throw new Error("audio objectKey is empty for this entry");
    if (!this.#audioBaseUrl) await this.metadata();
    return `${this.#audioBaseUrl}/${objectKey}`;
  }

  async #request<T>(path: string, options: PageOptions & { q?: string }): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [name, value] of Object.entries({
      limit: options.limit,
      cursor: options.cursor,
      version: options.version,
      q: options.q,
    })) {
      if (value !== undefined) url.searchParams.set(name, String(value));
    }
    const response = await this.fetch(url, {
      headers: { Accept: "application/json" },
      signal: options.signal,
    });
    if (!response.ok) {
      let body: any;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      const error = body?.error;
      const retryAfter = Number(response.headers.get("Retry-After"));
      throw new OpenDuaError(
        response.status,
        error?.code ?? "http_error",
        error?.message ?? `OpenDua API returned ${response.status}`,
        error?.details,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
      );
    }
    const value = await response.json() as T;
    if (value && typeof value === "object" && "meta" in value) {
      const meta = (value as { meta?: { audioBaseUrl?: unknown } }).meta;
      if (typeof meta?.audioBaseUrl === "string") this.#audioBaseUrl = meta.audioBaseUrl;
    }
    return value;
  }
}
