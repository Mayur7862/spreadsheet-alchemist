// src/utils/nlClientHeuristic.ts
import type { FieldSchema } from './filterRepair';

export type FilterNode = {
  op: 'and'|'or'|'not'|'cmp'|'includes'|'contains'|'in'|'nin'|'startsWith'|'endsWith'|'regex'|'exists'|'notExists'|'between';
  field?: string;
  cmp?: '>'|'>='|'<'|'<='|'=='|'!=';
  value?: any;
  values?: any[];
  from?: any;
  to?: any;
  children?: FilterNode[];
};

export function clientHeuristic(entity: 'clients'|'workers'|'tasks', text: string, schema: FieldSchema[]): FilterNode | null {
  const has = (c: string) => schema.some(s => s.name === c);
  const T = text.toLowerCase();

  if (entity === 'workers') {
    if (/skill/.test(T) && /(include|contains)/.test(T) && has('Skills')) {
      const v = extractAfter(text, /(include|includes|contain|contains)/i);
      if (v) return { op: 'includes', field: 'Skills', value: v };
    }
    if (/group/.test(T) && has('WorkerGroup')) {
      const v = extractAfter(text, /(=|equals|is)/i) || extractAfter(text, /(group)/i);
      if (v) return { op: 'cmp', field: 'WorkerGroup', cmp: '==', value: v };
    }
    if (/slot/.test(T) && has('AvailableSlots')) {
      const n = extractNumber(T);
      if (n !== null) return { op: 'includes', field: 'AvailableSlots', value: n };
    }
  }

  if (entity === 'clients') {
    if (/priority/.test(T) && has('PriorityLevel')) {
      const cmp = pickCmp(T); const n = extractNumber(T);
      if (cmp && n !== null) return { op: 'cmp', field: 'PriorityLevel', cmp, value: n };
    }
    if (/group/.test(T) && has('GroupTag')) {
      const v = extractAfter(text, /(=|equals|is)/i);
      if (v) return { op: 'cmp', field: 'GroupTag', cmp: '==', value: v };
    }
    if (/requested/.test(T) && has('RequestedTaskIDs')) {
      const id = (text.match(/\bT\d+\b/i) || [])[0];
      if (id) return { op: 'contains', field: 'RequestedTaskIDs', value: id };
    }
  }

  if (entity === 'tasks') {
    if (/duration/.test(T) && has('Duration')) {
      const cmp = pickCmp(T); const n = extractNumber(T);
      if (cmp && n !== null) return { op: 'cmp', field: 'Duration', cmp, value: n };
    }
    if (/phase/.test(T) && has('PreferredPhases')) {
      const n = extractNumber(T);
      if (n !== null) return { op: 'includes', field: 'PreferredPhases', value: n };
    }
    if (/skill/.test(T) && /(include|contains)/.test(T) && has('RequiredSkills')) {
      const v = extractAfter(text, /(include|includes|contain|contains)/i);
      if (v) return { op: 'includes', field: 'RequiredSkills', value: v };
    }
  }
  return null;
}

function extractAfter(s: string, re: RegExp) {
  const m = s.match(re); if (!m) return null;
  const rest = s.slice(m.index! + m[0].length).trim();
  return rest.split(/[.,;]| and | or /i)[0]?.replace(/^["'`]|["'`]$/g, '').trim() || null;
}
function extractNumber(s: string) { const m = s.match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; }
function pickCmp(s: string): any { if (s.includes('>=')) return '>='; if (s.includes('<=')) return '<='; if (s.includes('>')) return '>'; if (s.includes('<')) return '<'; if (s.includes('!=')) return '!='; if (/\bequals\b|\bis\b|=/.test(s)) return '=='; if (s.includes('less than')) return '<'; if (s.includes('greater than')) return '>'; return null; }
