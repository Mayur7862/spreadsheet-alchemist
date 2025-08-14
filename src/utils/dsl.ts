// src/utils/dsl.ts
// Filter DSL + robust evaluator (case-insensitive, list-aware, safe).
// AI will output this structure; we apply it locally to filter rows.

import { z } from 'zod';

export const FilterNode = z.object({
  op: z.enum([
    'and', 'or', 'not',
    'cmp',           // numeric or string compare: >, >=, <, <=, ==, !=
    'includes',      // list/CSV/JSON-array contains value
    'contains',      // substring contains (string fields)
    'in',            // field value in set
    'nin',           // field value NOT in set
    'startsWith',
    'endsWith',
    'regex',
    'exists',
    'notExists',
    'between',       // numeric or date range
  ]),
  field: z.string().optional(),
  cmp: z.enum(['>', '>=', '<', '<=', '==', '!=']).optional(),
  value: z.any().optional(),
  values: z.array(z.any()).optional(),   // for in/nin
  from: z.any().optional(),              // for between
  to: z.any().optional(),                // for between
  children: z.array(z.any()).optional(),
});
export type FilterNode = z.infer<typeof FilterNode>;

export function applyFilter(rows: any[], node: FilterNode): any[] {
  const test = (row: any, n: FilterNode): boolean => {
    switch (n.op) {
      case 'and': return (n.children ?? []).every((c) => test(row, c));
      case 'or':  return (n.children ?? []).some((c) => test(row, c));
      case 'not': return !(n.children && n.children[0] ? test(row, n.children[0]) : false);

      case 'cmp': {
        const Lraw = row[n.field!];
        const Rraw = n.value;
        const Ln = toNum(Lraw), Rn = toNum(Rraw);
        const bothNum = Number.isFinite(Ln) && Number.isFinite(Rn);
        if (bothNum) {
          switch (n.cmp) {
            case '>': return Ln > Rn;
            case '>=': return Ln >= Rn;
            case '<': return Ln < Rn;
            case '<=': return Ln <= Rn;
            case '==': return Ln === Rn;
            case '!=': return Ln !== Rn;
            default: return false;
          }
        } else {
          const Ls = normStr(Lraw), Rs = normStr(Rraw);
          switch (n.cmp) {
            case '==': return Ls === Rs;
            case '!=': return Ls !== Rs;
            case '>': return Ls > Rs;
            case '>=': return Ls >= Rs;
            case '<': return Ls < Rs;
            case '<=': return Ls <= Rs;
            default: return false;
          }
        }
      }

      case 'includes': {
        const hay = cellToTokens(row[n.field!]);
        const needle = normStr(n.value);
        return hay.some((t) => t === needle || t.includes(needle));
      }

      case 'contains': {
        const Ls = normStr(row[n.field!]);
        const Rs = normStr(n.value);
        return Ls.includes(Rs);
      }

      case 'in': {
        const set = (n.values ?? []).map(normStr);
        const Ls = normStr(row[n.field!]);
        return set.includes(Ls);
      }

      case 'nin': {
        const set = (n.values ?? []).map(normStr);
        const Ls = normStr(row[n.field!]);
        return !set.includes(Ls);
      }

      case 'startsWith': {
        const Ls = normStr(row[n.field!]);
        const Rs = normStr(n.value);
        return Ls.startsWith(Rs);
      }

      case 'endsWith': {
        const Ls = normStr(row[n.field!]);
        const Rs = normStr(n.value);
        return Ls.endsWith(Rs);
      }

      case 'regex': {
        const L = String(row[n.field!] ?? '');
        try {
          const r = new RegExp(String(n.value), 'i');
          return r.test(L);
        } catch { return false; }
      }

      case 'exists': {
        const v = row[n.field!];
        return v !== undefined && v !== null && String(v).trim() !== '';
      }

      case 'notExists': {
        const v = row[n.field!];
        return v === undefined || v === null || String(v).trim() === '';
      }

      case 'between': {
        const L = toNum(row[n.field!]);
        const A = toNum(n.from), B = toNum(n.to);
        if (Number.isFinite(L) && Number.isFinite(A) && Number.isFinite(B)) {
          const lo = Math.min(A, B), hi = Math.max(A, B);
          return L >= lo && L <= hi;
        }
        // string/date fallback: lexical compare of normalized strings
        const Ls = normStr(row[n.field!]);
        const As = normStr(n.from); const Bs = normStr(n.to);
        const lo = As < Bs ? As : Bs; const hi = As < Bs ? Bs : As;
        return Ls >= lo && Ls <= hi;
      }

      default: return false;
    }
  };
  return rows.filter((r) => test(r, node));
}

// Helpers
function toNum(x: any): number { const n = Number(x); return Number.isFinite(n) ? n : NaN; }
function normStr(x: any): string { return String(x ?? '').trim().toLowerCase(); }

function cellToTokens(v: any): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(normStr).filter(Boolean);
  const s = String(v).trim();
  if (s.startsWith('[') && s.endsWith(']')) {
    try { const a = JSON.parse(s); if (Array.isArray(a)) return a.map(normStr).filter(Boolean); } catch {}
  }
  return s.split(/[,;]+/).map(normStr).filter(Boolean);
}
