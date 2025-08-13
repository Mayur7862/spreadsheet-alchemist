// src/app/api/nl/route.ts
// API to convert natural language text into a structured filter JSON.
// 1) Try deterministic parser (free).
// 2) If it fails and AI_PROVIDER=local, ask Ollama (Mistral) for the same JSON schema.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { nlToDsl } from '@/utils/nlToDsl';

const ReqSchema = z.object({
  entity: z.enum(['clients', 'workers', 'tasks']),   // which table the user is searching
  text: z.string().min(1),                           // the natural language query
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

  const { entity, text } = parsed.data;

  // 1) Deterministic parser (no cost, fast, reliable)
  const dsl = nlToDsl(text);
  if (dsl) {
    return NextResponse.json({
      kind: 'filter',
      entity,
      filter: dsl,
      source: 'deterministic',
    });
  }

  // 2) Optional: Ollama fallback for exotic phrasings (dev only)
  // NOTE: Ollama won't run on Vercel; this is for local development only.
  if (process.env.AI_PROVIDER === 'local') {
    try {
      const prompt = buildPrompt(text, entity);
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
      return NextResponse.json(
        { error: 'Ollama unreachable', details: String(e) },
        { status: 502 }
      );
    }
  }

  // If we get here, we couldn't parse. Keep it explicit for the UI.
  return NextResponse.json(
    { error: 'Could not parse the query', source: 'none' },
    { status: 422 }
  );
}

// Prompt that forces STRICT JSON output in the schema we expect
function buildPrompt(userText: string, entity: 'clients'|'workers'|'tasks') {
  return `
You are a parser. Return ONLY valid JSON (no prose, no backticks).
Translate the user's natural language into this schema:

{
  "kind": "filter",
  "entity": "clients|workers|tasks",
  "filter": {
    "op": "and|or|not|cmp|includes",
    "field": "FieldName?",
    "cmp": ">|>=|<|<=|==|!=",
    "value": <any>,
    "children": [ <FilterNode> ... ]
  }
}

Rules:
- "cmp" compares a field to a number/string: {"op":"cmp","field":"Duration","cmp":">","value":2}
- "includes" checks if a list or comma-separated string contains a value:
  {"op":"includes","field":"PreferredPhases","value":3}
- Combine with "and"/"or" using "children".
- Entity is "${entity}" unless the user implies otherwise.

User: """${userText}"""
Return ONLY the JSON.
`;
}

// Extract the first JSON object from a text blob
function firstJson(s: string) {
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch {}
  }
  try { return JSON.parse(s); } catch {}
  return null;
}
