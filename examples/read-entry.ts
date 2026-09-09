import { OpenDuaClient } from "../src/index";

const client = new OpenDuaClient();
const { data: entry, meta } = await client.getDua("morning-and-evening-3");

console.log(`${entry.title} (${meta.datasetVersion})`);

for (const block of entry.blocks) {
  if (block.type !== "recitation") {
    console.log(`[${block.type}] ${block.english ?? block.arabic ?? ""}`);
    continue;
  }

  console.log(block.label ?? "Recitation");
  console.log(block.arabic);
  console.log(block.transliteration ?? "No transliteration published");
  console.log(block.english ?? "No English meaning published");

  const recordings = entry.recordings.filter((recording) =>
    recording.covers.includes(block.id),
  );
  for (const recording of recordings) {
    console.log(recording.reciter, await client.audioUrl(recording.objectKey));
  }
}
