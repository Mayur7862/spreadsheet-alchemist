// src/types/api.ts
export type PreflightOk  = { ok: true; models: string[] };
export type PreflightErr = { ok: false; error: string };
export type Preflight    = PreflightOk | PreflightErr;
