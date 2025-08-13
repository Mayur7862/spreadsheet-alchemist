// src/app/page.tsx — updated to include Natural Language search (AI) and to use filtered views
'use client';

import { Container, Tabs, Text, Badge, Button, Group, Space } from '@mantine/core';
import { useState } from 'react';
import FileUploader from '@/components/FileUploader';
import DataGrid from '@/components/DataGrid';
import ValidationPanel from '@/components/ValidationPanel';
import { useDataStore } from '@/store/useDataStore';
import { useValidationStore } from '@/store/useValidationStore';
import { validateAllData } from '@/utils/validators';
import NLSearchBar from '@/components/NLSearchBar'; // ⬅️ NEW: AI Natural Language search bar

export default function HomePage() {
  // Base data
  const clients = useDataStore((s) => s.clients);
  const workers = useDataStore((s) => s.workers);
  const tasks   = useDataStore((s) => s.tasks);

  // Filtered views (non-destructive)
  const filtered = useDataStore((s) => s.filtered);
  const setFiltered = useDataStore((s) => s.setFiltered);

  // Active tab (controls which entity NLSearchBar targets)
  const [activeTab, setActiveTab] = useState<string>('clients');

  const { summary, setErrors, setValidating } = useValidationStore();
  const totalRecords = clients.length + workers.length + tasks.length;

  const runValidation = () => {
    setValidating(true);
    // Small timeout for UI responsiveness
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

  // Helper to pick base or filtered for each entity
  const view = (ent: 'clients' | 'workers' | 'tasks') => {
    const base = ent === 'clients' ? clients : ent === 'workers' ? workers : tasks;
    return filtered[ent] ?? base;
  };

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

      {/* ⬅️ Natural Language Search (AI) */}
      {totalRecords > 0 && (
        <>
          <Space h="lg" />
          <NLSearchBar
            activeEntity={activeTab as 'clients' | 'workers' | 'tasks'}
            onApply={(entity, filterResult) => {
              // filterResult should already be applied by the component,
              // but you can inspect it here if you want.
              // e.g., console.log('Applied filter from:', filterResult.source);
            }}
            onClear={(entity) => setFiltered(entity, null)}
          />
        </>
      )}

      {/* Validation panel */}
      {totalRecords > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <ValidationPanel onJumpToRow={handleJumpToRow} />
        </div>
      )}

    <NLSearchBar
      activeEntity={activeTab as 'clients' | 'workers' | 'tasks'}
      onApply={(entity, result) => { /* optional: inspect result.source */ }}
      onClear={(entity) => { /* optional */ }}
     />

      {/* Tabs + Grids (render filtered view if present) */}
      {totalRecords > 0 ? (
        <div style={{ marginTop: '2rem' }}>
          <Tabs value={activeTab} onChange={(v) => setActiveTab((v as string) || 'clients')}>
            <Tabs.List>
              <Tabs.Tab value="clients">
                👥 Clients
                <Badge size="sm" ml="xs" color="blue">{view('clients').length}</Badge>
                {summary.clientErrors > 0 && <Badge size="sm" ml="xs" color="red">{summary.clientErrors}</Badge>}
              </Tabs.Tab>
              <Tabs.Tab value="workers">
                👷 Workers
                <Badge size="sm" ml="xs" color="green">{view('workers').length}</Badge>
                {summary.workerErrors > 0 && <Badge size="sm" ml="xs" color="red">{summary.workerErrors}</Badge>}
              </Tabs.Tab>
              <Tabs.Tab value="tasks">
                📋 Tasks
                <Badge size="sm" ml="xs" color="orange">{view('tasks').length}</Badge>
                {summary.taskErrors > 0 && <Badge size="sm" ml="xs" color="red">{summary.taskErrors}</Badge>}
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="clients" pt="lg">
              <Text mb="md" size="sm" c="dimmed">
                Clients Data ({view('clients').length} records)
                {summary.clientErrors > 0 && <Badge size="sm" ml="xs" color="red">{summary.clientErrors} issues</Badge>}
              </Text>
              <DataGrid rowData={view('clients')} entityType="clients" />
            </Tabs.Panel>

            <Tabs.Panel value="workers" pt="lg">
              <Text mb="md" size="sm" c="dimmed">
                Workers Data ({view('workers').length} records)
                {summary.workerErrors > 0 && <Badge size="sm" ml="xs" color="red">{summary.workerErrors} issues</Badge>}
              </Text>
              <DataGrid rowData={view('workers')} entityType="workers" />
            </Tabs.Panel>

            <Tabs.Panel value="tasks" pt="lg">
              <Text mb="md" size="sm" c="dimmed">
                Tasks Data ({view('tasks').length} records)
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
