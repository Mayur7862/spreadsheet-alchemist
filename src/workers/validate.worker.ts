/// <reference lib="webworker" />
// Fast heuristic filter in a Web Worker

type Row = Record<string, any>;
export type ValidateIn = { rows: Row[]; weights?: Record<string, number> };
export type ValidateOut = {
  score: number;
  flat: { row:number; col:string; code:string; msg:string; hid:string }[];
  passRows: Row[];
};

const isEmptyLike = (v: any) => v == null || (typeof v === "string" && v.trim() === "");
const numLike = (s: any) => typeof s === "string" ? (/^\d+(\.\d+)?$/).test(s) : (typeof s === "number");

// default heuristic “weights” (can be overridden by message.weights)
const H_WEIGHTS: Record<string, number> = {
  "missing-required": 1.0,
  "email-format": 0.8,
  "numeric-consistency": 0.6
};

self.onmessage = (e: MessageEvent<ValidateIn>) => {
  const { rows, weights } = e.data;
  if (!rows?.length) return postMessage({ score: 100, flat: [], passRows: [] } as ValidateOut);

  // ---- SPEED TRICKS ----
  const cols = Object.keys(rows[0]);
  const counts: Record<string, number> = {};
  for (let i=0;i<rows.length;i++){
    const r = rows[i];
    for (let j=0;j<cols.length;j++){
      const c = cols[j]; const v = r[c];
      if (!isEmptyLike(v)) counts[c] = (counts[c] || 0) + 1;
    }
  }
  const required = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>k);
  const emailCols = cols.filter(c => /mail|email/i.test(c));

  const flat:any[] = [];
  for (let i=0;i<rows.length;i++){
    const r = rows[i];

    // missing required
    for (let k=0;k<required.length;k++){
      const col = required[k];
      if (isEmptyLike(r[col])) flat.push({ row:i, col, code:"REQ_MISS", msg:`Required "${col}" is empty`, hid:"missing-required" });
    }

    // email format (quick check)
    for (let k=0;k<emailCols.length;k++){
      const col = emailCols[k];
      const v = r[col]; if (!v) continue;
      const s = String(v); const at = s.indexOf("@"); const dot = s.lastIndexOf(".");
      if (!(at>0 && dot>at+1 && dot < s.length-1)) flat.push({ row:i, col, code:"EMAIL_BAD", msg:`Invalid email: ${s}`, hid:"email-format" });
    }

    // numeric consistency
    for (let j=0;j<cols.length;j++){
      const col = cols[j]; const v = r[col];
      if (typeof v === "string" && /\d/.test(v) && !numLike(v)) {
        flat.push({ row:i, col, code:"NUM_INCONS", msg:`Non-numeric value in numeric-like field: ${v}`, hid:"numeric-consistency" });
      }
    }
  }

  // Weighted score
  const w = { ...H_WEIGHTS, ...(weights||{}) };
  const countsByH: Record<string, number> = {};
  for (const f of flat) countsByH[f.hid] = (countsByH[f.hid]||0)+1;
  let totalW = 0, penalty = 0;
  for (const id of Object.keys(w)) {
    totalW += w[id];
    const n = countsByH[id] || 0;
    penalty += w[id] * Math.min(1, n / 50);
  }
  const score = Math.max(0, 100 - Math.round((penalty/totalW)*100));

  // Filtered pass rows
  const bad = new Set<number>();
  for (const f of flat) bad.add(f.row);
  const passRows = rows.filter((_, idx) => !bad.has(idx));

  postMessage({ score, flat, passRows } as ValidateOut);
};
export default null as any;
