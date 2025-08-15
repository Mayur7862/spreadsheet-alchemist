// src/app/page.tsx — SINGLE SOURCE OF TRUTH fix (typed) for filtered views
'use client';

import { Container, Tabs, Text, Badge, Button, Group, Space, Alert } from '@mantine/core';
import { useMemo, useRef, useState } from 'react';
import FileUploader from '@/components/FileUploader';
import DataGrid from '@/components/DataGrid';
import ValidationPanel from '@/components/ValidationPanel';
import { useDataStore } from '@/store/useDataStore';
import { useValidationStore } from '@/store/useValidationStore';
import { validateAllData } from '@/utils/validators';
import NLSearchBar from '@/components/NLSearchBar';
import RuleBuilderPanel from '@/components/RuleBuilderPanel';
import type { Preflight, PreflightErr } from '@/types/api';

// Optional (helps avoid SSG build issues on Vercel)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ===================== Types ===================== */
type Entity = 'clients' | 'workers' | 'tasks';

type BaseRow = { id?: string };
export type ClientRow = BaseRow & { ClientID?: string };
export type WorkerRow = BaseRow & { WorkerID?: string };
export type TaskRow   = BaseRow & { TaskID?: string };
export type AnyRow    = ClientRow | WorkerRow | TaskRow;

type RowFor<E extends Entity> =
  E extends 'clients' ? ClientRow :
  E extends 'workers' ? WorkerRow :
  TaskRow;

type FilterToken = string | Partial<ClientRow & WorkerRow & TaskRow>;

/* ========== Stable ID getter (overloads) ========== */
function getEntityId(row: ClientRow | null | undefined, ent: 'clients'): string;
function getEntityId(row: WorkerRow | null | undefined, ent: 'workers'): string;
function getEntityId(row: TaskRow   | null | undefined, ent: 'tasks'  ): string;
// Impl
function getEntityId(row: AnyRow | null | undefined, ent: Entity): string {
  if (!row) return '';
  switch (ent) {
    case 'clients': return String((row as ClientRow).ClientID ?? row.id ?? '');
    case 'workers': return String((row as WorkerRow).WorkerID ?? row.id ?? '');
    case 'tasks':   return String((row as TaskRow).TaskID   ?? row.id ?? '');
  }
}

/* ===== Map helper (typed) : id -> base row ===== */
function mapById<E extends Entity>(rows: RowFor<E>[], ent: E): Map<string, RowFor<E>> {
  const m = new Map<string, RowFor<E>>();
  for (const r of rows) m.set(getEntityId(r as any, ent), r);
  return m;
}

export default function HomePage() {
  /* ---------- Base data (cast to precise row types) ---------- */
  const clients = useDataStore((s) => s.clients) as ClientRow[];
  const workers = useDataStore((s) => s.workers) as WorkerRow[];
  const tasks   = useDataStore((s) => s.tasks)   as TaskRow[];

  /* ---------- Filtered: accepts IDs or row objects ---------- */
  const filtered = useDataStore((s) => s.filtered) as Record<Entity, string[] | AnyRow[] | null | undefined>;
  const setFiltered = useDataStore((s) => s.setFiltered) as (
    entity: Entity,
    value: string[] | AnyRow[] | null
  ) => void;

  const [activeTab, setActiveTab] = useState<Entity>('clients');

  const { summary, setErrors, setValidating } = useValidationStore();
  const totalRecords = clients.length + workers.length + tasks.length;

  // Prevent validator loops when fixes are applied
  const applyingFixRef = useRef(false);

  const runValidation = () => {
    if (applyingFixRef.current) return; // guard: don't validate mid-fix
    setValidating(true);
    setTimeout(() => {
      const next = validateAllData(clients, workers, tasks);
      setErrors(next);
      setValidating(false);
    }, 100);
  };

  // Jump-to-row (unchanged)
  const handleJumpToRow = (entity: Entity, rowIndex: number) => {
    setActiveTab(entity);
    setTimeout(() => {
      const targetRow = document.querySelector<HTMLElement>(`[data-row-index="${rowIndex}"]`);
      if (targetRow) {
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const originalBg = targetRow.style.backgroundColor;
        targetRow.style.backgroundColor = '#fff3cd';
        targetRow.style.borderLeft = '4px solid #ffc107';
        setTimeout(() => {
          targetRow.style.backgroundColor = originalBg;
          targetRow.style.borderLeft = '';
        }, 3000);
      }
    }, 200);
  };

  /* ---------- View selector: ALWAYS return BASE rows ---------- */
  function view<E extends Entity>(ent: E): RowFor<E>[] {
    const base = (ent === 'clients'
      ? clients
      : ent === 'workers'
      ? workers
      : tasks) as RowFor<E>[];

    const f = filtered[ent];
    if (!f || (Array.isArray(f) && f.length === 0)) return base;

    const baseMap = mapById(base, ent);

    // Normalize tokens to IDs
    const ids = (f as FilterToken[]).map((item) => {
      if (typeof item === 'string') return item;
      if (ent === 'clients') return getEntityId(item as ClientRow, ent);
      if (ent === 'workers') return getEntityId(item as WorkerRow, ent);
      return getEntityId(item as TaskRow, ent);
    });

    // Project IDs -> base rows, dropping missing
    const out = ids
      .map((id) => baseMap.get(String(id)))
      .filter((r): r is RowFor<E> => Boolean(r));

    return out;
  }

  // Banner state for NL filtering
  const [filterBanner, setFilterBanner] = useState<{
    visible: boolean;
    entity?: Entity;
    source?: 'ai' | 'heuristic';
    shown?: number;
    total?: number;
  }>({ visible: false });

  const clearBanner = () => setFilterBanner({ visible: false });

  // Totals typed (avoid index signature typing warnings)
  const totals: Record<Entity, number> = useMemo(
    () => ({ clients: clients.length, workers: workers.length, tasks: tasks.length }),
    [clients.length, workers.length, tasks.length]
  );

  return (
    <Container size="xl" py="xl">
      {/* Header */}
      <Group justify="space-between">
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem' }}>🧙‍♂️ Spreadsheet Alchemist</h1>
          <Text c="dimmed" size="lg">Transform messy data into clean, validated datasets</Text>
          {totalRecords > 0 && (
            <Badge size="lg" variant="light" color="green" mt="sm">
              📊 {totalRecords} Total Records Loaded
            </Badge>
          )}
        </div>
        {totalRecords > 0 && (
          <Button onClick={runValidation} size="lg" color="blue">
            🔍 Run Validation
          </Button>
        )}
      </Group>

      {/* Uploader */}
      <Space h="md" />
      <FileUploader />

      {/* NL Search + banner */}
      {totalRecords > 0 && (
        <>
          <Space h="lg" />
          <NLSearchBar
            activeEntity={activeTab}
            onApply={(entity, filterResult) => {
              const rows = (filterResult?.rows ?? []) as AnyRow[];
              // Store either rows or IDs; your view() handles both
              setFiltered(entity, rows);
              setFilterBanner({
                visible: true,
                entity,
                source: (filterResult?.source as 'ai' | 'heuristic') ?? 'ai',
                shown: rows.length,
                total: totals[entity],
              });
            }}
            onClear={(entity) => {
              setFiltered(entity, null);
              clearBanner();
            }}
          />
          {filterBanner.visible && (
            <>
              <Space h="md" />
              <Alert color="green" variant="light" title="Results generated">
                ✅ Results generated via <b>{filterBanner.source?.toUpperCase()}</b> — here are the filtered results for{' '}
                <b>{(filterBanner.entity ?? '').toUpperCase()}</b> (
                {filterBanner.shown} of {filterBanner.total} shown).
              </Alert>
            </>
          )}
        </>
      )}

      {/* Validation panel */}
      {totalRecords > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <ValidationPanel
            onJumpToRow={handleJumpToRow}
            onBeforeApplyFix={() => { applyingFixRef.current = true; }}
            onAfterApplyFix={() => {
              applyingFixRef.current = false;
              runValidation();
            }}
          />
        </div>
      )}

      {/* Rules Panel */}
      {totalRecords > 0 && (
        <>
          <Space h="xl" />
          <RuleBuilderPanel data={{ clients, workers, tasks }} />
        </>
      )}

      {/* Tabs + Grids */}
      {totalRecords > 0 ? (
        <div style={{ marginTop: '2rem' }}>
          <Tabs value={activeTab} onChange={(v) => setActiveTab((v as Entity) || 'clients')}>
            <Tabs.List>
              <Tabs.Tab value="clients">
                👥 Clients
                <Badge size="sm" ml="xs" color="blue">{view('clients').length}</Badge>
                {filtered.clients && <Badge size="sm" ml="xs" variant="light" color="green">Filtered</Badge>}
                {summary.clientErrors > 0 && <Badge size="sm" ml="xs" color="red">{summary.clientErrors}</Badge>}
              </Tabs.Tab>
              <Tabs.Tab value="workers">
                👷 Workers
                <Badge size="sm" ml="xs" color="green">{view('workers').length}</Badge>
                {filtered.workers && <Badge size="sm" ml="xs" variant="light" color="green">Filtered</Badge>}
                {summary.workerErrors > 0 && <Badge size="sm" ml="xs" color="red">{summary.workerErrors}</Badge>}
              </Tabs.Tab>
              <Tabs.Tab value="tasks">
                📋 Tasks
                <Badge size="sm" ml="xs" color="orange">{view('tasks').length}</Badge>
                {filtered.tasks && <Badge size="sm" ml="xs" variant="light" color="green">Filtered</Badge>}
                {summary.taskErrors > 0 && <Badge size="sm" ml="xs" color="red">{summary.taskErrors}</Badge>}
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="clients" pt="lg">
              <Text mb="md" size="sm" c="dimmed">
                Clients Data ({view('clients').length} records)
                {filtered.clients && <Badge size="sm" ml="xs" variant="light" color="green">Filtered</Badge>}
                {summary.clientErrors > 0 && <Badge size="sm" ml="xs" color="red">{summary.clientErrors} issues</Badge>}
              </Text>
              <DataGrid rowData={view('clients')} entityType="clients" />
            </Tabs.Panel>

            <Tabs.Panel value="workers" pt="lg">
              <Text mb="md" size="sm" c="dimmed">
                Workers Data ({view('workers').length} records)
                {filtered.workers && <Badge size="sm" ml="xs" variant="light" color="green">Filtered</Badge>}
                {summary.workerErrors > 0 && <Badge size="sm" ml="xs" color="red">{summary.workerErrors} issues</Badge>}
              </Text>
              <DataGrid rowData={view('workers')} entityType="workers" />
            </Tabs.Panel>

            <Tabs.Panel value="tasks" pt="lg">
              <Text mb="md" size="sm" c="dimmed">
                Tasks Data ({view('tasks').length} records)
                {filtered.tasks && <Badge size="sm" ml="xs" variant="light" color="green">Filtered</Badge>}
                {summary.taskErrors > 0 && <Badge size="sm" ml="xs" color="red">{summary.taskErrors} issues</Badge>}
              </Text>
              <DataGrid rowData={view('tasks')} entityType="tasks" />
            </Tabs.Panel>
          </Tabs>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '3rem', padding: '2rem' }}>
          <Text size="xl" c="dimmed">📤 Upload your files to get started</Text>
          <Text size="sm" c="dimmed" mt="sm">Excel file with 3 sheets or individual CSV files</Text>
        </div>
      )}
    </Container>
  );
}
