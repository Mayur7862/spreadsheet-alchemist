"use client";
import { useMemo, useState } from "react";
//import { runAIFilter } from "@/lib/ai";

export default function FilterRunner({
  rows,
  onFiltered
}: { rows:any[]; onFiltered:(rows:any[], source:"ai"|"heuristic")=>void }) {
  const [status, setStatus] = useState<"idle"|"running"|"done">("idle");
  const [source, setSource] = useState<"ai"|"heuristic"|"">("");

  const worker = useMemo(
    () => new Worker(new URL("@/workers/validate.worker.ts", import.meta.url), { type:"module" }),
    []
  );

  function runHeuristic(data:any[]): Promise<any[]> {
    return new Promise((resolve) => {
      const onMsg = (e: MessageEvent<any>) => {
        worker.removeEventListener("message", onMsg);
        resolve(e.data.passRows || []);
      };
      worker.addEventListener("message", onMsg);
      worker.postMessage({ rows: data });
    });
  }

  async function run() {
    if (!rows.length) return;
    setStatus("running"); setSource("");

    // 1) AI first (preferred)
   // const ai = await runAIFilter(rows);
    //if (ai?.passRows?.length) {
      //onFiltered(ai.passRows, "ai");
     // setSource("ai"); setStatus("done");
     // return;
   // }

    // 2) Heuristic fallback (ultrafast)
    const pass = await runHeuristic(rows);
    onFiltered(pass, "heuristic");
    setSource("heuristic"); setStatus("done");
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={run} className="rounded-lg bg-black px-3 py-2 text-white text-sm">
        Run Filter
      </button>
      {status === "running" && <span className="text-sm text-gray-600">Generating results…</span>}
      {status === "done" && (
        <span className="text-sm rounded-md bg-green-50 px-2 py-1 text-green-700 border border-green-200">
          ✅ Results generated via <b>{source.toUpperCase()}</b> — here are the filtered results.
        </span>
      )}
    </div>
  );
}
