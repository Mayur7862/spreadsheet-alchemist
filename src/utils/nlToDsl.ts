// src/utils/nlToDsl.ts
// Converts natural language into a structured FilterNode, using:
// - Clause splitting by "and", commas, or phrases
// - Equality words: "must be", "is", "equals", "="
// - Includes words: "includes", "contains"
// - Numeric comparisons: >, >=, <, <=, ==, != and word forms ("less than", "more than")
// - Field normalization using the active entity and ACTUAL columns (passed from client)

import { FilterNode } from './dsl';

export type Entity = 'clients' | 'workers' | 'tasks';

/**
 * Main entry: parse NL text into a FilterNode.
 * @param nl      The user's natural language query
 * @param entity  Active entity (tab): 'clients' | 'workers' | 'tasks'
 * @param fields  Actual column headers for the active entity (from your data)
 */
export function nlToDsl(nl: string, entity: Entity, fields: string[] = []): FilterNode | null {
  const text = (nl || '').trim();
  if (!text) return null;

  const clauses = splitClauses(text);
  const children: FilterNode[] = [];

  for (const clauseRaw of clauses) {
    const clause = clauseRaw.trim();

    // 1) includes/contains: "<field> includes <val>" or "<field> contains <val>"
    const inc = clause.match(/^([\w\s]+?)\s+(?:includes?|contain(?:s)?)\s+("?[\w\- ]+"?|\d+)$/i);
    if (inc) {
      const fieldGuess = normalizeField(inc[1], entity, fields);
      const rawVal = inc[2].replace(/^"|"$/g, '').trim();
      const value = asNumberIfNumeric(rawVal);
      if (fieldGuess) {
        children.push({ op: 'includes', field: fieldGuess, value });
        continue;
      }
    }

    // 2) equality phrases: "<field> (must be|should be|is|equals|=) <val>"
    const eq = clause.match(/^([\w\s]+?)\s+(?:must be|should be|is|equals|=)\s+("?[\w\- ]+"?|\d+)$/i);
    if (eq) {
      const fieldGuess = normalizeField(eq[1], entity, fields);
      const rawVal = eq[2].replace(/^"|"$/g, '').trim();
      const value = asNumberIfNumeric(rawVal);
      if (fieldGuess) {
        children.push({ op: 'cmp', field: fieldGuess, cmp: '==', value });
        continue;
      }
    }

    // 3) symbolic comparisons: "<field> (>=|<=|>|<|==|!=|=) <number>"
    const sym = clause.match(/^([\w\s]+?)\s*(>=|<=|>|<|==|!=|=)\s*(-?\d+(?:\.\d+)?)$/i);
    if (sym) {
      const fieldGuess = normalizeField(sym[1], entity, fields);
      const cmp = (sym[2] === '=' ? '==' : sym[2]) as FilterNode['cmp'];
      const value = Number(sym[3]);
      if (fieldGuess) {
        children.push({ op: 'cmp', field: fieldGuess, cmp, value });
        continue;
      }
    }

    // 4) worded numeric comparisons: "<field> less than 4", "more than 2", "at least 3", "at most 5", "not equal to 7"
    const wordCmp = clause.match(/^([\w\s]+?)\s+(less than|more than|greater than|at least|at most|not equal to|equal to|equals)\s+(-?\d+(?:\.\d+)?)$/i);
    if (wordCmp) {
      const fieldGuess = normalizeField(wordCmp[1], entity, fields);
      const cmp = toCmp(wordCmp[2]) as FilterNode['cmp'];
      const value = Number(wordCmp[3]);
      if (fieldGuess && cmp) {
        children.push({ op: 'cmp', field: fieldGuess, cmp, value });
        continue;
      }
    }

    // 5) shortcut patterns (domain-aware):
    //    "phase 2" -> PreferredPhases includes 2 (tasks)
    const ph = clause.match(/^phase\s+(-?\d+)$/i);
    if (ph) {
      const value = Number(ph[1]);
      const fieldGuess = preferField(['PreferredPhases'], fields) || 'PreferredPhases';
      children.push({ op: 'includes', field: fieldGuess, value });
      continue;
    }

    //    "skill coding" / "skills coding" -> Skills includes "coding" (workers) or RequiredSkills (tasks)
    const skill = clause.match(/^skills?\s+("?[\w\- ]+"?)$/i);
    if (skill) {
      const rawVal = skill[1].replace(/^"|"$/g, '').trim();
      const value = asNumberIfNumeric(rawVal);
      const fallback = entity === 'workers' ? 'Skills' : 'RequiredSkills';
      const fieldGuess = preferField([fallback], fields) || fallback;
      children.push({ op: 'includes', field: fieldGuess, value });
      continue;
    }

    // 6) bare equality without keyword: "<field> <value>" → treat as equals string
    const bare = clause.match(/^([\w\s]+?)\s+("?[\w\- ]+"?|\d+)$/i);
    if (bare) {
      const fieldGuess = normalizeField(bare[1], entity, fields);
      const rawVal = bare[2].replace(/^"|"$/g, '').trim();
      const value = asNumberIfNumeric(rawVal);
      if (fieldGuess) {
        // For list-like fields (Skills/RequiredSkills/PreferredPhases/AvailableSlots), treat bare as includes
        if (isListyField(fieldGuess)) {
          children.push({ op: 'includes', field: fieldGuess, value });
        } else {
          children.push({ op: 'cmp', field: fieldGuess, cmp: '==', value });
        }
        continue;
      }
    }

    // If no pattern matched, ignore clause conservatively.
  }

  if (!children.length) return null;
  return children.length === 1 ? children[0] : { op: 'and', children };
}

// --- helpers ---

function splitClauses(q: string): string[] {
  // Split on "and", commas, semicolons; also allow multiple spaces
  return q
    .replace(/\bwhere\b/gi, ' ')
    .replace(/\bwith\b/gi, ' ')
    .split(/\s+and\s+|,|;/gi)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toCmp(word: string) {
  const w = word.toLowerCase();
  if (w.includes('less')) return '<';
  if (w.includes('more') || w.includes('greater')) return '>';
  if (w.includes('at least')) return '>=';
  if (w.includes('at most')) return '<=';
  if (w.includes('not equal')) return '!=';
  if (w.includes('equal')) return '==';
  if (w === 'equals') return '==';
  return null;
}

function asNumberIfNumeric(v: string): any {
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

/**
 * Normalize a user-typed field phrase to an actual column name.
 * Uses entity-aware synonyms and the actual headers provided by the client.
 */
function normalizeField(raw: string, entity: Entity, fields: string[]): string | null {
  const s = raw.toLowerCase().trim().replace(/\s+/g, ' ');

  // Entity-aware synonyms
  const syn: Record<Entity, Record<string, string>> = {
    clients: {
      'priority': 'PriorityLevel',
      'priority level': 'PriorityLevel',
      'group': 'GroupTag',
      'group tag': 'GroupTag',
      'requested': 'RequestedTaskIDs',
      'requested tasks': 'RequestedTaskIDs',
      'name': 'ClientName',
      'id': 'ClientID',
      'attributes': 'AttributesJSON',
    },
    workers: {
      'group': 'WorkerGroup',
      'worker group': 'WorkerGroup',
      'skills': 'Skills',
      'skill': 'Skills',
      'available slots': 'AvailableSlots',
      'slot': 'AvailableSlots',
      'max load per phase': 'MaxLoadPerPhase',
      'qualification': 'QualificationLevel',
      'name': 'WorkerName',
      'id': 'WorkerID',
    },
    tasks: {
      'duration': 'Duration',
      'max concurrent': 'MaxConcurrent',
      'concurrent': 'MaxConcurrent',
      'preferred phases': 'PreferredPhases',
      'phase': 'PreferredPhases',
      'required skills': 'RequiredSkills',
      'skills': 'RequiredSkills',
      'category': 'Category',
      'name': 'TaskName',
      'id': 'TaskID',
    },
  };

  if (syn[entity][s]) return preferField([syn[entity][s]], fields) || syn[entity][s];

  // Try exact header match (case-insensitive)
  const exact = fields.find((f) => f.toLowerCase() === s);
  if (exact) return exact;

  // Try collapsed (remove spaces) header match
  const collapsed = s.replace(/\s+/g, '');
  const found = fields.find((f) => f.toLowerCase().replace(/\s+/g, '') === collapsed);
  if (found) return found;

  // As a last resort, TitleCase the raw and hope it matches exactly
  const guess = toTitleCaseNoSpaces(s);
  if (fields.includes(guess)) return guess;

  return null;
}

function preferField(candidates: string[], fields: string[]) {
  for (const c of candidates) {
    const hit = fields.find((f) => f.toLowerCase() === c.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

function toTitleCaseNoSpaces(s: string) {
  return s
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join('');
}

function isListyField(field: string) {
  return /skills|preferredphases|availableslots|requestedtaskids/i.test(field);
}
