// Adds a per-tab natural language search input.
// It parses plain English into a FilterNode, applies it to base rows,
// and shows the filtered subset without overwriting your original data.

'use client';
import { Tabs, Text, Group, Button, TextInput, Tooltip } from '@mantine/core';
import DataTable from '@/components/DataTable';
import { useDataStore } from '@/store/useDataStore';
import { useState } from 'react';
import { applyFilter } from '@/utils/dsl';
import { nlToDsl } from '@/utils/nlToDsl';

export default function EntityTabs() {
  const { clients, workers, tasks, filtered, setFiltered } = useDataStore((s) => ({
    clients: s.clients, workers: s.workers, tasks: s.tasks,
    filtered: s.filtered, setFiltered: s.setFiltered
  }));

  // Controlled inputs for each tab's NL query
  const [q, setQ] = useState<{clients: string; workers: string; tasks: string}>({ clients:'', workers:'', tasks:'' });

  const base = (ent: 'clients'|'workers'|'tasks') =>
    ent === 'clients' ? clients : ent === 'workers' ? workers : tasks;

  const view = (ent: 'clients'|'workers'|'tasks') =>
    filtered[ent] ?? base(ent);

  function run(ent: 'clients'|'workers'|'tasks') {
    const text = q[ent].trim();
    if (!text) return;

    // Parse English → FilterNode
    const node = nlToDsl(text);
    if (!node) {
      // You can add a toast/notification here to tell the user the query couldn't be parsed.
      return;
    }

    // Apply filter to base rows and store as a non-destructive "filtered view"
    const subset = applyFilter(base(ent), node);
    setFiltered(ent, subset);
  }

  function clear(ent: 'clients'|'workers'|'tasks') {
    setFiltered(ent, null);              // clears filtered view; shows full dataset again
    setQ((x) => ({ ...x, [ent]: '' }));  // reset the input
  }

  return (
    <Tabs defaultValue="clients" keepMounted={false}>
      <Tabs.List>
        <Tabs.Tab value="clients">Clients ({view('clients').length})</Tabs.Tab>
        <Tabs.Tab value="workers">Workers ({view('workers').length})</Tabs.Tab>
        <Tabs.Tab value="tasks">Tasks ({view('tasks').length})</Tabs.Tab>
      </Tabs.List>

      {(['clients','workers','tasks'] as const).map((ent) => (
        <Tabs.Panel key={ent} value={ent} pt="md">
          <Group align="center" mb="sm">
            <TextInput
              placeholder={`Natural language search in ${ent}…`}
              value={q[ent]}
              onChange={(e)=>setQ((x)=>({ ...x, [ent]: e.currentTarget.value }))}
              style={{ flex: 1 }}
            />
            <Tooltip label='Examples: "priority less than 4", "duration > 2 and phase 3", "available slots include 5"'>
              <Button onClick={()=>run(ent)}>Search</Button>
            </Tooltip>
            <Button variant="light" onClick={()=>clear(ent)}>Clear</Button>
            <Text c="dimmed" size="sm">Filtered: {filtered[ent]?.length ?? 0}</Text>
          </Group>

          <DataTable entity={ent} rows={view(ent)} />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
