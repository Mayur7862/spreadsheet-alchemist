// src/utils/validators.ts
import { ValidationError } from '../store/useValidationStore';
import { Client, Worker, Task } from '../store/useDataStore';

export function validateAllData(
  clients: Client[],
  workers: Worker[],
  tasks: Task[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  console.log('🔍 Starting comprehensive validation...', {
    clients: clients.length,
    workers: workers.length,
    tasks: tasks.length
  });

  // Core Rule Set (12 rules)
  errors.push(...validateRequiredColumns(clients, workers, tasks));      // Rule 1
  errors.push(...validateDuplicateIds(clients, workers, tasks));         // Rule 2  
  errors.push(...validateMalformedLists(workers, tasks));               // Rule 3
  errors.push(...validateOutOfRangeValues(clients, workers, tasks));    // Rule 4
  errors.push(...validateBrokenJson(clients));                          // Rule 5
  errors.push(...validateUnknownReferences(clients, tasks));            // Rule 6
  errors.push(...validateCircularCoRunGroups(tasks));                   // Rule 7
  errors.push(...validatePhaseWindowConflicts(workers, tasks));         // Rule 8
  errors.push(...validateOverloadedWorkers(workers));                   // Rule 9
  errors.push(...validatePhaseSlotSaturation(workers, tasks));          // Rule 10
  errors.push(...validateSkillCoverage(workers, tasks));                // Rule 11
  errors.push(...validateMaxConcurrencyFeasibility(workers, tasks));    // Rule 12

  console.log(`✅ Validation complete: ${errors.length} issues found`);
  return errors;
}

/**
 * Rule 1: Missing required columns
 */
function validateRequiredColumns(
  clients: Client[],
  workers: Worker[],
  tasks: Task[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (clients.length === 0 && workers.length === 0 && tasks.length === 0) {
    errors.push({
      id: 'no-data-loaded',
      entity: 'clients',
      entityId: 'system',
      rowIndex: -1,
      field: 'data',
      message: 'No data loaded. Please upload files.',
      severity: 'error',
      suggestion: 'Upload CSV or Excel files with client, worker, and task data'
    });
    return errors;
  }

  const requiredClientColumns = ['ClientID', 'ClientName', 'PriorityLevel'];
  const requiredWorkerColumns = ['WorkerID', 'WorkerName', 'Skills', 'AvailableSlots', 'MaxLoadPerPhase'];
  const requiredTaskColumns = ['TaskID', 'TaskName', 'Duration', 'MaxConcurrent'];

  if (clients.length > 0) {
    const clientSample = clients[0];
    requiredClientColumns.forEach(col => {
      if (!(col in clientSample)) {
        errors.push({
          id: `missing-client-column-${col}`,
          entity: 'clients',
          entityId: 'schema',
          rowIndex: -1,
          field: col,
          message: `Missing required column: ${col}`,
          severity: 'error',
          suggestion: `Add ${col} column to client data`
        });
      }
    });
  }

  return errors;
}

/**
 * Rule 2: Duplicate IDs
 */
function validateDuplicateIds(
  clients: Client[],
  workers: Worker[],
  tasks: Task[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check duplicate ClientIDs
  const clientIds = new Map<string, number[]>();
  clients.forEach((client, index) => {
    if (client.ClientID) {
      if (!clientIds.has(client.ClientID)) {
        clientIds.set(client.ClientID, []);
      }
      clientIds.get(client.ClientID)!.push(index);
    }
  });

  clientIds.forEach((indices, id) => {
    if (indices.length > 1) {
      indices.forEach((index, duplicateIndex) => {
        errors.push({
          id: `duplicate-client-${id}-${index}`,
          entity: 'clients',
          entityId: id,
          rowIndex: index,
          field: 'ClientID',
          message: `Duplicate ClientID: ${id} (appears ${indices.length} times)`,
          severity: 'error',
          suggestion: 'Make ClientID unique',
          autoFixValue: `${id}_${duplicateIndex + 1}`
        });
      });
    }
  });

  // Check duplicate WorkerIDs
  const workerIds = new Map<string, number[]>();
  workers.forEach((worker, index) => {
    if (worker.WorkerID) {
      if (!workerIds.has(worker.WorkerID)) {
        workerIds.set(worker.WorkerID, []);
      }
      workerIds.get(worker.WorkerID)!.push(index);
    }
  });

  workerIds.forEach((indices, id) => {
    if (indices.length > 1) {
      indices.forEach((index, duplicateIndex) => {
        errors.push({
          id: `duplicate-worker-${id}-${index}`,
          entity: 'workers',
          entityId: id,
          rowIndex: index,
          field: 'WorkerID',
          message: `Duplicate WorkerID: ${id} (appears ${indices.length} times)`,
          severity: 'error',
          suggestion: 'Make WorkerID unique',
          autoFixValue: `${id}_${duplicateIndex + 1}`
        });
      });
    }
  });

  // Check duplicate TaskIDs
  const taskIds = new Map<string, number[]>();
  tasks.forEach((task, index) => {
    if (task.TaskID) {
      if (!taskIds.has(task.TaskID)) {
        taskIds.set(task.TaskID, []);
      }
      taskIds.get(task.TaskID)!.push(index);
    }
  });

  taskIds.forEach((indices, id) => {
    if (indices.length > 1) {
      indices.forEach((index, duplicateIndex) => {
        errors.push({
          id: `duplicate-task-${id}-${index}`,
          entity: 'tasks',
          entityId: id,
          rowIndex: index,
          field: 'TaskID',
          message: `Duplicate TaskID: ${id} (appears ${indices.length} times)`,
          severity: 'error',
          suggestion: 'Make TaskID unique',
          autoFixValue: `${id}_${duplicateIndex + 1}`
        });
      });
    }
  });

  return errors;
}

/**
 * Rule 3: Malformed lists
 */
function validateMalformedLists(workers: Worker[], tasks: Task[]): ValidationError[] {
  const errors: ValidationError[] = [];

  workers.forEach((worker, index) => {
    if (worker.AvailableSlots) {
      try {
        const slots = JSON.parse(worker.AvailableSlots);
        if (!Array.isArray(slots)) {
          throw new Error('Not an array');
        }
        
        slots.forEach((slot, slotIndex) => {
          if (!Number.isInteger(slot) || slot < 1) {
            errors.push({
              id: `malformed-slot-${worker.WorkerID}-${slotIndex}`,
              entity: 'workers',
              entityId: worker.WorkerID,
              rowIndex: index,
              field: 'AvailableSlots',
              message: `Invalid slot value: ${slot}. Must be positive integer.`,
              severity: 'error',
              suggestion: 'Use positive integers for phase numbers',
              autoFixValue: JSON.stringify([1, 2, 3])
            });
          }
        });
      } catch {
        errors.push({
          id: `malformed-slots-${worker.WorkerID}`,
          entity: 'workers',
          entityId: worker.WorkerID,
          rowIndex: index,
          field: 'AvailableSlots',
          message: `Malformed AvailableSlots: ${worker.AvailableSlots}`,
          severity: 'error',
          suggestion: 'Format as JSON array: [1,2,3]',
          autoFixValue: '[1,2,3]'
        });
      }
    }
  });

  return errors;
}

/**
 * Rule 4: Out-of-range values
 */
function validateOutOfRangeValues(
  clients: Client[],
  workers: Worker[],
  tasks: Task[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  clients.forEach((client, index) => {
    const priority = Number(client.PriorityLevel);
    if (isNaN(priority) || priority < 1 || priority > 5) {
      errors.push({
        id: `invalid-priority-${client.ClientID}-${index}`,
        entity: 'clients',
        entityId: client.ClientID,
        rowIndex: index,
        field: 'PriorityLevel',
        message: `PriorityLevel must be 1-5, got: ${client.PriorityLevel}`,
        severity: 'error',
        suggestion: 'Set priority between 1 (lowest) and 5 (highest)',
        autoFixValue: 3
      });
    }
  });

  tasks.forEach((task, index) => {
    if (task.Duration < 1) {
      errors.push({
        id: `invalid-duration-${task.TaskID}-${index}`,
        entity: 'tasks',
        entityId: task.TaskID,
        rowIndex: index,
        field: 'Duration',
        message: `Duration must be >= 1, got: ${task.Duration}`,
        severity: 'error',
        suggestion: 'Set minimum duration of 1 phase',
        autoFixValue: 1
      });
    }

    if (task.MaxConcurrent < 1) {
      errors.push({
        id: `invalid-concurrent-${task.TaskID}-${index}`,
        entity: 'tasks',
        entityId: task.TaskID,
        rowIndex: index,
        field: 'MaxConcurrent',
        message: `MaxConcurrent must be >= 1, got: ${task.MaxConcurrent}`,
        severity: 'error',
        suggestion: 'Set minimum concurrent assignments of 1',
        autoFixValue: 1
      });
    }
  });

  return errors;
}

/**
 * Rule 5: Broken JSON
 */
function validateBrokenJson(clients: Client[]): ValidationError[] {
  const errors: ValidationError[] = [];

  clients.forEach((client, index) => {
    if (client.AttributesJSON && client.AttributesJSON.trim()) {
      try {
        JSON.parse(client.AttributesJSON);
      } catch (jsonError) {
        errors.push({
          id: `broken-json-${client.ClientID}-${index}`,
          entity: 'clients',
          entityId: client.ClientID,
          rowIndex: index,
          field: 'AttributesJSON',
          message: `Invalid JSON: ${jsonError instanceof Error ? jsonError.message : 'Parse error'}`,
          severity: 'error',
          suggestion: 'Fix JSON syntax or clear field',
          autoFixValue: '{}'
        });
      }
    }
  });

  return errors;
}

/**
 * Rule 6: Unknown references
 */
function validateUnknownReferences(clients: Client[], tasks: Task[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const validTaskIds = new Set(tasks.map(task => task.TaskID));

  clients.forEach((client, index) => {
    if (client.RequestedTaskIDs) {
      const requestedIds = client.RequestedTaskIDs
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);

      requestedIds.forEach(taskId => {
        if (!validTaskIds.has(taskId)) {
          errors.push({
            id: `unknown-task-ref-${client.ClientID}-${taskId}`,
            entity: 'clients',
            entityId: client.ClientID,
            rowIndex: index,
            field: 'RequestedTaskIDs',
            message: `Unknown task reference: ${taskId}`,
            severity: 'error',
            suggestion: `Remove ${taskId} or add task with this ID`
          });
        }
      });
    }
  });

  return errors;
}

/**
 * Rule 7: Circular references (simplified)
 */
function validateCircularCoRunGroups(tasks: Task[]): ValidationError[] {
  const errors: ValidationError[] = [];

  tasks.forEach((task, index) => {
    if (task.RequiredSkills && task.RequiredSkills.includes(task.TaskID)) {
      errors.push({
        id: `circular-ref-${task.TaskID}`,
        entity: 'tasks',
        entityId: task.TaskID,
        rowIndex: index,
        field: 'RequiredSkills',
        message: `Task ${task.TaskID} references itself`,
        severity: 'warning',
        suggestion: 'Remove self-reference to prevent circular dependencies'
      });
    }
  });

  return errors;
}

/**
 * Rule 8: Phase-window conflicts
 */
function validatePhaseWindowConflicts(workers: Worker[], tasks: Task[]): ValidationError[] {
  const errors: ValidationError[] = [];

  tasks.forEach((task, index) => {
    if (task.PreferredPhases && task.RequiredSkills && task.MaxConcurrent > 1) {
      try {
        const preferredPhases = JSON.parse(task.PreferredPhases);
        const requiredSkills = task.RequiredSkills.split(',').map(s => s.trim());

        const qualifiedWorkers = workers.filter(worker => {
          const hasSkills = requiredSkills.every(skill =>
            worker.Skills && worker.Skills.toLowerCase().includes(skill.toLowerCase())
          );

          if (!hasSkills) return false;

          try {
            const availableSlots = JSON.parse(worker.AvailableSlots);
            return Array.isArray(availableSlots) && 
                   preferredPhases.some((phase: number) => availableSlots.includes(phase));
          } catch {
            return false;
          }
        });

        if (qualifiedWorkers.length < task.MaxConcurrent) {
          errors.push({
            id: `phase-constraint-${task.TaskID}`,
            entity: 'tasks',
            entityId: task.TaskID,
            rowIndex: index,
            field: 'PreferredPhases',
            message: `Only ${qualifiedWorkers.length} qualified workers available in preferred phases, need ${task.MaxConcurrent}`,
            severity: 'warning',
            suggestion: 'Add more workers, adjust phases, or reduce MaxConcurrent'
          });
        }
      } catch {
        // Skip malformed data
      }
    }
  });

  return errors;
}

/**
 * Rule 9: Overloaded workers
 */
function validateOverloadedWorkers(workers: Worker[]): ValidationError[] {
  const errors: ValidationError[] = [];

  workers.forEach((worker, index) => {
    try {
      const availableSlots = JSON.parse(worker.AvailableSlots);
      if (Array.isArray(availableSlots) && worker.MaxLoadPerPhase > availableSlots.length) {
        errors.push({
          id: `overloaded-worker-${worker.WorkerID}`,
          entity: 'workers',
          entityId: worker.WorkerID,
          rowIndex: index,
          field: 'MaxLoadPerPhase',
          message: `MaxLoad (${worker.MaxLoadPerPhase}) > Available slots (${availableSlots.length})`,
          severity: 'warning',
          suggestion: 'Reduce max load or add more time slots',
          autoFixValue: availableSlots.length
        });
      }
    } catch {
      // Skip malformed data
    }
  });

  return errors;
}

/**
 * Rule 10: Phase-slot saturation
 */
function validatePhaseSlotSaturation(workers: Worker[], tasks: Task[]): ValidationError[] {
  const errors: ValidationError[] = [];

  const phaseCapacity = new Map<number, number>();
  workers.forEach(worker => {
    try {
      const slots = JSON.parse(worker.AvailableSlots);
      if (Array.isArray(slots)) {
        slots.forEach(phase => {
          const current = phaseCapacity.get(phase) || 0;
          phaseCapacity.set(phase, current + (worker.MaxLoadPerPhase || 1));
        });
      }
    } catch {
      // Skip malformed data
    }
  });

  const phaseDemand = new Map<number, number>();
  tasks.forEach(task => {
    if (task.PreferredPhases && task.Duration) {
      try {
        const phases = JSON.parse(task.PreferredPhases);
        if (Array.isArray(phases)) {
          phases.forEach(phase => {
            const current = phaseDemand.get(phase) || 0;
            phaseDemand.set(phase, current + (task.Duration * task.MaxConcurrent));
          });
        }
      } catch {
        // Skip malformed data
      }
    }
  });

  phaseDemand.forEach((demand, phase) => {
    const capacity = phaseCapacity.get(phase) || 0;
    if (demand > capacity) {
      errors.push({
        id: `phase-saturation-${phase}`,
        entity: 'tasks',
        entityId: `phase-${phase}`,
        rowIndex: -1,
        field: 'PreferredPhases',
        message: `Phase ${phase} saturated: ${demand} demand > ${capacity} capacity`,
        severity: 'warning',
        suggestion: 'Add workers, redistribute tasks, or extend timeline'
      });
    }
  });

  return errors;
}

/**
 * Rule 11: Skill coverage
 */
function validateSkillCoverage(workers: Worker[], tasks: Task[]): ValidationError[] {
  const errors: ValidationError[] = [];

  const allWorkerSkills = new Set<string>();
  workers.forEach(worker => {
    if (worker.Skills) {
      worker.Skills.split(',').forEach(skill => {
        allWorkerSkills.add(skill.trim().toLowerCase());
      });
    }
  });

  tasks.forEach((task, index) => {
    if (task.RequiredSkills) {
      const requiredSkills = task.RequiredSkills.split(',').map(s => s.trim().toLowerCase());
      
      requiredSkills.forEach(skill => {
        if (skill && !allWorkerSkills.has(skill)) {
          errors.push({
            id: `missing-skill-coverage-${task.TaskID}-${skill}`,
            entity: 'tasks',
            entityId: task.TaskID,
            rowIndex: index,
            field: 'RequiredSkills',
            message: `No worker has required skill: "${skill}"`,
            severity: 'warning',
            suggestion: 'Add workers with this skill or update requirements'
          });
        }
      });
    }
  });

  return errors;
}

/**
 * Rule 12: Max-concurrency feasibility
 */
function validateMaxConcurrencyFeasibility(workers: Worker[], tasks: Task[]): ValidationError[] {
  const errors: ValidationError[] = [];

  tasks.forEach((task, index) => {
    if (task.RequiredSkills && task.MaxConcurrent > 1) {
      const requiredSkills = task.RequiredSkills.split(',').map(s => s.trim().toLowerCase());
      
      const qualifiedWorkers = workers.filter(worker => {
        if (!worker.Skills) return false;
        const workerSkills = worker.Skills.split(',').map(s => s.trim().toLowerCase());
        return requiredSkills.every(skill => 
          workerSkills.some(workerSkill => workerSkill.includes(skill))
        );
      });

      if (qualifiedWorkers.length < task.MaxConcurrent) {
        errors.push({
          id: `infeasible-concurrency-${task.TaskID}`,
          entity: 'tasks',
          entityId: task.TaskID,
          rowIndex: index,
          field: 'MaxConcurrent',
          message: `MaxConcurrent (${task.MaxConcurrent}) > qualified workers (${qualifiedWorkers.length})`,
          severity: 'warning',
          suggestion: 'Reduce MaxConcurrent or add qualified workers',
          autoFixValue: Math.max(1, qualifiedWorkers.length)
        });
      }
    }
  });

  return errors;
}

/**
 * Get validation statistics
 */
export function getValidationStats(errors: ValidationError[]) {
  const ruleStats = new Map<string, number>();
  errors.forEach(error => {
    const rule = error.id.split('-')[0];
    ruleStats.set(rule, (ruleStats.get(rule) || 0) + 1);
  });

  return {
    total: errors.length,
    errors: errors.filter(e => e.severity === 'error').length,
    warnings: errors.filter(e => e.severity === 'warning').length,
    byEntity: {
      clients: errors.filter(e => e.entity === 'clients').length,
      workers: errors.filter(e => e.entity === 'workers').length,
      tasks: errors.filter(e => e.entity === 'tasks').length,
    },
    byRule: Object.fromEntries(ruleStats),
    criticalIssues: errors.filter(e => 
      e.severity === 'error' && 
      ['duplicate', 'missing', 'malformed'].some(type => e.id.includes(type))
    ).length
  };
}
