// src/app/api/ai/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const base = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct';

  try {
    const r = await fetch(`${base}/api/tags`);
    if (!r.ok) {
      return NextResponse.json({ ok: false, step: 'tags', status: r.status }, { status: 502 });
    }
    const data = await r.json().catch(() => null);
    const models = Array.isArray(data?.models) ? data.models.map((m: any) => m?.name).filter(Boolean) : [];
    const hasModel = models.includes(model);

    // Try a minimal JSON generate to be sure format:"json" is accepted
    const smoke = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: '{"kind":"filter","entity":"tasks","filter":{"op":"cmp","field":"Duration","cmp":">","value":2}}',
        stream: false,
        format: 'json',
        options: { temperature: 0 },
      }),
    }).then((x) => x.json()).catch(() => null);

    return NextResponse.json({
      ok: !!smoke?.response,
      base,
      model,
      models,
      hasModel,
      generateOk: !!smoke?.response,
      sample: smoke?.response ?? null,
    }, { status: hasModel && smoke?.response ? 200 : 502 });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: String(e), base, model }, { status: 502 });
  }
}
