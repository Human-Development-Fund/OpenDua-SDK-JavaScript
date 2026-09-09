# OpenDua JavaScript SDK

Typed, dependency-free access to the public OpenDua read API in browsers,
Node.js, Deno, and compatible runtimes.

```sh
npm install @opendua/sdk@next
```

```ts
import { OpenDuaClient } from "@opendua/sdk";

const client = new OpenDuaClient();
const response = await client.getDua("when-you-wake-up-1");
const firstBlock = response.data.blocks[0];
console.log(firstBlock);

const firstRecording = response.data.recordings[0];
if (firstRecording) {
  console.log(await client.audioUrl(firstRecording.objectKey));
}
```

The prerelease defaults to `https://api.staging.opendua.org`; pass `baseUrl` to
use another environment. Methods cover entries, collections, search, rights,
pagination, and environment-neutral audio object keys. Entry responses include
the release metadata needed to resolve their recordings. API failures throw
`OpenDuaError` with `status`, `code`, `details`, and `retryAfterSeconds`.

The SDK source is MIT licensed. OpenDua editorial text and dataset structure
are CC BY 4.0; underlying religious texts are not claimed, and recitation terms
are separate. See each entry's `rightsProfile` and the API rights registry.
