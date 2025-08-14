// src/components/ValidationPanel.tsx
'use client';

import {
  Paper,
  Text,
  Badge,
  Stack,
  Group,
  Alert,
  ScrollArea,
  Button,
  Collapse,
  ActionIcon,
  Divider,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconLogicAnd,
  IconExternalLink,
} from '@tabler/icons-react';
import { useValidationStore } from '../store/useValidationStore';
import { useDataStore } from '../store/useDataStore';
import { validateAllData } from '../utils/validators';
import { useMemo, useState } from 'react';

type Entity = 'clients' | 'workers' | 'tasks';

interface ValidationPanelProps {
  onJumpToRow?: (entity: Entity, rowIndex: number) => void;
  /** Optional guards to prevent validate loops while applying fixes */
  onBeforeApplyFix?: () => void;
  onAfterApplyFix?: () => void;
}

/* ---------- Stable ID helpers ---------- */
const getId = (row: any, ent: Entity): string => {
  if (!row) return '';
  if (ent === 'clients') return String(row.ClientID ?? row.id ?? '');
  if (ent === 'workers') return String(row.WorkerID ?? row.id ?? '');
  return String(row.TaskID ?? row.id ?? '');
};

const ensureString = (v: any) => (v == null ? '' : String(v));

export default function ValidationPanel({
  onJumpToRow,
  onBeforeApplyFix,
  onAfterApplyFix,
}: ValidationPanelProps) {
  const { errors, summary, isValidating, setErrors, setValidating, removeError } = useValidationStore();
  const { clients, workers, tasks } = useDataStore();

  const setState = useDataStore.setState; // imperative setter for batched updates
  const getState = useDataStore.getState; // read latest

  const [fixingErrors, setFixingErrors] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<{ errors: boolean; warnings: boolean }>({
    errors: true,
    warnings: false,
  });

  const criticalErrors = useMemo(() => errors.filter((e) => e.severity === 'error'), [errors]);
  const warnings = useMemo(() => errors.filter((e) => e.severity === 'warning'), [errors]);

  /* ---------- UI helpers ---------- */
  const scrollToError = (entityType: Entity, rowIndex: number) => {
    if (onJumpToRow) {
      onJumpToRow(entityType, rowIndex);
      return;
    }
    const tabButton = document.querySelector(`[data-value="${entityType}"]`) as HTMLElement;
    if (tabButton) {
      tabButton.click();
      setTimeout(() => {
        const targetRow = document.querySelector(`[data-row-index="${rowIndex}"]`) as HTMLElement;
        if (targetRow) {
          targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const originalBg = targetRow.style.backgroundColor;
          (targetRow as any).style.backgroundColor = '#fff3cd';
          setTimeout(() => {
            (targetRow as any).style.backgroundColor = originalBg;
          }, 3000);
        }
      }, 200);
    }
  };

  /* ---------- Revalidation (with guard hooks) ---------- */
  const revalidate = () => {
    // If parent provided guards, let it handle revalidation
    if (onAfterApplyFix) {
      onAfterApplyFix();
      return;
    }
    // Fallback: local revalidation
    setValidating(true);
    const s = getState();
    const nextErrors = validateAllData(s.clients, s.workers, s.tasks);
    setErrors(nextErrors);
    setValidating(false);
  };

  /* ---------- Single Auto-Fix (ID-based, not rowIndex) ---------- */
  const applyAutoFix = async (error: any) => {
    if (error?.autoFixValue === undefined) return;

    setFixingErrors((prev) => new Set([...prev, error.id]));
    onBeforeApplyFix?.();

    try {
      const entity: Entity = error.entity;
      const field: string = ensureString(error.field);
      // Prefer error.entityId; fallback to base row by provided rowIndex
      const baseArr = entity === 'clients' ? clients : entity === 'workers' ? workers : tasks;
      const id = ensureString(error.entityId) || getId(baseArr[error.rowIndex], entity);
      if (!id) throw new Error('Cannot resolve stable entity ID for auto-fix');

      // Apply patch immutably by ID to the BASE array
      setState((s) => {
        const key = entity;
        const arr = (s as any)[key] as any[];
        const next = arr.map((r) => (getId(r, entity) === id ? { ...r, [field]: error.autoFixValue } : r));
        return { [key]: next } as any;
      });

      // Remove just this error; full revalidation will refresh rest
      removeError(error.id);
    } catch (e) {
      console.error('Auto-fix failed:', e);
    } finally {
      setFixingErrors((prev) => {
        const n = new Set(prev);
        n.delete(error.id);
        return n;
      });
      revalidate();
    }
  };

  /* ---------- Bulk Auto-Fix (batched, single render, single revalidate) ---------- */
  const applyAllAutoFixes = async () => {
    const fixable = errors.filter((e) => e.autoFixValue !== undefined);
    if (fixable.length === 0) return;

    // Visually mark as fixing
    setFixingErrors(new Set(fixable.map((e) => e.id)));
    onBeforeApplyFix?.();

    try {
      // Aggregate patches as: { entity: { id: { field: value, ... } } }
      const patches: Record<Entity, Record<string, Record<string, any>>> = {
        clients: {},
        workers: {},
        tasks: {},
      };

      for (const e of fixable) {
        const entity: Entity = e.entity;
        const field: string = ensureString(e.field);
        const baseArr = entity === 'clients' ? clients : entity === 'workers' ? workers : tasks;
        const id = ensureString(e.entityId) || getId(baseArr[e.rowIndex], entity);
        if (!id) continue;
        if (!patches[entity][id]) patches[entity][id] = {};
        patches[entity][id][field] = e.autoFixValue;
      }

      // Single state update for all entities
      setState((s) => {
        const next: any = {};

        (['clients', 'workers', 'tasks'] as Entity[]).forEach((ent) => {
          const arr = (s as any)[ent] as any[];
          const entPatches = patches[ent];
          if (!entPatches || Object.keys(entPatches).length === 0) {
            next[ent] = arr;
            return;
          }
          next[ent] = arr.map((r) => {
            const id = getId(r, ent);
            const patch = entPatches[id];
            return patch ? { ...r, ...patch } : r;
          });
        });

        return next;
      });

      // Remove fixed errors locally to reduce flicker; full revalidation will reconcile
      // (If your store recomputes errors from scratch, this is optional)
      // Here we simply rely on revalidation to refresh everything.
    } catch (e) {
      console.error('Fix-all failed:', e);
    } finally {
      // Clear fixing flags
      setFixingErrors(new Set());
      revalidate();
    }
  };

  /* ---------- Rendering ---------- */
  if (isValidating) {
    return (
      <Paper p="md" withBorder>
        <Group>
          <div className="animate-spin">⚙️</div>
          <Text>Running comprehensive validation...</Text>
        </Group>
      </Paper>
    );
  }

  if (errors.length === 0) {
    return (
      <Paper p="md" withBorder style={{ backgroundColor: '#f0fff0' }}>
        <Group>
          <IconCheck size="1.5rem" color="green" />
          <div>
            <Text fw={600} c="green">✅ All validations passed!</Text>
            <Text size="sm" c="dimmed">No data quality issues detected.</Text>
          </div>
        </Group>
      </Paper>
    );
  }

  const toggleSection = (section: 'errors' | 'warnings') => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const fixableErrorsCount = errors.filter((e) => e.autoFixValue !== undefined).length;

  return (
    <Paper withBorder>
      <Stack gap="md">
        {/* Summary Header */}
        <Paper
          p="md"
          style={{
            backgroundColor: summary.totalErrors > 0 ? '#fff5f5' : '#fffbf0',
            borderBottom: '1px solid #eee',
          }}
        >
          <Group justify="space-between">
            <div>
              <Text fw={600} size="lg">🔍 Validation Results</Text>
              <Text size="sm" c="dimmed">
                Last run: {summary.lastValidation?.toLocaleTimeString() || 'Never'} •
                {' '}Click on highlighted cells in tables to edit and fix issues
              </Text>
            </div>
            <Group gap="xs">
              {summary.totalErrors > 0 && (
                <Badge color="red" variant="filled">
                  {summary.totalErrors} Errors
                </Badge>
              )}
              {summary.totalWarnings > 0 && (
                <Badge color="orange" variant="filled">
                  {summary.totalWarnings} Warnings
                </Badge>
              )}
              {summary.criticalIssues > 0 && (
                <Badge color="red" variant="outline">
                  🚨 {summary.criticalIssues} Critical
                </Badge>
              )}
              {fixableErrorsCount > 0 && (
                <Button
                  size="xs"
                  color="green"
                  leftSection={<IconLogicAnd size="0.8rem" />}
                  onClick={applyAllAutoFixes}
                  loading={fixingErrors.size > 0}
                >
                  Fix All ({fixableErrorsCount})
                </Button>
              )}
            </Group>
          </Group>

          <Group gap="lg" mt="md">
            <Group gap="xs">
              <Text size="sm" fw={500}>By Entity:</Text>
              <Badge color="blue" variant="light">👥 Clients: {summary.clientErrors}</Badge>
              <Badge color="green" variant="light">👷 Workers: {summary.workerErrors}</Badge>
              <Badge color="orange" variant="light">📋 Tasks: {summary.taskErrors}</Badge>
            </Group>
          </Group>
        </Paper>

        {/* Critical Errors */}
        {criticalErrors.length > 0 && (
          <div>
            <Group justify="space-between" style={{ cursor: 'pointer' }} onClick={() => toggleSection('errors')}>
              <Group>
                <IconAlertTriangle size="1.2rem" color="red" />
                <Text fw={600} c="red">Critical Errors ({criticalErrors.length})</Text>
              </Group>
              <ActionIcon variant="subtle" size="sm">
                {expandedSections.errors ? <IconChevronUp /> : <IconChevronDown />}
              </ActionIcon>
            </Group>

            <Collapse in={expandedSections.errors}>
              <ScrollArea style={{ maxHeight: 400 }} mt="sm">
                <Stack gap="xs">
                  {criticalErrors.map((error) => (
                    <Alert key={error.id} color="red" variant="light">
                      <Group justify="space-between" align="flex-start">
                        <div style={{ flex: 1 }}>
                          <Group gap="xs" mb="xs">
                            <Badge size="xs" color="red">{error.entity}</Badge>
                            <Badge
                              size="xs"
                              variant="outline"
                              style={{ cursor: 'pointer' }}
                              onClick={() => scrollToError(error.entity, error.rowIndex)}
                            >
                              {error.entityId} • Row {error.rowIndex + 1}
                            </Badge>
                            <Badge size="xs" variant="outline">{error.field}</Badge>
                          </Group>
                          <Text size="sm" fw={500} mb="xs">{error.message}</Text>
                          {error.suggestion && (
                            <Text size="xs" c="dimmed" mb="xs">
                              💡 {error.suggestion}
                            </Text>
                          )}
                          {error.autoFixValue !== undefined && (
                            <Paper p="xs" style={{ backgroundColor: '#e7f5ff' }}>
                              <Text size="xs" c="blue">
                                🔧 <strong>Suggested fix:</strong> "{String(error.autoFixValue)}"
                              </Text>
                            </Paper>
                          )}
                        </div>
                        <Stack gap="xs" align="center" style={{ minWidth: 120 }}>
                          <Button
                            size="xs"
                            variant="light"
                            color="blue"
                            leftSection={<IconExternalLink size="0.7rem" />}
                            onClick={() => scrollToError(error.entity, error.rowIndex)}
                            fullWidth
                          >
                            Jump to Row
                          </Button>
                          {error.autoFixValue !== undefined && (
                            <Button
                              size="xs"
                              variant="light"
                              color="green"
                              leftSection={<IconLogicAnd size="0.7rem" />}
                              onClick={() => applyAutoFix(error)}
                              loading={fixingErrors.has(error.id)}
                              fullWidth
                            >
                              Auto-fix
                            </Button>
                          )}
                        </Stack>
                      </Group>
                    </Alert>
                  ))}
                </Stack>
              </ScrollArea>
            </Collapse>
          </div>
        )}

        {criticalErrors.length > 0 && warnings.length > 0 && <Divider />}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div>
            <Group justify="space-between" style={{ cursor: 'pointer' }} onClick={() => toggleSection('warnings')}>
              <Group>
                <IconAlertTriangle size="1.2rem" color="orange" />
                <Text fw={600} c="orange">Warnings ({warnings.length})</Text>
              </Group>
              <ActionIcon variant="subtle" size="sm">
                {expandedSections.warnings ? <IconChevronUp /> : <IconChevronDown />}
              </ActionIcon>
            </Group>

            <Collapse in={expandedSections.warnings}>
              <ScrollArea style={{ maxHeight: 300 }} mt="sm">
                <Stack gap="xs">
                  {warnings.map((error) => (
                    <Alert key={error.id} color="orange" variant="light">
                      <Group justify="space-between" align="flex-start">
                        <div style={{ flex: 1 }}>
                          <Group gap="xs" mb="xs">
                            <Badge size="xs" color="orange">{error.entity}</Badge>
                            <Badge
                              size="xs"
                              variant="outline"
                              style={{ cursor: 'pointer' }}
                              onClick={() => scrollToError(error.entity, error.rowIndex)}
                            >
                              {error.entityId} • Row {error.rowIndex + 1}
                            </Badge>
                            <Badge size="xs" variant="outline">{error.field}</Badge>
                          </Group>
                          <Text size="sm" fw={500} mb="xs">{error.message}</Text>
                          {error.suggestion && (
                            <Text size="xs" c="dimmed">💡 {error.suggestion}</Text>
                          )}
                          {error.autoFixValue !== undefined && (
                            <Paper p="xs" mt="xs" style={{ backgroundColor: '#fff4e6' }}>
                              <Text size="xs" c="orange">
                                🔧 <strong>Suggested fix:</strong> "{String(error.autoFixValue)}"
                              </Text>
                            </Paper>
                          )}
                        </div>
                        <Stack gap="xs" align="center" style={{ minWidth: 120 }}>
                          <Button
                            size="xs"
                            variant="light"
                            color="orange"
                            leftSection={<IconExternalLink size="0.7rem" />}
                            onClick={() => scrollToError(error.entity, error.rowIndex)}
                            fullWidth
                          >
                            Jump to Row
                          </Button>
                          {error.autoFixValue !== undefined && (
                            <Button
                              size="xs"
                              variant="light"
                              color="green"
                              leftSection={<IconLogicAnd size="0.7rem" />}
                              onClick={() => applyAutoFix(error)}
                              loading={fixingErrors.has(error.id)}
                              fullWidth
                            >
                              Auto-fix
                            </Button>
                          )}
                        </Stack>
                      </Group>
                    </Alert>
                  ))}
                </Stack>
              </ScrollArea>
            </Collapse>
          </div>
        )}

        {/* Quick Actions */}
        <Paper p="sm" style={{ backgroundColor: '#f8f9fa' }}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              💡 <strong>How to fix issues:</strong> Use "Auto-fix" for automatic repairs,
              "Jump to Row" to navigate, or click highlighted cells to edit manually.
            </Text>
            {fixableErrorsCount > 0 && (
              <Badge color="green" variant="light">
                {fixableErrorsCount} Auto-fixable
              </Badge>
            )}
          </Group>
        </Paper>
      </Stack>
    </Paper>
  );
}
