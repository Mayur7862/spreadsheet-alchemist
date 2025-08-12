// src/components/DataGrid.tsx
'use client';

import { useMemo, useCallback, useState } from 'react';
import {
  Table,
  ScrollArea,
  Paper,
  Text,
  Badge,
  Tooltip,
  TextInput,
  Group,
  ActionIcon,
  Alert,
} from '@mantine/core';
import { IconAlertTriangle, IconEdit, IconCheck, IconX } from '@tabler/icons-react';
import { useValidationStore } from '../store/useValidationStore';
import { useDataStore } from '../store/useDataStore';
import { validateAllData } from '../utils/validators';

type EntityType = 'clients' | 'workers' | 'tasks';

interface Props {
  rowData: any[];
  entityType: EntityType;
}

interface ColumnDef {
  field: string;
  header: string;
  width?: number;
  editable?: boolean;
  pinned?: boolean;
}

interface EditingCell {
  rowIndex: number;
  field: string;
}

export default function DataGrid({ rowData, entityType }: Props) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Stores
  const { getErrorsForRow, getErrorsForEntity, setErrors, setValidating } = useValidationStore();
  const { clients, workers, tasks, setClients, setWorkers, setTasks } = useDataStore();

  // All errors for this entity
  const entityErrors = getErrorsForEntity(entityType);

  // Helper to get errors for a specific cell
  const getCellErrors = useCallback(
    (rowIdx: number, field: string) => {
      return entityErrors.filter((e) => e.rowIndex === rowIdx && e.field === field);
    },
    [entityErrors]
  );

  // Helper to get errors for a specific row
  const getRowErrors = useCallback(
    (rowIdx: number) => {
      return getErrorsForRow(entityType, rowIdx);
    },
    [getErrorsForRow, entityType]
  );

  // Start editing cell
  const startEditing = (rowIdx: number, field: string, currentValue: any) => {
    setEditingCell({ rowIndex: rowIdx, field });
    setEditValue(String(currentValue ?? ''));
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Save edited cell and re-validate
  const saveEdit = () => {
    if (!editingCell) return;
    const { rowIndex, field } = editingCell;

    // Clone current data for this entity
    const updatedData = [...rowData];
    let parsedValue: any = editValue;

    // Basic parsing for number-like fields
    const numericFields = [
      'PriorityLevel',
      'Duration',
      'MaxConcurrent',
      'MaxLoadPerPhase',
      'QualificationLevel',
    ];

    if (numericFields.includes(field)) {
      parsedValue = Number.isNaN(parseInt(editValue, 10)) ? 0 : parseInt(editValue, 10);
    } else if (field === 'AttributesJSON') {
      // Keep string; parsing is validated separately
      parsedValue = editValue;
    } else {
      parsedValue = editValue;
    }

    updatedData[rowIndex] = { ...updatedData[rowIndex], [field]: parsedValue };

    // Write back to the correct store
    if (entityType === 'clients') setClients(updatedData);
    if (entityType === 'workers') setWorkers(updatedData);
    if (entityType === 'tasks') setTasks(updatedData);

    // Trigger validation with updated entity snapshot
    setTimeout(() => {
      setValidating(true);
      const finalClients = entityType === 'clients' ? updatedData : clients;
      const finalWorkers = entityType === 'workers' ? updatedData : workers;
      const finalTasks = entityType === 'tasks' ? updatedData : tasks;

      const validationErrors = validateAllData(finalClients, finalWorkers, finalTasks);
      setErrors(validationErrors);
      setValidating(false);
    }, 250);

    cancelEditing();
  };

  // Column definitions per entity
  const columnDefs: ColumnDef[] = useMemo(() => {
    if (!rowData || rowData.length === 0) return [];

    if (entityType === 'clients') {
      return [
        { field: 'ClientID', header: 'Client ID', width: 140, pinned: true },
        { field: 'ClientName', header: 'Client Name', width: 220, editable: true },
        { field: 'PriorityLevel', header: 'Priority', width: 120, editable: true },
        { field: 'RequestedTaskIDs', header: 'Requested Tasks', width: 280, editable: true },
        { field: 'GroupTag', header: 'Group', width: 150, editable: true },
        { field: 'AttributesJSON', header: 'Attributes', width: 320, editable: true },
      ];
    }

    if (entityType === 'workers') {
      return [
        { field: 'WorkerID', header: 'Worker ID', width: 140, pinned: true },
        { field: 'WorkerName', header: 'Worker Name', width: 200, editable: true },
        { field: 'Skills', header: 'Skills', width: 240, editable: true },
        { field: 'AvailableSlots', header: 'Available Slots', width: 180, editable: true },
        { field: 'MaxLoadPerPhase', header: 'Max Load', width: 140, editable: true },
        { field: 'WorkerGroup', header: 'Group', width: 140, editable: true },
        { field: 'QualificationLevel', header: 'Level', width: 120, editable: true },
      ];
    }

    // tasks
    return [
      { field: 'TaskID', header: 'Task ID', width: 140, pinned: true },
      { field: 'TaskName', header: 'Task Name', width: 220, editable: true },
      { field: 'Category', header: 'Category', width: 160, editable: true },
      { field: 'Duration', header: 'Duration', width: 120, editable: true },
      { field: 'RequiredSkills', header: 'Required Skills', width: 240, editable: true },
      { field: 'PreferredPhases', header: 'Preferred Phases', width: 200, editable: true },
      { field: 'MaxConcurrent', header: 'Max Concurrent', width: 160, editable: true },
    ];
  }, [rowData, entityType]);

  // Cell renderer with validation
  const renderCell = (row: any, rowIdx: number, column: ColumnDef) => {
    const value = row?.[column.field];
    const cellErrors = getCellErrors(rowIdx, column.field);
    const hasErrors = cellErrors.length > 0;
    const severity = cellErrors.some((e) => e.severity === 'error') ? 'error' : 'warning';
    const isEditing = editingCell?.rowIndex === rowIdx && editingCell?.field === column.field;

    if (isEditing) {
      return (
        <Group gap="xs">
          <TextInput
            value={editValue}
            onChange={(e) => setEditValue(e.currentTarget.value)}
            size="xs"
            style={{ flex: 1 }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEditing();
            }}
          />
          <ActionIcon size="xs" color="green" onClick={saveEdit}>
            <IconCheck size="0.8rem" />
          </ActionIcon>
          <ActionIcon size="xs" color="red" onClick={cancelEditing}>
            <IconX size="0.8rem" />
          </ActionIcon>
        </Group>
      );
    }

    const baseContent = (
      <Group gap="xs" justify="space-between" style={{ width: '100%' }}>
        <Text
          size="sm"
          truncate
          style={{
            flex: 1,
            color: hasErrors ? (severity === 'error' ? '#c92a2a' : '#f08c00') : undefined,
          }}
        >
          {String(value ?? '')}
        </Text>
        {hasErrors && (
          <Badge size="xs" color={severity === 'error' ? 'red' : 'orange'} variant="filled">
            {cellErrors.length}
          </Badge>
        )}
        {column.editable && (
          <ActionIcon
            size="xs"
            variant="subtle"
            onClick={() => startEditing(rowIdx, column.field, value)}
            title="Edit"
          >
            <IconEdit size="0.8rem" />
          </ActionIcon>
        )}
      </Group>
    );

    if (hasErrors) {
      return (
        <Tooltip.Group openDelay={250} closeDelay={100}>
          <Tooltip
            label={
              <div>
                {cellErrors.map((err) => (
                  <div key={err.id} style={{ marginBottom: 6 }}>
                    <Text size="xs" fw={500}>
                      {err.message}
                    </Text>
                    {err.suggestion && (
                      <Text size="xs" c="dimmed">
                        💡 {err.suggestion}
                      </Text>
                    )}
                  </div>
                ))}
              </div>
            }
            multiline
            w={320}
            withArrow
            color={severity === 'error' ? 'red' : 'orange'}
          >
            <div
              style={{
                backgroundColor: severity === 'error' ? '#ffe0e0' : '#fff4e0',
                border: `1px solid ${severity === 'error' ? '#ffa8a8' : '#ffc947'}`,
                borderRadius: 4,
                padding: '4px 8px',
                cursor: column.editable ? 'pointer' : 'default',
              }}
              onClick={() => column.editable && startEditing(rowIdx, column.field, value)}
            >
              {baseContent}
            </div>
          </Tooltip>
        </Tooltip.Group>
      );
    }

    return (
      <div
        style={{ padding: '4px 8px', cursor: column.editable ? 'pointer' : 'default' }}
        onClick={() => column.editable && startEditing(rowIdx, column.field, value)}
      >
        {baseContent}
      </div>
    );
  };

  if (!rowData || rowData.length === 0) {
    return (
      <Paper p="xl" style={{ textAlign: 'center' }}>
        <Text size="lg" c="dimmed">
          No {entityType} data loaded
        </Text>
        <Text size="sm" c="dimmed">
          Upload a file to see the data here
        </Text>
      </Paper>
    );
  }

  const totalEntityErrors = entityErrors.length;
  const errorCount = entityErrors.filter((e) => e.severity === 'error').length;
  const warningCount = entityErrors.filter((e) => e.severity === 'warning').length;

  return (
    <Paper withBorder>
      {totalEntityErrors > 0 && (
        <Alert color="orange" icon={<IconAlertTriangle size="1rem" />} mb="md">
          <Text size="sm" fw={500}>
            {errorCount} errors, {warningCount} warnings found
          </Text>
          <Text size="xs" c="dimmed">
            Click highlighted cells to edit and re-validate instantly
          </Text>
        </Alert>
      )}

      <ScrollArea>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ minWidth: 50 }}>#</Table.Th>
              {columnDefs.map((col) => (
                <Table.Th key={col.field} style={{ minWidth: col.width ?? 150 }}>
                  <Group gap="xs">
                    {col.header}
                    {entityErrors.some((e) => e.field === col.field) && (
                      <IconAlertTriangle size="0.9rem" color="#f08c00" />
                    )}
                  </Group>
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {rowData.slice(0, 100).map((row, idx) => {
              // rowIndex is defined here in map scope
              const rowIndex = idx;
              const rowErrors = getRowErrors(rowIndex);
              const hasRowErrors = rowErrors.length > 0;

              return (
                <Table.Tr
                  key={rowIndex}
                  data-row-index={rowIndex} // for jump-to-row feature
                  style={{
                    backgroundColor: hasRowErrors ? '#fef7f0' : undefined,
                    borderLeft: hasRowErrors ? '3px solid #ffa500' : undefined,
                    transition: 'background-color 0.3s ease',
                  }}
                >
                  <Table.Td>
                    <Group gap="xs">
                      <Text size="sm">{rowIndex + 1}</Text>
                      {hasRowErrors && (
                        <Badge size="xs" color="orange" variant="outline">
                          {rowErrors.length}
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>

                  {columnDefs.map((col) => (
                    <Table.Td key={`${rowIndex}-${col.field}`}>
                      {renderCell(row, rowIndex, col)}
                    </Table.Td>
                  ))}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      <Text p="sm" size="xs" c="dimmed" ta="center">
        Showing {Math.min(rowData.length, 100)} of {rowData.length} records
        {totalEntityErrors > 0 && (
          <>
            {' '}
            • {errorCount} errors, {warningCount} warnings
          </>
        )}
      </Text>
    </Paper>
  );
}
