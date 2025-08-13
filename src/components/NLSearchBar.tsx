// src/components/NLSearchBar.tsx
// Natural-language search UI that sends the query to /api/nl, then applies the
// returned filter to the current dataset and stores it as a filtered view.

'use client';

import { useState } from 'react';
import { Button, Group, Text, TextInput, Tooltip } from '@mantine/core';
import { useDataStore, EntityKey } from '@/store/useDataStore';
import { applyFilter, FilterNode } from '@/utils/dsl';

type Props = {
  activeEntity: EntityKey;                           // which tab is active
  onApply?: (entity: EntityKey, result: any) => void; // optional: observe results
  onClear?: (entity: EntityKey) => void;              // optional: observe clear
};

export default function NLSearchBar({ activeEntity, onApply, onClear }: Props) {
  const [q, setQ] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setFiltered = useDataStore((s) => s.setFiltered);

  // Access base rows from store (we filter locally)
  const baseRows = useDataStore((s) =>
    activeEntity === 'clients' ? s.clients : activeEntity === 'workers' ? s.workers : s.tasks
  );

  async function search() {
    const text = q.trim();
    if (!text) return;

    setLoading(true);
    setInfo(null);

    try {
      const res = await fetch('/api/nl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: activeEntity, text }),
      });

      const data = await res.json();
      if (!res.ok || data?.error) {
        setInfo(data?.error || 'Query could not be parsed');
        return;
      }

      // Expecting: { kind:'filter', entity, filter, source }
      if (data.kind !== 'filter' || !data.filter) {
        setInfo('No filter returned');
        return;
      }

      const node: FilterNode = data.filter;
      const subset = applyFilter(baseRows as any[], node);
      setFiltered(activeEntity, subset);
      setInfo(`Applied (${data.source || 'deterministic'}) — ${subset.length} match(es)`);
      onApply?.(activeEntity, data);
    } catch (e: any) {
      setInfo(`Error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setFiltered(activeEntity, null); // show full dataset
    setQ('');
    setInfo(null);
    onClear?.(activeEntity);
  }

  return (
    <Group align="center" gap="sm">
      <TextInput
        placeholder={`e.g., "priority level less than 4" or "duration > 2 and phase 3"`}
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        style={{ flex: 1 }}
      />
      <Tooltip label='Examples: "priority less than 4", "duration > 2 and phase 3", "available slots include 5"'>
        <Button onClick={search} loading={loading}>
          Search
        </Button>
      </Tooltip>
      <Button variant="light" onClick={clear}>
        Clear
      </Button>
      {info && <Text c="dimmed" size="sm">{info}</Text>}
    </Group>
  );
}
