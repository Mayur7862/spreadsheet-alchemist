// src/utils/nlFallback.ts
import type { FieldSchema } from './filterRepair';

export type FilterNode = {
  op:
    | 'and' | 'or' | 'not'
    | 'cmp' | 'includes' | 'contains' | 'in' | 'nin'
    | 'startsWith' | 'endsWith' | 'regex'
    | 'exists' | 'notExists' | 'between';
  field?: string;
  cmp?: '>' | '>=' | '<' | '<=' | '==' | '!=';
  value?: string | number | boolean;
  values?: (string | number | boolean)[];
  from?: string | number | boolean;
  to?: string | number | boolean;
  children?: FilterNode[];
};

export function heuristicFilter(entity: 'clients'|'workers'|'tasks', text: string, schema: FieldSchema[]): FilterNode | null {
  const T = text.toLowerCase();

  // helper: does this column exist?
  const has = (name: string) => schema.some(s => s.name === name);

  // workers — common intents
  if (entity === 'workers') {
    // "skills include X" / "skills contains X"
    if (/skills?\s+(include|includes|contain|contains)\s+/i.test(text) && has('Skills')) {
      const val = extractAfter(text, /(include|includes|contain|contains)/i);
      if (val) return { op: 'includes', field: 'Skills', value: val };
    }
    // "group = X" / "worker group = X"
    if (/group/i.test(text) && has('WorkerGroup')) {
      const val = extractAfter(text, /(=|equals|is)/i) || extractAfter(text, /(group)/i);
      if (val) return { op: 'cmp', field: 'WorkerGroup', cmp: '==', value: val };
    }
    // "available slots includes N"
    if (/slot/i.test(text) && has('AvailableSlots')) {
      const num = extractNumber(text);
      if (num !== null) return { op: 'includes', field: 'AvailableSlots', value: num };
    }
    // "qualification > N"
    if (/qual/i.test(text) && has('QualificationLevel')) {
      const num = extractNumber(text);
      if (num !== null) return { op: 'cmp', field: 'QualificationLevel', cmp: '>', value: num };
    }
  }

  // clients — common intents
  if (entity === 'clients') {
    if (/priority/i.test(text) && has('PriorityLevel')) {
      const cmp = pickCmp(text);
      const num = extractNumber(text);
      if (cmp && num !== null) return { op: 'cmp', field: 'PriorityLevel', cmp, value: num };
    }
    if (/group/i.test(text) && has('GroupTag')) {
      const val = extractAfter(text, /(=|equals|is)/i) || extractAfter(text, /(group)/i);
      if (val) return { op: 'cmp', field: 'GroupTag', cmp: '==', value: val };
    }
    if (/requested/i.test(text) && has('RequestedTaskIDs')) {
      const id = extractTaskId(text);
      if (id) return { op: 'contains', field: 'RequestedTaskIDs', value: id };
    }
  }

  // tasks — common intents
  if (entity === 'tasks') {
    if (/duration/i.test(text) && has('Duration')) {
      const cmp = pickCmp(text);
      const num = extractNumber(text);
      if (cmp && num !== null) return { op: 'cmp', field: 'Duration', cmp, value: num };
    }
    if (/phase/i.test(text) && has('PreferredPhases')) {
      const num = extractNumber(text);
      if (num !== null) return { op: 'includes', field: 'PreferredPhases', value: num };
    }
    if (/skill/i.test(text) && has('RequiredSkills')) {
      const val = extractAfter(text, /(include|includes|contain|contains)/i);
      if (val) return { op: 'includes', field: 'RequiredSkills', value: val };
    }
  }

  return null;
}

// --- tiny helpers ---

function extractAfter(s: string, regex: RegExp): string | null {
  const m = s.match(regex);
  if (!m) return null;
  const rest = s.slice(m.index! + m[0].length).trim();
  // take first token/phrase (up to comma/end)
  const token = rest.split(/[.,;]| and | or /i)[0].trim();
  return sanitize(token);
}

function extractNumber(s: string): number | null {
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function pickCmp(s: string): '>'|'>='|'<'|'<='|'=='|'!='|null {
  const t = s.toLowerCase();
  if (t.includes('>=')) return '>=';
  if (t.includes('<=')) return '<=';
  if (t.includes('>')) return '>';
  if (t.includes('<')) return '<';
  if (t.includes('!=')) return '!=';
  if (t.includes('=') || t.includes(' equals ') || t.includes(' is ')) return '==';
  if (t.includes('less than')) return '<';
  if (t.includes('greater than')) return '>';
  return null;
}

function extractTaskId(s: string): string | null {
  const m = s.match(/\bT\d+\b/i);
  return m ? m[0] : null;
}

function sanitize(v: string): string {
  return v.replace(/^["'`]/, '').replace(/["'`]$/, '').trim();
}
