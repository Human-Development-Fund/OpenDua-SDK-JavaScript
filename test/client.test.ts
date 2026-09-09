import { describe, expect, it, vi } from "vitest";

import fixture from "../contracts/entry.json";
import instructionFixture from "../contracts/fixtures/instruction.json";
import multipartFixture from "../contracts/fixtures/multipart.json";
import reportFixture from "../contracts/fixtures/report.json";
import {
  OpenDuaClient,
  OpenDuaError,
  type ApiInfoResponse,
  type CollectionPage,
  type PublicEntry,
  type SearchPage,
  type TagPage,
} from "../src/index";

const typedFixture = fixture as PublicEntry;

describe("OpenDuaClient", () => {
  it("fetches and parses the exact exported entry fixture", async () => {
    const response = {
      data: fixture,
      meta: { audioBaseUrl: "https://audio.example" },
    };
    const fetch = vi.fn(async (_input: RequestInfo | URL) => Response.json(response));
    const client = new OpenDuaClient({ baseUrl: "https://api.example", fetch });
    expect(await client.getDua("when-you-wake-up-1", { version: "0.0.3" })).toEqual(response);
    expect(String(fetch.mock.calls[0][0])).toBe(
      "https://api.example/v2/duas/when-you-wake-up-1?version=0.0.3",
    );
  });

  it("keeps every frozen public-entry shape intact", () => {
    for (const entry of [fixture, instructionFixture, reportFixture, multipartFixture]) {
      expect(entry).toHaveProperty("source.entryNumber");
      expect(entry).toHaveProperty("blocks");
      expect(entry).toHaveProperty("recordings");
      expect(entry).toHaveProperty("recordHash");
      expect(Object.keys(entry)).toHaveLength(18);
    }
  });

  it("passes pagination and search without inventing a response shape", async () => {
    const page: SearchPage = {
      data: [typedFixture],
      meta: {
        apiVersion: "2.0.0", datasetVersion: "0.0.3", schemaVersion: "2.0.0",
        audioVersion: "0.0.2", audioBaseUrl: "https://audio.example", rightsRegistryVersion: "2.0.0",
      },
      pagination: { limit: 10, returned: 1, total: 1, nextCursor: null },
      query: "subhanallah",
    };
    const fetch = vi.fn(async (_input: RequestInfo | URL) => Response.json(page));
    const client = new OpenDuaClient({ baseUrl: "https://api.example/", fetch });
    expect((await client.search("subhanallah", { limit: 10, cursor: "Mg" })).query).toBe("subhanallah");
    expect(String(fetch.mock.calls[0][0])).toBe(
      "https://api.example/v2/search?limit=10&cursor=Mg&q=subhanallah",
    );
  });

  it("returns complete metadata and specialised collection and tag pages", async () => {
    const meta = {
      apiVersion: "2.0.0", datasetVersion: "0.0.3", schemaVersion: "2.0.0",
      audioVersion: "0.0.2", audioBaseUrl: "https://audio.example", rightsRegistryVersion: "2.0.0",
    } as const;
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path === "/v2") {
        const response: ApiInfoResponse = {
          data: { name: "OpenDua API", entryCount: 267, released: "2026-09-08", endpoints: ["/v2/duas"] },
          meta,
        };
        return Response.json(response);
      }
      const base = {
        data: [typedFixture], meta,
        pagination: { limit: 20, returned: 1, total: 1, nextCursor: null },
      };
      if (path.includes("/collections/")) {
        const response: CollectionPage = { ...base, collection: "when-you-wake-up" };
        return Response.json(response);
      }
      const response: TagPage = { ...base, tag: "quran" };
      return Response.json(response);
    });
    const client = new OpenDuaClient({ baseUrl: "https://api.example", fetch });
    expect((await client.metadata()).data.entryCount).toBe(267);
    expect((await client.listCollection("when-you-wake-up")).collection).toBe("when-you-wake-up");
    expect((await client.listTag("quran")).tag).toBe("quran");
  });

  it("resolves environment-neutral audio keys through API metadata", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL) =>
      Response.json({ data: {}, meta: { audioBaseUrl: "https://audio.example" } }),
    );
    const client = new OpenDuaClient({ baseUrl: "https://api.example", fetch });
    expect(await client.audioUrl("hisn/v0.0.2/OD-001.mp3")).toBe(
      "https://audio.example/hisn/v0.0.2/OD-001.mp3",
    );
  });

  it("uses metadata returned with one entry to resolve its audio", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL) =>
      Response.json({ data: fixture, meta: { audioBaseUrl: "https://audio.example" } }),
    );
    const client = new OpenDuaClient({ baseUrl: "https://api.example", fetch });
    const response = await client.getDua("OD-001");
    const recording = response.data.recordings[0];
    expect(recording).toBeDefined();
    expect(await client.audioUrl(recording!.objectKey)).toBe(
      `https://audio.example/${recording!.objectKey}`,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("exposes the stable JSON error and Retry-After", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL) =>
      Response.json(
        { error: { code: "rate_limited", message: "request limit exceeded", status: 429 } },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    );
    const client = new OpenDuaClient({ fetch });
    const error = await client.listDuas().catch((value) => value);
    expect(error).toBeInstanceOf(OpenDuaError);
    expect(error).toMatchObject({ status: 429, code: "rate_limited", retryAfterSeconds: 60 });
  });
});
