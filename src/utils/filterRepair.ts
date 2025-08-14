// src/utils/filterRepair.ts
export type FieldSchema = {
  name: string;
  type: 'number' | 'string' | 'array' | 'boolean' | 'date' | 'unknown';
  samples: (string | number | boolean)[];
};

export type FilterNode = {
  op:
    | 'and' | 'or' | 'not'
    | 'cmp' | 'includes' | 'contains' | 'in' | 'nin'
    | 'startsWith' | 'endsWith' | 'regex'
    | 'exists' | 'notExists' | 'between';
  field?: string;
  cmp?: '>' | '>=' | '<' | '<=' | '==' | '!=';
  value?: any;
  values?: any[];
  from?: any;
  to?: any;
  children?: FilterNode[];
};

export function repairFilter(
  node: FilterNode,
  schema: FieldSchema[],
  { soften = false }: { soften?: boolean } = {}
): FilterNode {
  const cols = schema.map((s) => s.name);
  const types: Record<string, FieldSchema['type']> = Object.fromEntries(
    schema.map((s) => [s.name, s.type])
  );

  // detect list-like string columns by samples (CSV or JSON array-like)
  const listy: Record<string, boolean> = {};
  for (const s of schema) {
    const isList =
      s.type === 'array' ||
      s.samples.some((v) => {
        const str = String(v ?? '').trim();
        return (s.type === 'string' && (str.includes(',') || looksJsonArray(str))) || looksJsonArray(str);
      });
    listy[s.name] = !!isList;
  }

  const fixField = (f?: string): string | undefined => {
    if (!f) return f;
    // exact
    let m = cols.find((c) => c === f);
    if (m) return m;
    // case-insensitive exact
    m = cols.find((c) => c.toLowerCase() === f.toLowerCase());
    if (m) return m;
    // fuzzy
    const norm = normalize(f);
    let best: { col: string; score: number } | null = null;
    for (const c of cols) {
      const s = stringSim(norm, normalize(c));
      if (!best || s > best.score) best = { col: c, score: s };
    }
    if (best && best.score >= 0.65) return best.col;
    // substring fallback
    m = cols.find((c) => normalize(c).includes(norm));
    return m ?? f;
  };

  const coerceForField = (f: string | undefined, v: any): any => {
    if (!f) return v;
    const t = types[f] ?? 'unknown';
    switch (t) {
      case 'number': {
        const n = Number(v);
        return Number.isFinite(n) ? n : v;
      }
      case 'boolean': {
        const s = String(v).trim().toLowerCase();
        if (s === 'true' || v === true) return true;
        if (s === 'false' || v === false) return false;
        return v;
      }
      case 'array': {
        if (Array.isArray(v)) return v;
        const s = String(v ?? '').trim();
        if (!s) return [];
        if (looksJsonArray(s)) {
          try {
            const arr = JSON.parse(s);
            if (Array.isArray(arr)) return arr;
          } catch {}
        }
        // CSV -> array of strings/numbers
        return s
          .split(/[,;]+/)
          .map((x) => parseMaybeNumber(x.trim()))
          .filter((x) => x !== '');
      }
      case 'date': {
        const d = new Date(v);
        return isNaN(d.getTime()) ? v : d.toISOString();
      }
      default:
        return v; // string/unknown
    }
  };

  const walk = (n: FilterNode): FilterNode => {
    if (!n || typeof n !== 'object') return n;
    if (n.children && Array.isArray(n.children)) {
      return { ...n, children: n.children.map(walk) };
    }

    const mappedField = fixField(n.field);
    const fieldType = mappedField ? types[mappedField] ?? 'unknown' : 'unknown';
    const isList = !!(mappedField && listy[mappedField]);

    let fixed: FilterNode = { ...n, field: mappedField };

    // Coerce values
    if (n.op === 'cmp' || n.op === 'contains' || n.op === 'includes' || n.op === 'startsWith' || n.op === 'endsWith' || n.op === 'regex') {
      fixed.value = coerceForField(mappedField, n.value);
    } else if (n.op === 'in' || n.op === 'nin') {
      fixed.values = (n.values ?? []).map((v) => coerceForField(mappedField, v));
    } else if (n.op === 'between') {
      fixed.from = coerceForField(mappedField, n.from);
      fixed.to = coerceForField(mappedField, n.to);
    }

    // 🔧 Heuristic upgrades for list-like fields
    if (isList) {
      // If the model did cmp== or contains on a list-like field → use includes
      if (fixed.op === 'cmp' && fixed.cmp === '==') {
        fixed = { op: 'includes', field: mappedField, value: fixed.value };
      }
      if (fixed.op === 'contains') {
        fixed = { op: 'includes', field: mappedField, value: fixed.value };
      }
    }

    // Optional softening: strict equals on plain string → contains
    if (
      soften &&
      fixed.op === 'cmp' &&
      fixed.cmp === '==' &&
      mappedField &&
      (fieldType === 'string' || fieldType === 'unknown') &&
      !isList // don't override list-like includes
    ) {
      fixed = { op: 'contains', field: mappedField, value: String((fixed as FilterNode).value ?? '') };
    }

    return fixed;
  };

  return walk(node);
}

// --- helpers ---

function looksJsonArray(s: string) {
  return s.startsWith('[') && s.endsWith(']');
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[\s_-]+/g, '');
}

// cheap Jaccard on 3-grams for fuzzy match
function stringSim(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const A = ngrams(a, 3), B = ngrams(b, 3);
  const inter = A.filter((x) => B.includes(x)).length;
  const union = new Set([...A, ...B]).size;
  return union ? inter / union : 0;
}
function ngrams(s: string, n: number): string[] {
  if (s.length <= n) return [s];
  const out: string[] = [];
  for (let i = 0; i <= s.length - n; i++) out.push(s.slice(i, i + n));
  return out;
}

function parseMaybeNumber(x: string): string | number {
  const n = Number(x);
  return Number.isFinite(n) ? n : x;
}
