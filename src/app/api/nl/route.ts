// src/app/api/nl/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { repairFilter } from '@/utils/filterRepair';
import { heuristicFilter } from '@/utils/nlFallback';

const ReqSchema = z.object({
  entity: z.enum(['clients','workers','tasks']),
  text: z.string().min(1),
  schema: z.array(z.object({
    name: z.string(),
    type: z.string(),
    samples: z.array(z.union([z.string(), z.number(), z.boolean()])),
  })).default([]),
});

const FilterNode = z.object({
  op: z.enum(['and','or','not','cmp','includes','contains','in','nin','startsWith','endsWith','regex','exists','notExists','between']),
  field: z.string().optional(),
  cmp: z.enum(['>','>=','<','<=','==','!=']).optional(),
  value: z.any().optional(),
  values: z.array(z.any()).optional(),
  from: z.any().optional(),
  to: z.any().optional(),
  children: z.array(z.any()).optional(),
});
const Envelope = z.object({
  kind: z.literal('filter'),
  entity: z.string(),
  filter: FilterNode,
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }
  const { entity, text, schema } = parsed.data;

  const base  = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:0.5b-instruct';

  const pre = await preflight(base).catch((e) => ({ ok: false, error: String(e) }));
  if (!pre?.ok) return NextResponse.json({ error: 'AI backend not reachable', reason: 'preflight_failed', preflight: pre }, { status: 502 });
  //if (!pre.models.includes(model)) return NextResponse.json({ error: `Model "${model}" not found`, reason: 'model_missing', available: pre.models }, { status: 502 });

  const sys = systemPrompt();
  const p1 = userPrompt(entity, text, schema, true);
  const r1 = await callOllama(base, model, sys, p1);
  const j1 = normalizeAndParse(r1);
  const v1 = Envelope.safeParse(j1);
  if (v1.success) {
    const repaired = finalizeFilter(entity, v1.data.filter as any, schema as any, text);
    return NextResponse.json({ kind: 'filter', entity, filter: repaired, source: 'ollama' });
  }

  const p2 = userPrompt(entity, text, schema, false);
  const r2 = await callOllama(base, model, sys, p2);
  const j2 = normalizeAndParse(r2);
  const v2 = Envelope.safeParse(j2);
  if (v2.success) {
    const repaired = finalizeFilter(entity, v2.data.filter as any, schema as any, text);
    return NextResponse.json({ kind: 'filter', entity, filter: repaired, source: 'ollama' });
  }

  // Last-resort: heuristic without AI
  const hf = heuristicFilter(entity, text, schema as any);
  if (hf) {
    return NextResponse.json({ kind: 'filter', entity, filter: hf, source: 'heuristic' });
  }

  return NextResponse.json(
    { error: 'AI did not return a valid filter JSON', reason: (!r1 && !r2) ? 'no_response' : 'invalid_json', rawFirst: r1, rawRetry: r2 },
    { status: 422 }
  );
}

function finalizeFilter(entity: 'clients'|'workers'|'tasks', raw: any, schema: any[], text: string) {
  // 1) Repair with fuzzy field mapping & type coercions
  const repaired = repairFilter(raw, schema, { soften: false });

  // 2) Keep only nodes whose fields exist in schema
  const validCols = new Set(schema.map(s => s.name));
  const cleaned = pruneToKnownFields(repaired, validCols);

  // 3) If the filter has no valid field references, fall back to heuristic
  if (!hasAnyKnownField(cleaned, validCols)) {
    const hf = heuristicFilter(entity, text, schema as any);
    return hf ?? cleaned;
  }
  return cleaned;
}

function pruneToKnownFields(node: any, validCols: Set<string>): any {
  if (!node || typeof node !== 'object') return node;
  if (node.children && Array.isArray(node.children)) {
    const children = node.children.map((c: any) => pruneToKnownFields(c, validCols)).filter(Boolean);
    return { ...node, children };
  }
  if (node.field && !validCols.has(node.field)) {
    // drop unknown leaf
    return null;
  }
  return node;
}

function hasAnyKnownField(node: any, validCols: Set<string>): boolean {
  if (!node || typeof node !== 'object') return false;
  if (node.field && validCols.has(node.field)) return true;
  //if (Array.isArray(node.children)) return node.children.some((c) => hasAnyKnownField(c, validCols));
  return false;
}

async function preflight(base: string): Promise<{ ok: boolean; models: string[] }> {
  try {
    const r = await fetch(`${base}/api/tags`);
    if (!r.ok) return { ok: false, models: [] };
    const data = await r.json().catch(() => null);
    const models = Array.isArray(data?.models) ? data.models.map((m: any) => m?.name).filter(Boolean) : [];
    return { ok: true, models };
  } catch (e: any) {
    return { ok: false, models: [], error: String(e) } as any;
  }
}

async function callOllama(base: string, model: string, system: string, prompt: string) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const res = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        system,
        prompt,
        stream: false,
        format: 'json',
        options: { temperature: 0, top_p: 0.1, num_ctx: 4096 },
      }),
    });
    clearTimeout(timer);

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { _error: 'http_error', status: res.status, body: t };
    }

    const json = await res.json().catch(() => null);
    return (json && 'response' in json) ? (json as any).response : { _error: 'bad_payload', json };
  } catch (e) {
    return { _error: 'fetch_failed', details: String(e) };
  }
}

function systemPrompt() {
  return `You are a strict JSON generator. Always return a single JSON object and nothing else. No markdown, no comments, no trailing commas.`;
}

function userPrompt(entity: string, userText: string, schema: any[], fewShot: boolean) {
  const columns = schema.map((s: any) => s.name);
  const base = `
Return ONLY a single JSON object in this schema:

{
  "kind": "filter",
  "entity": "clients|workers|tasks",
  "filter": {
    "op": "and|or|not|cmp|includes|contains|in|nin|startsWith|endsWith|regex|exists|notExists|between",
    "field": "OneOfColumnNames?",
    "cmp": ">|>=|<|<=|==|!=",
    "value": <any>,
    "values": [<any>],
    "from": <any>,
    "to": <any>,
    "children": [ <FilterNode> ... ]
  }
}

STRICT RULES:
- Target entity is "${entity}".
- Use ONLY these column names: ${JSON.stringify(columns)}
- If the user mentions "skills include X" for workers, use {"op":"includes","field":"Skills","value":"X"}.
- Never use fields that are NOT in the provided column list.
- If unsure, pick the closest matching column name from the list above.

User query:
${JSON.stringify(userText)}
`.trim();

  if (!fewShot) return base;

  const few = `
Examples (follow the columns list strictly):

User: "skills include coding"
Return:
{"kind":"filter","entity":"workers","filter":{"op":"includes","field":"Skills","value":"coding"}}

User: "duration between 2 and 5 and preferred phases includes 3"
Return:
{"kind":"filter","entity":"tasks","filter":{"op":"and","children":[
  {"op":"between","field":"Duration","from":2,"to":5},
  {"op":"includes","field":"PreferredPhases","value":3}
]}}
`.trim();

  return base + '\n' + few;
}

function normalizeAndParse(resp: any): any | null {
  if (!resp) return null;
  if (typeof resp === 'object' && !Array.isArray(resp)) return resp;

  const text = String(resp);
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const candidate = extractFirstJsonObject(cleaned);
  if (!candidate) return null;

  const repaired = candidate
    .replace(/(['"])?([a-zA-Z0-9_]+)\1\s*:/g, '"$2":')
    .replace(/,\s*([}\]])/g, '$1');

  try { return JSON.parse(repaired); } catch {
    try { return JSON.parse(candidate); } catch { return null; }
  }
}

function extractFirstJsonObject(s: string): string | null {
  const start = s.indexOf('{'); if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  return null;
}
