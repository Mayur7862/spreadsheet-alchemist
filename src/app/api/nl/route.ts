// src/app/api/nl/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { nlToDsl } from '@/utils/nlToDsl';

const ReqSchema = z.object({
  entity: z.enum(['clients', 'workers', 'tasks']),
  text: z.string().min(1),
  fields: z.array(z.string()).default([]), // <-- accept headers from client
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { entity, text, fields } = parsed.data;

  // Deterministic parse with entity + fields
  const dsl = nlToDsl(text, entity, fields);
  if (dsl) {
    return NextResponse.json({
      kind: 'filter',
      entity,
      filter: dsl,
      source: 'deterministic',
    });
  }

  // Optional: Ollama fallback (dev only)
  if (process.env.AI_PROVIDER === 'local') {
    try {
      const prompt = buildPrompt(text, entity, fields);
      const r = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || 'mistral',
          prompt,
          stream: false,
          options: { temperature: 0.1 },
        }),
      }).then((r) => r.json());

      const raw = (r?.response ?? '').trim();
      const json = firstJson(raw);
      if (!json || json.kind !== 'filter' || !json.filter) {
        return NextResponse.json({ error: 'LLM could not parse', raw }, { status: 422 });
      }
      return NextResponse.json({ ...json, source: 'ollama' });
    } catch (e: any) {
      return NextResponse.json({ error: 'Ollama unreachable', details: String(e) }, { status: 502 });
    }
  }

  return NextResponse.json({ error: 'Could not parse the query', source: 'none' }, { status: 422 });
}

function buildPrompt(userText: string, entity: 'clients'|'workers'|'tasks', fields: string[]) {
  return `
Return ONLY valid JSON in this schema:

{
  "kind": "filter",
  "entity": "clients|workers|tasks",
  "filter": { "op":"and|or|not|cmp|includes", "field":"FieldName?", "cmp":">|>=|<|<=|==|!=", "value": <any>, "children": [] }
}

Rules:
- Map user words to one of these actual field names (case-insensitive): ${JSON.stringify(fields)}
- Equality words ("must be", "should be", "is", "equals", "=") -> {"op":"cmp","field":"F","cmp":"==","value":V}
- Includes words ("includes", "contains") -> {"op":"includes","field":"F","value":V}
- "phase N" -> PreferredPhases includes N (if present in fields)
- Combine multiple clauses with {"op":"and","children":[...]}.

Entity is "${entity}" unless the user clearly targets another.

User: """${userText}"""
Return ONLY the JSON.
`;
}

function firstJson(s: string) {
  const start = s.indexOf('{'); const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) { try { return JSON.parse(s.slice(start, end + 1)); } catch {} }
  try { return JSON.parse(s); } catch {}
  return null;
}
