// src/store/useDataStore.ts
// Zustand store for your three entities + non-destructive filtered views.
// - `filtered` holds per-entity filtered subsets (for NL search).
// - `setFiltered(entity, rows|null)` sets/clears the filtered view.
// - `patchRow(entity, rowIndex, patch)` updates a row and mirrors the change in the filtered view if visible.

import { create } from 'zustand';

export interface Client {
  ClientID: string;
  ClientName: string;
  PriorityLevel: number;
  RequestedTaskIDs: string;
  GroupTag: string;
  AttributesJSON: string;
}

export interface Worker {
  WorkerID: string;
  WorkerName: string;
  Skills: string;
  AvailableSlots: string;
  MaxLoadPerPhase: number;
  WorkerGroup: string;
  QualificationLevel: number;
}

export interface Task {
  TaskID: string;
  TaskName: string;
  Category: string;
  Duration: number;
  RequiredSkills: string;
  PreferredPhases: string;
  MaxConcurrent: number;
}

// Entity helper types
export type EntityKey = 'clients' | 'workers' | 'tasks';
type AnyRow = Client | Worker | Task;

interface DataState {
  clients: Client[];
  workers: Worker[];
  tasks: Task[];

  // Non-destructive filtered views: if present, UI should render these instead of base arrays
  filtered: Partial<Record<EntityKey, AnyRow[]>>;

  // Base setters (used on upload/replace)
  setClients: (data: Client[]) => void;
  setWorkers: (data: Worker[]) => void;
  setTasks: (data: Task[]) => void;

  // Set/clear a filtered view for an entity
  setFiltered: (key: EntityKey, rows: AnyRow[] | null) => void;

  // Patch a single row (used by inline edits). Mirrors into filtered view if it exists.
  patchRow: (key: EntityKey, rowIndex: number, patch: Partial<AnyRow>) => void;

  // Reset everything
  reset: () => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  clients: [],
  workers: [],
  tasks: [],
  filtered: {},

  setClients: (data) => set({ clients: data }),
  setWorkers: (data) => set({ workers: data }),
  setTasks:  (data) => set({ tasks:  data }),

  setFiltered: (key, rows) =>
    set((s) => {
      if (rows === null) {
        // Clear filtered view for this entity
        const next = { ...s.filtered };
        delete next[key];
        return { ...s, filtered: next };
      }
      // Set/replace filtered view for this entity
      return { ...s, filtered: { ...s.filtered, [key]: rows } };
    }),

  patchRow: (key, rowIndex, patch) =>
    set((s) => {
      // Update base array
      const base = [...(s[key] as AnyRow[])];
      if (!base[rowIndex]) return s; // out of bounds safeguard
      base[rowIndex] = { ...base[rowIndex], ...patch };

      // If a filtered view exists for this entity, mirror the change there too
      const fView = s.filtered[key] ? [...(s.filtered[key] as AnyRow[])] : undefined;
      if (fView && fView[rowIndex]) {
        fView[rowIndex] = { ...fView[rowIndex], ...patch };
      }

      return {
        ...s,
        [key]: base,
        filtered: fView ? { ...s.filtered, [key]: fView } : s.filtered,
      };
    }),

  reset: () => set({ clients: [], workers: [], tasks: [], filtered: {} }),
}));
