import { create } from 'zustand';

export interface ValidationError {
  entity: 'clients' | 'workers' | 'tasks';
  rowIndex: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationState {
  errors: ValidationError[];
  setErrors: (errors: ValidationError[]) => void;
  clearErrors: () => void;
}

export const useValidationStore = create<ValidationState>((set) => ({
  errors: [],
  setErrors: (errors) => set({ errors }),
  clearErrors: () => set({ errors: [] }),
}));
