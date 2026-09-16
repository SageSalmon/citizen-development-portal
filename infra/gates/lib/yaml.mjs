// Minimal YAML subset parser, Node built-ins only (the gate engine must not have
// dependencies). Supports what app.yaml and data/config.yaml need: nested mappings by
// 2-space indentation, block sequences of scalars or mappings, inline `[]`/`{}`/`[a, b]`,
// quoted and plain scalars, numbers, booleans, null, comments. Anything else (anchors,
// multi-document, block scalars, tabs) is a parse error with a line number.
export function parseYaml(text) {
  const lines = text.split(/\r?\n/);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.includes("\t")) throw err(i, "tabs are not allowed; use 2-space indentation");
    const noComment = stripComment(raw);
    if (noComment.trim() === "") continue;
    if (/^---|^\.\.\./.test(noComment.trim())) throw err(i, "multi-document YAML is not supported");
    const indent = noComment.match(/^ */)[0].length;
    if (indent % 2 !== 0) throw err(i, "indentation must be a multiple of 2 spaces");
    items.push({ line: i, indent, text: noComment.trim() });
  }
  const [value, next] = parseBlock(items, 0, items.length ? items[0].indent : 0);
  if (next !== items.length) throw err(items[next].line, "unexpected content");
  return value ?? {};
}

function parseBlock(items, pos, indent) {
  if (pos >= items.length) return [null, pos];
  if (items[pos].text.startsWith("- ") || items[pos].text === "-") return parseSequence(items, pos, indent);
  return parseMapping(items, pos, indent);
}

function parseMapping(items, pos, indent) {
  const out = {};
  while (pos < items.length && items[pos].indent === indent) {
    const it = items[pos];
    if (it.text.startsWith("- ")) break;
    const m = it.text.match(/^("[^"]*"|'[^']*'|[^\s:#][^:]*?)\s*:(?:\s+(.*))?$/);
    if (!m) throw err(it.line, `expected "key: value", got "${it.text}"`);
    const key = unquote(m[1]);
    const rest = m[2];
    if (rest !== undefined && rest !== "") {
      if (/^[&*!|>]/.test(rest)) throw err(it.line, "anchors, tags and block scalars are not supported");
      out[key] = parseScalar(rest, it.line);
      pos++;
    } else {
      pos++;
      if (pos < items.length && items[pos].indent > indent) {
        const [v, next] = parseBlock(items, pos, items[pos].indent);
        out[key] = v; pos = next;
      } else if (pos < items.length && items[pos].indent === indent && items[pos].text.startsWith("- ")) {
        // sequence at same indent as key (common YAML style)
        const [v, next] = parseSequence(items, pos, indent);
        out[key] = v; pos = next;
      } else {
        out[key] = null;
      }
    }
  }
  return [out, pos];
}

function parseSequence(items, pos, indent) {
  const out = [];
  while (pos < items.length && items[pos].indent === indent && (items[pos].text.startsWith("- ") || items[pos].text === "-")) {
    const it = items[pos];
    const body = it.text === "-" ? "" : it.text.slice(2).trim();
    if (body === "") {
      pos++;
      if (pos < items.length && items[pos].indent > indent) {
        const [v, next] = parseBlock(items, pos, items[pos].indent); out.push(v); pos = next;
      } else out.push(null);
    } else if (/^("[^"]*"|'[^']*'|[^\s:#][^:]*?)\s*:(\s+.*)?$/.test(body)) {
      // mapping item: "- key: value" possibly continued by deeper-indented keys
      const childIndent = indent + 2;
      const synthetic = [{ line: it.line, indent: childIndent, text: body }];
      pos++;
      while (pos < items.length && items[pos].indent >= childIndent && !items[pos].text.startsWith("- ")) {
        synthetic.push(items[pos]); pos++;
      }
      const [v] = parseMapping(synthetic, 0, childIndent);
      out.push(v);
    } else {
      out.push(parseScalar(body, it.line)); pos++;
    }
  }
  return [out, pos];
}

function parseScalar(s, line) {
  s = s.trim();
  if (s === "[]") return [];
  if (s === "{}") return {};
  if (s.startsWith("[") && s.endsWith("]")) {
    const inner = s.slice(1, -1).trim();
    return inner === "" ? [] : splitFlow(inner).map(x => parseScalar(x, line));
  }
  if (s.startsWith("{")) throw err(line, "inline mappings are not supported; use nested keys");
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return unquote(s);
  if (s === "null" || s === "~") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function splitFlow(s) {
  const out = []; let cur = ""; let q = null;
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === ",") { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim() !== "") out.push(cur.trim());
  return out;
}

function stripComment(line) {
  let q = null; let out = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { out += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; out += ch; continue; }
    if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]))) break;
    out += ch;
  }
  return out;
}

function unquote(s) {
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}

function err(line, msg) { const e = new Error(`YAML line ${line + 1}: ${msg}`); e.line = line + 1; return e; }
