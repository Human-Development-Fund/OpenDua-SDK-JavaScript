# OpenDua JavaScript SDK

Typed, dependency-free access to the public OpenDua read API from JavaScript
and TypeScript.

> **Release status:** `0.2.0-rc.1` is being prepared for an external developer
> preview and has not yet been published to npm. It uses the public staging API
> by default. The API and data model may change before the first stable release,
> and staging content does not imply scholarly approval.

## What it provides

- Generated TypeScript types that match OpenDua API v2
- ESM and CommonJS builds
- Entry lookup by stable ID or slug
- Collection, tag, search, and cursor-pagination methods
- Audio URL resolution for entries with one or several recordings
- Structured API errors, including `Retry-After` values
- Dataset version pinning for reproducible reads
- No runtime dependencies or credentials

## Requirements

- Node.js 20 or later; or
- A browser, Deno, or another runtime with `fetch`, `URL`, and `AbortController`

You can supply a compatible `fetch` implementation when the runtime has no
global implementation.

This SDK targets OpenDua API v2 and is not compatible with v1 responses.

## Installation after publication

The package is not yet available from npm. After publication, install the
developer preview through its npm distribution tag:

```sh
npm install @opendua/sdk@next
```

Pin the exact prerelease version when you need reproducible builds:

```sh
npm install @opendua/sdk@0.2.0-rc.1
```

## Quick start

```ts
import { OpenDuaClient } from "@opendua/sdk";

const client = new OpenDuaClient();
const { data: entry } = await client.getDua("when-you-wake-up-1");

for (const block of entry.blocks) {
  console.log(block.english);
}

const recording = entry.recordings[0];
if (recording) {
  console.log(await client.audioUrl(recording.objectKey));
}
```

The default base URL is `https://api.staging.opendua.org`. Set `baseUrl` when
you need another OpenDua environment:

```ts
const client = new OpenDuaClient({
  baseUrl: "https://your-opendua-api.example",
});
```

Do not attach secrets to SDK requests. The current public read API does not
require authentication.

## Understand an entry

Every entry response has a `data` value and release information in `meta`. An
entry contains four important layers:

1. `source` identifies the source work and its entry number.
2. `collections` places the entry in one or more ordered collections.
3. `blocks` contains the authoritative text in reading order.
4. `recordings` maps audio files to the recitation blocks they cover.

The `form` is `dua`, `quran`, `instruction`, or `report`. Use it for broad
presentation choices, but render `blocks` in their given order.

A block with `type: "recitation"` contains words to recite. Its optional
`label` distinguishes a variation or part, and its `repetition` records how
often to say it. A context block has the type `instruction`, `narration`, or
`note`; it provides context and is not recited.

```ts
for (const block of entry.blocks) {
  if (block.type === "recitation") {
    console.log(block.label, block.arabic, block.transliteration);
    console.log(block.repetition?.count ?? 1);
  } else {
    console.log(`[${block.type}]`, block.english);
  }
}
```

Do not rebuild entry text from its title, citation, or recordings. The ordered
`blocks` array is the source of truth.

## Work with multiple recordings

An entry may have no audio, one recording, or several recordings. Each
recording lists the recitation block IDs it covers. Match on `covers` instead
of assuming that array positions correspond:

```ts
const { data: entry } = await client.getDua("morning-and-evening-3");

for (const block of entry.blocks) {
  if (block.type !== "recitation") continue;

  const recordings = entry.recordings.filter((recording) =>
    recording.covers.includes(block.id),
  );

  for (const recording of recordings) {
    const url = await client.audioUrl(recording.objectKey);
    console.log(block.label, recording.reciter, url);
  }
}
```

`objectKey` is an environment-neutral storage path, not a public URL. Resolve
it with `audioUrl()`. The client reads the correct audio origin from API
metadata and caches that origin for later calls.

## Client methods

| Method | Result |
| --- | --- |
| `metadata(options?)` | API identity, entry count, endpoints, and release metadata |
| `listDuas(options?)` | A page of published entries |
| `getDua(idOrSlug, options?)` | One entry by stable ID or slug |
| `listCollection(slug, options?)` | A page from one ordered collection |
| `listTag(slug, options?)` | A page of entries with one tag |
| `search(query, options?)` | A page of matching entries |
| `rights(options?)` | The versioned rights registry |
| `audioUrl(objectKey)` | A public URL for an audio object key |

Paged methods accept these options:

| Option | Meaning |
| --- | --- |
| `limit` | Page size from 1 to 100 |
| `cursor` | Opaque cursor returned by the preceding page |
| `version` | Immutable dataset version to read |
| `signal` | `AbortSignal` used to cancel or time out the request |

Single-entry, metadata, and rights methods accept `version` and `signal`.

## Pagination

Treat cursors as opaque values. Continue until `nextCursor` is `null`:

```ts
import { OpenDuaClient, type PublicEntry } from "@opendua/sdk";

const client = new OpenDuaClient();
const entries: PublicEntry[] = [];
let cursor: string | undefined;

do {
  const page = await client.listDuas({ limit: 100, cursor });
  entries.push(...page.data);
  cursor = page.pagination.nextCursor ?? undefined;
} while (cursor);
```

## Pin a dataset release

Omit `version` to read the current dataset release. Pass a dataset version to
keep results stable across requests:

```ts
const current = await client.metadata();
const version = current.meta.datasetVersion;

const firstPage = await client.listDuas({ version, limit: 50 });
const nextPage = firstPage.pagination.nextCursor
  ? await client.listDuas({
      version,
      limit: 50,
      cursor: firstPage.pagination.nextCursor,
    })
  : null;
```

API, schema, dataset, audio, and rights-registry versions describe different
parts of a release. Read them from the response `meta` object rather than
assuming they advance together.

## Errors, cancellation, and retries

The SDK throws `OpenDuaError` for non-successful HTTP responses:

```ts
import { OpenDuaClient, OpenDuaError } from "@opendua/sdk";

const client = new OpenDuaClient();

try {
  await client.getDua("missing-entry", {
    signal: AbortSignal.timeout(5_000),
  });
} catch (error) {
  if (error instanceof OpenDuaError) {
    console.error(error.status, error.code, error.message);
    console.error(error.details, error.retryAfterSeconds);
  } else {
    // Fetch, connectivity, and abort errors retain their native types.
    throw error;
  }
}
```

The SDK does not retry requests automatically. If the API returns `429`, use
`retryAfterSeconds` when present. Add bounded retries and cancellation that
match your application's reliability requirements.

## Custom `fetch`

Injecting `fetch` supports compatible runtimes, request instrumentation, and
isolated tests:

```ts
const client = new OpenDuaClient({
  fetch: async (input, init) => {
    console.info("OpenDua request", String(input));
    return fetch(input, init);
  },
});
```

## Types and generated contracts

The package exports the client, its option and error types, and the principal
API response types:

- `PublicEntry`
- `EntryResponse` and `EntryPage`
- `CollectionPage`, `TagPage`, and `SearchPage`
- `ApiInfoResponse` and `ApiMetadata`
- `RightsRegistry`

The generated declarations come from `contracts/openapi.json`. The repository
also freezes representative simple, instruction-only, report, and
multiple-recording responses. Continuous integration rejects generated types
that drift from the checked-in contract.

See
[`examples/read-entry.ts`](https://github.com/Human-Development-Fund/OpenDua-SDK-JavaScript/blob/main/examples/read-entry.ts)
for block and recording handling and
[`examples/list-all.ts`](https://github.com/Human-Development-Fund/OpenDua-SDK-JavaScript/blob/main/examples/list-all.ts)
for pagination.

## Review and rights information

Each entry has separate source, translation, scholar, and audio review states.
Check `entry.reviews` when your product needs a particular review level. The
external staging preview does not claim scholarly approval.

`entry.rightsProfile` selects a profile from `client.rights()`. The SDK source
is MIT licensed. OpenDua editorial text and dataset structure are CC BY 4.0;
underlying religious texts are not claimed, and recitation terms are separate.
Use the rights registry instead of applying the SDK's software license to API
content or audio.

## Release policy

This release candidate follows semantic versioning but is not a stable API.
Pin its exact version in production-like experiments. We will document
breaking changes in [`CHANGELOG.md`](CHANGELOG.md).

## Development and support

Run the complete local check before opening a pull request:

```sh
npm ci
npm run check
```

See
[`CONTRIBUTING.md`](https://github.com/Human-Development-Fund/OpenDua-SDK-JavaScript/blob/main/CONTRIBUTING.md)
for contract-generation and contribution rules. Report ordinary defects through
[GitHub Issues](https://github.com/Human-Development-Fund/OpenDua-SDK-JavaScript/issues).
Report vulnerabilities as described in the
[`SECURITY.md`](https://github.com/Human-Development-Fund/OpenDua-SDK-JavaScript/blob/main/SECURITY.md)
policy.

## License

The JavaScript SDK source is available under the [MIT License](LICENSE).
