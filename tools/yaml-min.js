/**
 * yaml-min.js — Parser de un subconjunto de YAML suficiente para GAME.md (sin dependencias).
 * Soporta: front-matter ---, mapas de bloque (2 niveles), flujo {..}/[..], escalares
 * (number/bool/string), y claves/valores con espacios. Compartido por game-lint y game-export.
 */
function splitFrontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: null, body: text };
  return { fm: m[1], body: m[2] || '' };
}
function parseScalar(s) {
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s !== '' && !isNaN(Number(s))) return Number(s);
  return s;
}
function splitTop(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}
function parseValue(s) {
  s = s.trim();
  if (s.startsWith('{')) return parseFlowMap(s);
  if (s.startsWith('[')) return parseFlowList(s);
  return parseScalar(s);
}
function parseFlowMap(s) {
  s = s.trim().slice(1, -1);
  const obj = {};
  for (const part of splitTop(s)) {
    if (!part.trim()) continue;
    const ci = part.indexOf(':');
    obj[part.slice(0, ci).trim()] = parseValue(part.slice(ci + 1));
  }
  return obj;
}
function parseFlowList(s) {
  s = s.trim().slice(1, -1);
  return splitTop(s).map(p => parseValue(p)).filter(v => v !== '');
}
function parseYamlSubset(src) {
  const lines = src.split('\n');
  let i = 0;
  const indentOf = l => (l.match(/^ */) || [''])[0].length;
  function parseBlock(indent) {
    const obj = {};
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '' || /^\s*#/.test(line)) { i++; continue; }
      const ind = indentOf(line);
      if (ind < indent) break;
      if (ind > indent) { i++; continue; }
      const content = line.trim();
      const ci = content.indexOf(':');
      const key = content.slice(0, ci).trim();
      const rest = content.slice(ci + 1).trim();
      i++;
      if (rest === '') {
        let child = indent + 2, j = i;
        while (j < lines.length && lines[j].trim() === '') j++;
        if (j < lines.length) child = indentOf(lines[j]);
        obj[key] = child > indent ? parseBlock(child) : {};
      } else {
        obj[key] = parseValue(rest);
      }
    }
    return obj;
  }
  return parseBlock(0);
}
const _api = { splitFrontMatter, parseYamlSubset };
if (typeof module !== 'undefined' && module.exports) module.exports = _api;
if (typeof window !== 'undefined') window.YamlMin = _api;
