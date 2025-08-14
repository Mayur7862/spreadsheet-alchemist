// src/utils/schema.ts
// Build a compact schema: columns, type guesses, and sample values (no full data).

export type FieldSchema = {
  name: string;
  type: 'number' | 'string' | 'array' | 'boolean' | 'date' | 'unknown';
  samples: (string | number | boolean)[]; // small distinct set
};

export function inferSchema(rows: Record<string, any>[], maxSamples = 6): FieldSchema[] {
  if (!rows?.length) return [];
  const fields = Object.keys(rows[0] ?? {});
  const out: FieldSchema[] = [];

  for (const name of fields) {
    const values = rows.slice(0, 200).map(r => r?.[name]).filter(v => v !== undefined && v !== null);
    let type: FieldSchema['type'] = 'unknown';
    if (values.some(isArrayLike)) type = 'array';
    else if (values.every(isNumericLike)) type = 'number';
    else if (values.every(isBooleanLike)) type = 'boolean';
    else if (values.some(isDateLike)) type = 'date';
    else type = 'string';

    const uniq: any[] = [];
    for (const v of values) {
      const sv = stringifyValueSample(v, type);
      if (!uniq.includes(sv)) uniq.push(sv);
      if (uniq.length >= maxSamples) break;
    }

    out.push({ name, type, samples: uniq });
  }
  return out;
}

function isArrayLike(v: any): boolean {
  if (Array.isArray(v)) return true;
  const s = String(v ?? '').trim();
  if (s.startsWith('[') && s.endsWith(']')) { try { const a = JSON.parse(s); return Array.isArray(a); } catch {} }
  if (s.includes(',')) return false; // "a,b" is CSV, treat as string
  return false;
}
function isNumericLike(v: any): boolean { const n = Number(v); return Number.isFinite(n); }
function isBooleanLike(v: any): boolean {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === 'false' || v === true || v === false;
}
function isDateLike(v: any): boolean {
  const d = new Date(v);
  return !isNaN(d.getTime());
}
function stringifyValueSample(v: any, t: FieldSchema['type']) {
  if (t === 'array') return Array.isArray(v) ? JSON.stringify(v) : String(v);
  if (t === 'number') return Number(v);
  if (t === 'boolean') return String(v).toLowerCase() === 'true';
  return String(v);
}
