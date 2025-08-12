import { ValidationError } from '@/store/useValidationStore';
import { Client, Worker, Task } from '../store/useDataStore';

export function validateAll(clients: Client[], workers: Worker[], tasks: Task[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Missing required columns (skip if CSV parsing already ensured keys)

  // 2. Duplicate IDs
  const clientIDs = new Set();
  clients.forEach((c, i) => {
    if (clientIDs.has(c.ClientID)) {
      errors.push({ entity: 'clients', rowIndex: i, field: 'ClientID', message: 'Duplicate ClientID', severity: 'error' });
    }
    clientIDs.add(c.ClientID);
  });

  const workerIDs = new Set();
  workers.forEach((w, i) => {
    if (workerIDs.has(w.WorkerID)) {
      errors.push({ entity: 'workers', rowIndex: i, field: 'WorkerID', message: 'Duplicate WorkerID', severity: 'error' });
    }
    workerIDs.add(w.WorkerID);
  });

  const taskIDs = new Set();
  tasks.forEach((t, i) => {
    if (taskIDs.has(t.TaskID)) {
      errors.push({ entity: 'tasks', rowIndex: i, field: 'TaskID', message: 'Duplicate TaskID', severity: 'error' });
    }
    taskIDs.add(t.TaskID);
  });

  // 3. PriorityLevel out of range
  clients.forEach((c, i) => {
    if (isNaN(Number(c.PriorityLevel)) || Number(c.PriorityLevel) < 1 || Number(c.PriorityLevel) > 5) {
      errors.push({ entity: 'clients', rowIndex: i, field: 'PriorityLevel', message: 'PriorityLevel must be between 1 and 5', severity: 'error' });
    }
  });

  // 4. Malformed AvailableSlots (must be array of numbers)
  workers.forEach((w, i) => {
    try {
      const slots = JSON.parse(w.AvailableSlots);
      if (!Array.isArray(slots) || !slots.every((n: any) => Number.isInteger(n))) {
        errors.push({ entity: 'workers', rowIndex: i, field: 'AvailableSlots', message: 'AvailableSlots must be an array of integers', severity: 'error' });
      }
    } catch {
      errors.push({ entity: 'workers', rowIndex: i, field: 'AvailableSlots', message: 'AvailableSlots is not valid JSON array', severity: 'error' });
    }
  });

  // 5. Unknown requested tasks
  clients.forEach((c, i) => {
    const requested = c.RequestedTaskIDs.split(',').map((id) => id.trim());
    requested.forEach((rt) => {
      if (!taskIDs.has(rt)) {
        errors.push({ entity: 'clients', rowIndex: i, field: 'RequestedTaskIDs', message: `Requested TaskID ${rt} does not exist`, severity: 'error' });
      }
    });
  });

  // ... add the rest of the milestone 1 rules here ...

  return errors;
}
