function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "") {
    return "";
  }
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (trimmed === "null") {
    return null;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed;
}

function normalizeLines(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((raw) => raw.replace(/\t/g, "  "))
    .filter((raw) => raw.trim() !== "" && !raw.trim().startsWith("#"));
}

function lineIndent(line) {
  return line.match(/^ */)[0].length;
}

function parseBlock(lines, startIndex = 0, indent = 0) {
  let index = startIndex;
  let container = null;

  while (index < lines.length) {
    const raw = lines[index];
    const currentIndent = lineIndent(raw);
    if (currentIndent < indent) {
      break;
    }
    if (currentIndent > indent) {
      throw new Error(`Invalid indentation near line: ${raw}`);
    }

    const trimmed = raw.trim();
    if (trimmed.startsWith("- ")) {
      if (!container) {
        container = [];
      }
      if (!Array.isArray(container)) {
        throw new Error(`Mixed YAML container types near line: ${raw}`);
      }

      const rest = trimmed.slice(2);
      if (rest === "") {
        const nested = parseBlock(lines, index + 1, indent + 2);
        container.push(nested.value);
        index = nested.index;
        continue;
      }

      if (rest.includes(":")) {
        const [rawKey, ...rawValueParts] = rest.split(":");
        const key = rawKey.trim();
        const inlineValue = rawValueParts.join(":").trim();
        const item = {};
        if (inlineValue === "") {
          const nested = parseBlock(lines, index + 1, indent + 4);
          item[key] = nested.value;
          index = nested.index;
        } else {
          item[key] = parseScalar(inlineValue);
          index += 1;
        }

        while (index < lines.length) {
          const lookahead = lines[index];
          const lookaheadIndent = lineIndent(lookahead);
          if (lookaheadIndent <= indent) {
            break;
          }
          if (lookaheadIndent !== indent + 2) {
            break;
          }
          const lookaheadTrimmed = lookahead.trim();
          if (lookaheadTrimmed.startsWith("- ")) {
            break;
          }
          const [childRawKey, ...childRawValueParts] = lookaheadTrimmed.split(":");
          const childKey = childRawKey.trim();
          const childInlineValue = childRawValueParts.join(":").trim();
          if (childInlineValue === "") {
            const nested = parseBlock(lines, index + 1, indent + 4);
            item[childKey] = nested.value;
            index = nested.index;
          } else {
            item[childKey] = parseScalar(childInlineValue);
            index += 1;
          }
        }

        container.push(item);
        continue;
      }

      container.push(parseScalar(rest));
      index += 1;
      continue;
    }

    if (!container) {
      container = {};
    }
    if (Array.isArray(container)) {
      throw new Error(`Mixed YAML container types near line: ${raw}`);
    }

    const [rawKey, ...rawValueParts] = trimmed.split(":");
    const key = rawKey.trim();
    const inlineValue = rawValueParts.join(":").trim();
    if (inlineValue === "") {
      const nested = parseBlock(lines, index + 1, indent + 2);
      container[key] = nested.value;
      index = nested.index;
      continue;
    }

    container[key] = parseScalar(inlineValue);
    index += 1;
  }

  return { value: container ?? {}, index };
}

export function parseYaml(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  const lines = normalizeLines(text);
  return parseBlock(lines, 0, 0).value;
}
