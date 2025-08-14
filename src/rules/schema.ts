import { z } from "zod";

// ---- Core Rule Types ----
export const CoRunRule = z.object({
  id: z.string(),
  type: z.literal("coRun"),
  tasks: z.array(z.string()).min(2), // TaskIDs
  priority: z.number().int().min(0).default(100),
});

export const SlotRestrictionRule = z.object({
  id: z.string(),
  type: z.literal("slotRestriction"),
  groupType: z.enum(["ClientGroup", "WorkerGroup"]),
  groupIds: z.array(z.string()).min(1),
  minCommonSlots: z.number().int().min(0),
  priority: z.number().int().min(0).default(100),
});

export const LoadLimitRule = z.object({
  id: z.string(),
  type: z.literal("loadLimit"),
  groupType: z.literal("WorkerGroup"),
  groupIds: z.array(z.string()).min(1),
  maxSlotsPerPhase: z.number().int().min(0),
  priority: z.number().int().min(0).default(100),
});

export const PhaseWindowRule = z.object({
  id: z.string(),
  type: z.literal("phaseWindow"),
  taskId: z.string(),
  allowedPhases: z.array(z.number().int().min(1)).min(1), // e.g., [1,2,3]
  priority: z.number().int().min(0).default(100),
});

export const PatternMatchRule = z.object({
  id: z.string(),
  type: z.literal("patternMatch"),
  regex: z.string().min(1),
  template: z.string().min(1), // name of your rule template
  params: z.record(z.string(), z.any()).optional(),
  priority: z.number().int().min(0).default(100),
});

export const PrecedenceOverrideRule = z.object({
  id: z.string(),
  type: z.literal("precedenceOverride"),
  // if global === true, applies broadly; else target by taskId or ruleId
  global: z.boolean().default(false),
  taskId: z.string().optional(),
  ruleId: z.string().optional(),
  priority: z.number().int().min(0).default(50),
});

export const Rule = z.discriminatedUnion("type", [
  CoRunRule,
  SlotRestrictionRule,
  LoadLimitRule,
  PhaseWindowRule,
  PatternMatchRule,
  PrecedenceOverrideRule,
]);

export type Rule = z.infer<typeof Rule>;
export const RulesArray = z.array(Rule);

// Helper: id factory
export const makeRuleId = (prefix = "r") =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
