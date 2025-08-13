// This file defines a small "Domain-Specific Language" (DSL) for filtering rows
// and a helper function to apply those filters to your data tables.

import { z } from 'zod';

// Define what a valid filter node looks like
export const FilterNode = z.object({
  op: z.enum(['and', 'or', 'not', 'cmp', 'includes']),
  field: z.string().optional(),
  cmp: z.enum(['>', '>=', '<', '<=', '==', '!=']).optional(),
  value: z.any().optional(),
  children: z.array(z.any()).optional(),
});
export type FilterNode = z.infer<typeof FilterNode>;

// Function to apply a filter to an array of rows
export function applyFilter(rows: any[], node: FilterNode): any[] {
  const test = (row: any, n: FilterNode): boolean => {
    switch (n.op) {
      case 'and':
        return (n.children ?? []).every((c) => test(row, c));
      case 'or':
        return (n.children ?? []).some((c) => test(row, c));
      case 'not':
        return !(n.children && n.children[0] ? test(row, n.children[0]) : false);
      case 'cmp': {
        const raw = row[n.field!];
        const x = numOrSelf(raw);
        const a = numOrSelf(n.value);
        switch (n.cmp) {
          case '>':  return toNum(x) > toNum(a);
          case '>=': return toNum(x) >= toNum(a);
          case '<':  return toNum(x) < toNum(a);
          case '<=': return toNum(x) <= toNum(a);
          case '==': return String(raw) === String(n.value);
          case '!=': return String(raw) !== String(n.value);
          default: return false;
        }
      }
      case 'includes': {
        const v = row[n.field!];
        if (Array.isArray(v)) return v.includes(n.value);
        if (typeof v === 'string') {
          const arr = v.trim().startsWith('[')
            ? safeJsonArray(v)
            : v.split(',').map((s) => s.trim());
          return arr.includes(String(n.value));
        }
        return false;
      }
      default:
        return false;
    }
  };
  return rows.filter((r) => test(r, node));
}

// Helpers for number parsing and array parsing
function toNum(x: any) { const n = Number(x); return Number.isFinite(n) ? n : NaN; }
function numOrSelf(x: any) { const n = Number(x); return Number.isFinite(n) ? n : x; }
function safeJsonArray(s: string): any[] {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
