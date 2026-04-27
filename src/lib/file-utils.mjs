import fs from "node:fs";
import path from "node:path";

export function repoRoot() {
  return process.cwd();
}

export function resolveRepoPath(relativePath) {
  return path.resolve(repoRoot(), relativePath);
}

export function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function readText(relativePath) {
  return fs.readFileSync(resolveRepoPath(relativePath), "utf8");
}

export function writeJson(relativePath, value) {
  const filePath = resolveRepoPath(relativePath);
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(relativePath, value) {
  const filePath = resolveRepoPath(relativePath);
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, value, "utf8");
}

export function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      continue;
    }
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return options;
}
