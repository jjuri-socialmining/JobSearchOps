import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const STORE_PATH = resolve(ROOT, "tmp/seen-ids.json");

export function createDedupStore() {
  let seen;
  try {
    const raw = readFileSync(STORE_PATH, "utf8");
    const data = JSON.parse(raw);
    seen = new Set(Array.isArray(data.ids) ? data.ids : []);
  } catch {
    seen = new Set();
  }

  let addedThisRun = 0;

  return {
    isNew(jobId) {
      return Boolean(jobId) && !seen.has(jobId);
    },
    markSeen(jobId) {
      if (!jobId || seen.has(jobId)) return;
      seen.add(jobId);
      addedThisRun += 1;
    },
    flush() {
      mkdirSync(resolve(ROOT, "tmp"), { recursive: true });
      writeFileSync(
        STORE_PATH,
        JSON.stringify({ updated_at: new Date().toISOString(), ids: [...seen] }, null, 2),
        "utf8"
      );
    },
    stats() {
      return { total: seen.size, addedThisRun };
    },
  };
}
