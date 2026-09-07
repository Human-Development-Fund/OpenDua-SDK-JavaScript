import type { components } from "./generated/schema";

export type PublicEntry = components["schemas"]["PublicEntry"];
export type EntryPage = components["schemas"]["EntryPage"];
export type ApiMetadata = components["schemas"]["Metadata"];
export type RightsRegistry = Record<string, unknown>;

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

  async metadata(options: EntryOptions = {}): Promise<{ data: Record<string, unknown>; meta: ApiMetadata }> {
    const response = await this.#request<{ data: Record<string, unknown>; meta: ApiMetadata }>("/v1", options);
    this.#audioBaseUrl = response.meta.audioBaseUrl;
    return response;
  }

  listDuas(options: PageOptions = {}): Promise<EntryPage> {
    return this.#request("/v1/duas", options);
  }

  getDua(identifier: string, options: EntryOptions = {}): Promise<PublicEntry> {
    return this.#request(`/v1/duas/${encodeURIComponent(identifier)}`, options);
  }

  listCollection(slug: string, options: PageOptions = {}): Promise<EntryPage> {
    return this.#request(`/v1/collections/${encodeURIComponent(slug)}`, options);
  }

  search(query: string, options: PageOptions = {}): Promise<EntryPage> {
    return this.#request("/v1/search", { ...options, q: query });
  }

  rights(options: EntryOptions = {}): Promise<RightsRegistry> {
    return this.#request("/v1/rights", options);
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
    return response.json() as Promise<T>;
  }
}
