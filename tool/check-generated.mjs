import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const directory = mkdtempSync(join(tmpdir(), "opendua-sdk-contract-"));
const candidate = join(directory, "schema.ts");
const binary = join("node_modules", ".bin", "openapi-typescript");

try {
  const result = spawnSync(binary, ["contracts/openapi.json", "-o", candidate], {
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (!readFileSync(candidate).equals(readFileSync("src/generated/schema.ts"))) {
    console.error("Generated TypeScript contract is stale. Run npm run generate.");
    process.exit(1);
  }
  console.log("Generated TypeScript contract is current.");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
