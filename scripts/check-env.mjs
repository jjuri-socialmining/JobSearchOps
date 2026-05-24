import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const examplePath = resolve(root, ".env.example");

let raw;
try {
  raw = readFileSync(examplePath, "utf8");
} catch {
  console.error("❌ .env.example not found at project root — cannot validate env vars.");
  process.exit(1);
}

const required = [];
for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [declaration, ...commentParts] = trimmed.split("#");
  const comment = commentParts.join("#");
  if (!comment.includes("REQUIRED")) continue;
  const name = declaration.split("=")[0].trim();
  if (name) required.push(name);
}

if (required.length === 0) {
  console.log("✅ No REQUIRED env vars defined in .env.example.");
  process.exit(0);
}

const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error("\n❌ Missing required environment variables:\n");
  for (const name of missing) {
    console.error(`   ${name}`);
  }
  console.error("\nCopy .env.example → .env and fill in the missing values.\n");
  process.exit(1);
}

console.log("✅ All required env vars present.");
