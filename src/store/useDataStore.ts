// src/store/useDataStore.ts
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

interface DataState {
  clients: Client[];
  workers: Worker[];
  tasks: Task[];
  setClients: (data: Client[]) => void;
  setWorkers: (data: Worker[]) => void;
  setTasks: (data: Task[]) => void;
  reset: () => void;
}

export const useDataStore = create<DataState>((set) => ({
  clients: [],
  workers: [],
  tasks: [],
  setClients: (data) => set({ clients: data }),
  setWorkers: (data) => set({ workers: data }),
  setTasks: (data) => set({ tasks: data }),
  reset: () => set({ clients: [], workers: [], tasks: [] }),
}));
