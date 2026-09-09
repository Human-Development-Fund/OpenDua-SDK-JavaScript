import type { components } from "./generated/schema";

/** One source-traceable entry with ordered content blocks and recordings. */
export type PublicEntry = components["schemas"]["PublicEntry"];
/** A cursor-paginated list of entries. */
export type EntryPage = components["schemas"]["EntryPage"];
/** A cursor-paginated collection and its entries. */
export type CollectionPage = components["schemas"]["CollectionPage"];
/** A cursor-paginated tag and its entries. */
export type TagPage = components["schemas"]["TagPage"];
/** A cursor-paginated search result. */
export type SearchPage = components["schemas"]["SearchPage"];
/** One entry and the release metadata used to serve it. */
export type EntryResponse = components["schemas"]["EntryResponse"];
/** API identity, release information, and current endpoints. */
export type ApiInfoResponse = components["schemas"]["ApiInfoResponse"];
/** Versions and the audio origin associated with an API response. */
export type ApiMetadata = components["schemas"]["Metadata"];
/** Rights statements and reusable entry rights profiles. */
export type RightsRegistry = components["schemas"]["RightsRegistry"];

/** Configuration for an {@link OpenDuaClient}. */
export interface OpenDuaClientOptions {
  /** API origin. Defaults to the public OpenDua staging API. */
  baseUrl?: string;
  /** Fetch-compatible request function. Defaults to `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch;
}

/** Options accepted by endpoints that return cursor-paginated results. */
export interface PageOptions {
  /** Number of entries to request. The API accepts values from 1 to 100. */
  limit?: number;
  /** Opaque cursor returned in the preceding page's `nextCursor`. */
  cursor?: string;
  /** Immutable dataset version. Omit it to read the current release. */
  version?: string;
  /** Signal used to cancel or time out the request. */
  signal?: AbortSignal;
}

/** Options accepted by single-resource endpoints. */
export interface EntryOptions {
  /** Immutable dataset version. Omit it to read the current release. */
  version?: string;
  /** Signal used to cancel or time out the request. */
  signal?: AbortSignal;
}

/** A non-successful response from the OpenDua API. */
export class OpenDuaError extends Error {
  /**
   * Creates an API error. Applications normally receive this from a client
   * method instead of constructing it directly.
   */
  constructor(
    /** HTTP response status. */
    readonly status: number,
    /** Stable, machine-readable API error code. */
    readonly code: string,
    message: string,
    /** Optional structured context returned by the API. */
    readonly details?: Record<string, unknown>,
    /** Server-requested delay before retrying, in seconds. */
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "OpenDuaError";
  }
}

/** Typed client for the public, read-only OpenDua API v2. */
export class OpenDuaClient {
  /** API origin without a trailing slash. */
  readonly baseUrl: string;
  /** Fetch implementation used for every request. */
  readonly fetch: typeof globalThis.fetch;
  #audioBaseUrl?: string;

  constructor(options: OpenDuaClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://api.staging.opendua.org").replace(/\/$/, "");
    this.fetch = options.fetch ?? globalThis.fetch?.bind(globalThis);
    if (!this.fetch) throw new Error("A Fetch API implementation is required");
  }

  /** Returns API identity and release metadata. */
  async metadata(options: EntryOptions = {}): Promise<ApiInfoResponse> {
    return this.#request<ApiInfoResponse>("/v2", options);
  }

  /** Lists published entries. */
  listDuas(options: PageOptions = {}): Promise<EntryPage> {
    return this.#request("/v2/duas", options);
  }

  /** Returns one entry by stable `OD-*` ID or slug. */
  getDua(identifier: string, options: EntryOptions = {}): Promise<EntryResponse> {
    return this.#request<EntryResponse>(
      `/v2/duas/${encodeURIComponent(identifier)}`,
      options,
    );
  }

  /** Lists entries in one collection. */
  listCollection(slug: string, options: PageOptions = {}): Promise<CollectionPage> {
    return this.#request(`/v2/collections/${encodeURIComponent(slug)}`, options);
  }

  /** Lists entries that carry one tag. */
  listTag(slug: string, options: PageOptions = {}): Promise<TagPage> {
    return this.#request(`/v2/tags/${encodeURIComponent(slug)}`, options);
  }

  /** Searches published text, sources, collections, and tags. */
  search(query: string, options: PageOptions = {}): Promise<SearchPage> {
    return this.#request("/v2/search", { ...options, q: query });
  }

  /** Returns the rights statements and entry-profile mappings. */
  rights(options: EntryOptions = {}): Promise<RightsRegistry> {
    return this.#request("/v2/rights", options);
  }

  /**
   * Resolves an environment-neutral recording key to a public audio URL.
   * Fetches API metadata first when no preceding response supplied the audio
   * origin.
   */
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
