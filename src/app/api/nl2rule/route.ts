import { NextRequest, NextResponse } from "next/server";
import { RulesArray, makeRuleId } from "@/rules/schema";

// IMPORTANT: set OPENAI_API_KEY in your env
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }
    const body = await req.json();
    const { text, data } = body as {
      text: string;
      data: { clients: any[]; workers: any[]; tasks: any[] };
    };

    const taskIds = (data?.tasks || []).map((t: any) => String(t.TaskID ?? t.id ?? "")).filter(Boolean);
    const workerGroups = [...new Set((data?.workers || []).map((w: any) => String(w.WorkerGroup ?? "")))].filter(Boolean);
    const clientGroups = [...new Set((data?.clients || []).map((c: any) => String(c.ClientGroup ?? "")))].filter(Boolean);

    const sys = `
You convert plain-English scheduling/routing constraints into a strict JSON array of rules.
Allowed rule types (exact "type" values):
- "coRun": { id, type, tasks[], priority }
- "slotRestriction": { id, type, groupType ("ClientGroup"|"WorkerGroup"), groupIds[], minCommonSlots, priority }
- "loadLimit": { id, type, groupType: "WorkerGroup", groupIds[], maxSlotsPerPhase, priority }
- "phaseWindow": { id, type, taskId, allowedPhases[], priority }
- "patternMatch": { id, type, regex, template, params?, priority }
- "precedenceOverride": { id, type, global, taskId?, ruleId?, priority }

Constraints:
- Only use TaskIDs from this list: ${JSON.stringify(taskIds)}.
- Only use WorkerGroup from: ${JSON.stringify(workerGroups)}.
- Only use ClientGroup from: ${JSON.stringify(clientGroups)}.
- Always set integer "priority" (0 = highest), default 100 if unspecified.
- ALWAYS return **only** a JSON array (no prose), each object MUST include a string "id" (keep temporary, we'll replace server-side).
    `;

    const user = `Convert the following request to rules JSON:\n---\n${text}\n---`;

    // Minimal chat completion (no streaming)
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" }, // ensures JSON, we'll unwrap below
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return NextResponse.json({ error: `OpenAI error: ${t}` }, { status: 500 });
    }

    const dataJson = await resp.json();

    // Some models wrap the array; normalize
    let candidate: unknown = [];
    try {
      // If response_format:json_object, content likely looks like {"rules":[...]}
      const content = dataJson?.choices?.[0]?.message?.content || "{}";
      const parsedObj = JSON.parse(content);
      candidate = parsedObj.rules ?? parsedObj; // accept either {"rules":[...]} or [...]
    } catch {
      // Fallback: try raw
      candidate = [];
    }

    // Validate and fix IDs
    const z = RulesArray.safeParse(candidate);
    if (!z.success) {
      return NextResponse.json({ error: "AI output failed schema validation", details: z.error.format() }, { status: 400 });
    }
    const withIds = z.data.map((r) => ({ ...r, id: r.id || makeRuleId() }));

    return NextResponse.json({ rules: withIds }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
