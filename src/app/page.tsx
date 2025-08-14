// src/app/page.tsx — SINGLE SOURCE OF TRUTH fix for filtered views (map IDs -> base rows)
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

// Helper: consistent ID getter for any entity row
function getEntityId(
  row: any,
  ent: 'clients' | 'workers' | 'tasks'
): string {
  if (!row) return '';
  if (ent === 'clients') return String(row.ClientID ?? row.id ?? '');
  if (ent === 'workers') return String(row.WorkerID ?? row.id ?? '');
  return String(row.TaskID ?? row.id ?? '');
}

// Make a fast map: id -> row (for base rows)
function mapById(rows: any[], ent: 'clients' | 'workers' | 'tasks') {
  const m = new Map<string, any>();
  for (const r of rows) m.set(getEntityId(r, ent), r);
  return m;
}

export default function HomePage() {
  // Base data
  const clients = useDataStore((s) => s.clients);
  const workers = useDataStore((s) => s.workers);
  const tasks   = useDataStore((s) => s.tasks);

  // Filtered *IDs* (ALLOW either IDs or row objects coming from old code)
  // NOTE: we keep the same API name `filtered` & `setFiltered` to avoid breaking the rest of your app.
  const filtered = useDataStore((s) => s.filtered);
  const setFiltered = useDataStore((s) => s.setFiltered);

  const [activeTab, setActiveTab] = useState<string>('clients');

  const { summary, setErrors, setValidating } = useValidationStore();
  const totalRecords = clients.length + workers.length + tasks.length;

  // Prevent validator loops when fixes are applied
  const applyingFixRef = useRef(false);

  const runValidation = () => {
    if (applyingFixRef.current) return; // guard: don't validate mid-fix
    setValidating(true);
    setTimeout(() => {
      const errors = validateAllData(clients, workers, tasks);
      setErrors(errors);
      setValidating(false);
    }, 100);
  };

  // Jump-to-row (unchanged)
  const handleJumpToRow = (entity: 'clients' | 'workers' | 'tasks', rowIndex: number) => {
    setActiveTab(entity);
    setTimeout(() => {
      const targetRow = document.querySelector(`[data-row-index="${rowIndex}"]`) as HTMLElement;
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

  // View selector: ALWAYS return BASE rows; filtered acts as an ID filter
  const view = (ent: 'clients' | 'workers' | 'tasks') => {
    const base = ent === 'clients' ? clients : ent === 'workers' ? workers : tasks;

    // No filter → return base
    const f = filtered[ent];
    if (!f || (Array.isArray(f) && f.length === 0)) return base;

    // Build base map
    const baseMap = mapById(base, ent);

    // Accept BOTH “IDs array” and “rows array” (back-compat)
    const ids = (f as any[]).map(item =>
      typeof item === 'string' ? item : getEntityId(item, ent)
    );

    // Map IDs -> base rows; drop missing
    const proj: any[] = [];
    for (const id of ids) {
      const r = baseMap.get(String(id));
      if (r) proj.push(r);
    }
    return proj;
  };

  // Banner state for NL filtering
  const [filterBanner, setFilterBanner] = useState<{
    visible: boolean;
    entity?: 'clients' | 'workers' | 'tasks';
    source?: 'ai' | 'heuristic';
    shown?: number;
    total?: number;
  }>({ visible: false });

  const clearBanner = () => setFilterBanner({ visible: false });

  // Memo totals for banner
  const totals = useMemo(() => ({
    clients: clients.length,
    workers: workers.length,
    tasks: tasks.length,
  }), [clients.length, workers.length, tasks.length]);

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

      {/* NL Search */}
      {totalRecords > 0 && (
        <>
          <Space h="lg" />
          

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

      {/* Validation panel (unchanged API) */}
      {totalRecords > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <ValidationPanel
            onJumpToRow={handleJumpToRow}
            // Guard validator during fixes to avoid loops
            onBeforeApplyFix={() => { applyingFixRef.current = true; }}
            onAfterApplyFix={() => {
              applyingFixRef.current = false;
              // re-run once after fixes settle
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

      <NLSearchBar
            activeEntity={activeTab as 'clients' | 'workers' | 'tasks'}
            onApply={(entity, filterResult) => {
              // Normalize to ID list so the grid renders the BASE rows
              const rows = (filterResult?.rows ?? []) as any[];
              const ids = rows.map(r => getEntityId(r, entity)).filter(Boolean);
              setFiltered(entity, ids); // ← store keeps filtered as IDs (or accepts IDs)
              setFilterBanner({
                visible: true,
                entity,
                source: (filterResult?.source as 'ai' | 'heuristic') ?? 'ai',
                shown: ids.length,
                total: totals[entity],
              });
            }}
            onClear={(entity) => {
              setFiltered(entity, null);
              clearBanner();
            }}
          />

      {/* Tabs + Grids */}
      {totalRecords > 0 ? (
        <div style={{ marginTop: '2rem' }}>
          <Tabs value={activeTab} onChange={(v) => setActiveTab((v as string) || 'clients')}>
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
