// This file converts natural language queries into structured filter JSON
// that the `applyFilter` function can use to filter datasets.

import { FilterNode } from './dsl';

export function nlToDsl(nl: string): FilterNode | null {
  const text = nl.toLowerCase();

  // Detect entity type
  let field = '';
  if (text.includes('priority')) field = 'PriorityLevel';
  else if (text.includes('duration')) field = 'Duration';
  else if (text.includes('phase')) field = 'PreferredPhases';

  // Detect comparison
  const cmpMatch = text.match(/less than|more than|equals|equal to|not equal to|>=|<=|>|</);
  let cmp: FilterNode['cmp'] = '==';
  let value: any = '';

  if (cmpMatch) {
    switch (cmpMatch[0]) {
      case 'less than': cmp = '<'; break;
      case 'more than': cmp = '>'; break;
      case 'equals':
      case 'equal to': cmp = '=='; break;
      case 'not equal to': cmp = '!='; break;
      case '>': cmp = '>'; break;
      case '<': cmp = '<'; break;
      case '>=': cmp = '>='; break;
      case '<=': cmp = '<='; break;
    }
    const numMatch = text.match(/\d+/);
    if (numMatch) value = Number(numMatch[0]);
  }

  if (!field) return null;

  return { op: 'cmp', field, cmp, value };
}
