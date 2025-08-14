import { create } from "zustand";
import { Rule, RulesArray, makeRuleId } from "@/rules/schema";

type RuleIssue = { id?: string; message: string; level: "error" | "warning" };

type RulesState = {
  rules: Rule[];
  add: (r: Omit<Rule, "id"> | Rule) => void;
  addMany: (arr: (Omit<Rule, "id"> | Rule)[]) => void;
  remove: (id: string) => void;
  clear: () => void;
  update: (id: string, patch: Partial<Rule>) => void;
  exportRules: () => { rules: Rule[]; generatedAt: string, version: number };
  validateRulesAgainstData: (data: { tasks: any[]; workers: any[]; clients: any[] }) => RuleIssue[];
};

export const useRulesStore = create<RulesState>((set, get) => ({
  rules: [],

  add: (r) =>
    set((s) => ({
      rules: [
        ...s.rules,
        ("id" in r && r.id) ? (r as Rule) : ({ ...r, id: makeRuleId() } as Rule),
      ],
    })),

  addMany: (arr) =>
    set((s) => ({
      rules: [
        ...s.rules,
        ...arr.map((r) => ("id" in r && (r as any).id ? (r as Rule) : ({ ...r, id: makeRuleId() } as Rule))),
      ],
    })),

  remove: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),

  clear: () => set({ rules: [] }),

  update: (id, patch) =>
    set((s) => ({
      rules: s.rules.map((r) => (r.id === id ? ({ ...r, ...patch } as Rule) : r)),
    })),

  exportRules: () => ({
    rules: get().rules,
    generatedAt: new Date().toISOString(),
    version: 1,
  }),

  validateRulesAgainstData: ({ tasks, workers, clients }) => {
    const issues: RuleIssue[] = [];
    const taskIds = new Set((tasks || []).map((t: any) => String(t.TaskID ?? t.id ?? "")));
    const workerGroups = new Set((workers || []).map((w: any) => String(w.WorkerGroup ?? "")));
    const clientGroups = new Set((clients || []).map((c: any) => String(c.ClientGroup ?? "")));

    for (const r of get().rules) {
      // Basic referential checks
      if (r.type === "coRun") {
        r.tasks.forEach((tid) => {
          if (!taskIds.has(String(tid))) {
            issues.push({ level: "error", message: `coRun references missing TaskID: ${tid}`, id: r.id });
          }
        });
      }
      if (r.type === "phaseWindow") {
        if (!taskIds.has(String(r.taskId))) {
          issues.push({ level: "error", message: `phaseWindow references missing TaskID: ${r.taskId}`, id: r.id });
        }
      }
      if (r.type === "slotRestriction") {
        const pool = r.groupType === "WorkerGroup" ? workerGroups : clientGroups;
        r.groupIds.forEach((gid) => {
          if (!pool.has(String(gid))) {
            issues.push({ level: "warning", message: `${r.groupType} "${gid}" not found in data`, id: r.id });
          }
        });
      }

      // Edge cases you might expand later (cycles/conflicts etc.)
      if (r.type === "precedenceOverride" && !r.global && !r.taskId && !r.ruleId) {
        issues.push({ level: "warning", message: "precedenceOverride should target a taskId or ruleId if not global", id: r.id });
      }
    }

    // Validate shape strictly
    const parsed = RulesArray.safeParse(get().rules);
    if (!parsed.success) {
      issues.push({ level: "error", message: "Rule set failed schema validation", id: undefined });
    }

    return issues;
  },
}));
