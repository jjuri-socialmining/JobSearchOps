import { readText } from "./file-utils.mjs";
import { parseYaml } from "./simple-yaml.mjs";

export function loadConfig(relativePath) {
  return parseYaml(readText(relativePath));
}
