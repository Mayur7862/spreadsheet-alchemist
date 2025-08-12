// src/store/useValidationStore.ts
import { create } from 'zustand';

export interface ValidationError {
  id: string;                                    // ✅ FIXED: Added id property
  entity: 'clients' | 'workers' | 'tasks';
  entityId: string;                              // ClientID, WorkerID, or TaskID
  rowIndex: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
  suggestion?: string;                           // Auto-fix suggestion
  autoFixValue?: any;                           // Proposed fix value
}

export interface ValidationSummary {
  totalErrors: number;
  totalWarnings: number;
  clientErrors: number;
  workerErrors: number;
  taskErrors: number;
  lastValidation: Date | null;
  criticalIssues: number;
}

interface ValidationState {
  errors: ValidationError[];
  summary: ValidationSummary;
  isValidating: boolean;
  setErrors: (errors: ValidationError[]) => void;
  addError: (error: ValidationError) => void;
  removeError: (errorId: string) => void;
  clearErrors: () => void;
  setValidating: (validating: boolean) => void;
  getErrorsForEntity: (entity: 'clients' | 'workers' | 'tasks') => ValidationError[];
  getErrorsForRow: (entity: 'clients' | 'workers' | 'tasks', rowIndex: number) => ValidationError[];
  hasErrors: () => boolean;
  getCriticalErrors: () => ValidationError[];
}

export const useValidationStore = create<ValidationState>((set, get) => ({
  errors: [],
  summary: {
    totalErrors: 0,
    totalWarnings: 0,
    clientErrors: 0,
    workerErrors: 0,
    taskErrors: 0,
    lastValidation: null,
    criticalIssues: 0,
  },
  isValidating: false,

  setErrors: (errors) => {
    const criticalErrors = errors.filter(e => 
      e.severity === 'error' && 
      ['duplicate', 'missing', 'malformed', 'unknown'].some(type => e.id.includes(type))
    );

    const summary: ValidationSummary = {
      totalErrors: errors.filter(e => e.severity === 'error').length,
      totalWarnings: errors.filter(e => e.severity === 'warning').length,
      clientErrors: errors.filter(e => e.entity === 'clients').length,
      workerErrors: errors.filter(e => e.entity === 'workers').length,
      taskErrors: errors.filter(e => e.entity === 'tasks').length,
      lastValidation: new Date(),
      criticalIssues: criticalErrors.length,
    };
    
    set({ errors, summary });
    console.log('📊 Validation Summary:', summary);
  },

  addError: (error) => {
    const errors = [...get().errors, error];
    get().setErrors(errors);
  },

  removeError: (errorId) => {
    const errors = get().errors.filter(e => e.id !== errorId);
    get().setErrors(errors);
  },

  clearErrors: () => set({ 
    errors: [], 
    summary: {
      totalErrors: 0,
      totalWarnings: 0,
      clientErrors: 0,
      workerErrors: 0,
      taskErrors: 0,
      lastValidation: null,
      criticalIssues: 0,
    }
  }),

  setValidating: (isValidating) => set({ isValidating }),

  getErrorsForEntity: (entity) => {
    return get().errors.filter(e => e.entity === entity);
  },

  getErrorsForRow: (entity, rowIndex) => {
    return get().errors.filter(e => e.entity === entity && e.rowIndex === rowIndex);
  },

  hasErrors: () => {
    return get().errors.length > 0;
  },

  getCriticalErrors: () => {
    return get().errors.filter(e => 
      e.severity === 'error' && 
      ['duplicate', 'missing', 'malformed', 'unknown'].some(type => e.id.includes(type))
    );
  },
}));
