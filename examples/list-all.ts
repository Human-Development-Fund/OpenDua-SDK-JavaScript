import { OpenDuaClient, type PublicEntry } from "../src/index";

const client = new OpenDuaClient();
const { meta } = await client.metadata();
const version = meta.datasetVersion;
const entries: PublicEntry[] = [];
let cursor: string | undefined;

do {
  const page = await client.listDuas({ version, limit: 100, cursor });
  entries.push(...page.data);
  cursor = page.pagination.nextCursor ?? undefined;
} while (cursor);

console.log(`Loaded ${entries.length} entries from dataset ${version}.`);
