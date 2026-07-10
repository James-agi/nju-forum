/**
 * Repair common AI-generated JSON issues in cards.json files.
 * The main problem: unescaped ASCII double quotes inside string values
 * used as Chinese quotation marks (e.g. "选课系统").
 */
export function repairCardsJson(raw: string): { repaired: string; fixed: boolean } {
  // Try parse as-is first
  try {
    JSON.parse(raw);
    return { repaired: raw, fixed: false };
  } catch {
    /* needs repair */
  }

  let repaired = "";
  let i = 0;
  let inString = false;

  while (i < raw.length) {
    const ch = raw[i];

    if (!inString) {
      repaired += ch;
      if (ch === '"' && (i === 0 || raw[i - 1] !== "\\")) {
        inString = true;
      }
      i++;
    } else {
      if (ch === '"' && raw[i - 1] !== "\\") {
        // This might be the closing quote of the string
        // Check if what follows looks like JSON structure
        const after = raw.slice(i + 1).trimStart();
        if (
          after.startsWith(",") ||
          after.startsWith("}") ||
          after.startsWith("]") ||
          after.startsWith(":") ||
          after.startsWith("\n") ||
          after === ""
        ) {
          repaired += ch;
          inString = false;
          i++;
          continue;
        }
        // This is an unescaped quote inside a string - escape it
        repaired += '\\"';
        i++;
      } else if (ch === "\\") {
        // 若 \ 后跟 " 且该 " 看起来像字符串结束符，则不当作转义序列
        if (i + 1 < raw.length && raw[i + 1] === '"') {
          const afterQuote = raw.slice(i + 2).trimStart();
          if (
            afterQuote.startsWith(",") ||
            afterQuote.startsWith("}") ||
            afterQuote.startsWith("]") ||
            afterQuote.startsWith(":") ||
            afterQuote.startsWith("\n") ||
            afterQuote === ""
          ) {
            // 这是字符串的结束引号，前面 \ 是孤立反斜杠，一并保留
            repaired += "\\\\\"";
            inString = false;
            i += 2;
            continue;
          }
        }
        repaired += ch;
        i++;
        if (i < raw.length) {
          repaired += raw[i];
          i++;
        }
      } else {
        repaired += ch;
        i++;
      }
    }
  }

  try {
    JSON.parse(repaired);
    return { repaired, fixed: true };
  } catch {
    return { repaired: raw, fixed: false };
  }
}
