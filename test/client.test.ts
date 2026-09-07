import { describe, expect, it, vi } from "vitest";

import fixture from "../contracts/entry.json";
import { OpenDuaClient, OpenDuaError } from "../src/index";


describe("OpenDuaClient", () => {
  it("fetches and parses the exact exported entry fixture", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL) => Response.json(fixture));
    const client = new OpenDuaClient({ baseUrl: "https://api.example", fetch });
    expect(await client.getDua("when-you-wake-up-1", { version: "0.0.2" })).toEqual(fixture);
    expect(String(fetch.mock.calls[0][0])).toBe(
      "https://api.example/v1/duas/when-you-wake-up-1?version=0.0.2",
    );
  });

  it("passes pagination and search without inventing a response shape", async () => {
    const page = { data: [fixture], meta: { audioBaseUrl: "https://audio.example" }, pagination: {} };
    const fetch = vi.fn(async (_input: RequestInfo | URL) => Response.json(page));
    const client = new OpenDuaClient({ baseUrl: "https://api.example/", fetch });
    expect(await client.search("subhanallah", { limit: 10, cursor: "Mg" })).toEqual(page);
    expect(String(fetch.mock.calls[0][0])).toBe(
      "https://api.example/v1/search?limit=10&cursor=Mg&q=subhanallah",
    );
  });

  it("resolves environment-neutral audio keys through API metadata", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL) =>
      Response.json({ data: {}, meta: { audioBaseUrl: "https://audio.example" } }),
    );
    const client = new OpenDuaClient({ baseUrl: "https://api.example", fetch });
    expect(await client.audioUrl("hisn/v0.0.1/OD-001.mp3")).toBe(
      "https://audio.example/hisn/v0.0.1/OD-001.mp3",
    );
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
