// src/components/NLSearchBar.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Group, Text, TextInput, Tooltip, Loader, Stack, Badge } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { useDataStore, EntityKey } from '@/store/useDataStore';
import { applyFilter, FilterNode } from '@/utils/dsl';
import { inferSchema } from '@/utils/schema';
import { repairFilter as clientRepairFilter } from '@/utils/filterRepair';
import { clientHeuristic } from '@/utils/nlClientHeuristic';
import AiShimmer from './AiShimmer';

// simple in-memory cache per session
const aiCache = new Map<string, FilterNode>();

type Props = {
  activeEntity: EntityKey;
  onApply?: (entity: EntityKey, result: any) => void;
  onClear?: (entity: EntityKey) => void;
};

const AI_STEPS = ['Analyzing schema…', 'Understanding your intent…', 'Building filter…', 'Scanning rows…'] as const;

export default function NLSearchBar({ activeEntity, onApply, onClear }: Props) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const stepRef = useRef(0);
  const stepTimer = useRef<any>(null);

  const setFiltered = useDataStore((s) => s.setFiltered);
  const baseRows = useDataStore((s) =>
    activeEntity === 'clients' ? s.clients : activeEntity === 'workers' ? s.workers : s.tasks
  );
  const schema = useMemo(() => inferSchema(baseRows, 4), [baseRows]); // 4 samples → smaller prompt

  // Warm up AI once (loads model so first real call is faster)
  useEffect(() => {
    fetch('/api/ai/health').catch(() => {});
  }, []);

  // Animated steps
  useEffect(() => {
    if (loading) {
      setStatus(`🤖 ${AI_STEPS[0]}`);
      stepRef.current = 0;
      stepTimer.current = setInterval(() => {
        stepRef.current = (stepRef.current + 1) % AI_STEPS.length;
        setStatus(`🤖 ${AI_STEPS[stepRef.current]}`);
      }, 750);
    } else {
      if (stepTimer.current) clearInterval(stepTimer.current);
    }
    return () => stepTimer.current && clearInterval(stepTimer.current);
  }, [loading]);

  function cacheKey(text: string) {
    const cols = schema.map((s) => s.name).join(',');
    return `${activeEntity}::${cols}::${text.trim().toLowerCase()}`;
  }

  async function search() {
    const text = q.trim();
    if (!text) return pulse('🤖 Tell me what to find.', 'gray');
    if (!baseRows?.length) return pulse('🤖 Load some data first.', 'gray');
    if (!schema.length) return pulse('🤖 I couldn’t infer the schema yet.', 'gray');

    // 0) Cache hit?
    const key = cacheKey(text);
    if (aiCache.has(key)) {
      const cached = aiCache.get(key)!;
      const subset = applyFilter(baseRows as any[], cached);
      setFiltered(activeEntity, subset);
      popOk(`⚡ Instant (cached): ${subset.length} match${subset.length === 1 ? '' : 'es'}`);
      setStatus(`🤖 Cached: ${subset.length} match${subset.length === 1 ? '' : 'es'}.`);
      onApply?.(activeEntity, { source: 'cache', filter: cached });
      return;
    }

    // 1) Instant preview with client heuristic (optimistic)
    const quick = clientHeuristic(activeEntity, text, schema as any);
    if (quick) {
      const preview = applyFilter(baseRows as any[], quick);
      setFiltered(activeEntity, preview);
      popInfo(`⚡ Instant preview: ${preview.length} match${preview.length === 1 ? '' : 'es'}`);
    }

    setLoading(true);
    try {
      // 2) Actual AI call
      const res = await fetch('/api/nl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: activeEntity, text, schema }),
      });

      const ct = res.headers.get('content-type') || '';
      const payload = ct.includes('application/json')
        ? await res.json().catch(() => ({ error: 'Invalid JSON from server' }))
        : { error: await res.text() };

      if (!res.ok || (payload && payload.error)) {
        if (!quick) pulse('🤖 Hm, I hit a snag. Try rephrasing the query.', 'red');
        return;
      }

      if (payload.kind !== 'filter' || !payload.filter) {
        if (!quick) pulse('🤖 I couldn’t shape a filter from that. Try something simpler.', 'red');
        return;
      }

      // 3) Apply AI filter
      let node: FilterNode = payload.filter;
      let subset = applyFilter(baseRows as typeof baseRows, node);

      // 4) Soft fallback if zero
      if (subset.length === 0) {
        const softened = clientRepairFilter(node as any, schema as any, { soften: true });
        subset = applyFilter(baseRows as any[], softened);
        node = softened;
      }

      // 5) Cache and show result
      aiCache.set(key, node);
      setFiltered(activeEntity, subset);
      popOk(`🤖 AI found ${subset.length} match${subset.length === 1 ? '' : 'es'}`);
      setStatus(`🤖 Done: ${subset.length} match${subset.length === 1 ? '' : 'es'}.`);
      onApply?.(activeEntity, payload);
    } catch {
      if (!quick) pulse('🤖 Network hiccup. Please try again.', 'red');
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setFiltered(activeEntity, null);
    setQ('');
    setStatus(null);
    notifications.hide('ai-info');
    notifications.hide('ai-ok');
  }

  // Pretty little toasts
  function popInfo(msg: string) {
    notifications.show({ id: 'ai-info', withCloseButton: false, message: msg, color: 'blue', autoClose: 1200 });
  }
  function popOk(msg: string) {
    notifications.show({ id: 'ai-ok', withCloseButton: false, message: msg, color: 'teal', autoClose: 1500 });
  }
  function pulse(msg: string, color: 'gray'|'red') {
    notifications.show({ message: msg, color, autoClose: 1600 });
    setStatus(msg);
  }

  return (
    <Stack gap="xs">
      <Group align="center" gap="sm">
        <TextInput
          placeholder={`Ask in plain English about ${activeEntity}… e.g., "skills include coding"`}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          style={{ flex: 1 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search();
            if (e.key === 'Escape') clear();
          }}
        />
        <Tooltip label='Try something you want to filter out'>
          <Button onClick={search} loading={loading} leftSection={loading ? <Loader size="xs" /> : undefined}>
            {loading ? 'Asking AI…' : 'Ask AI'}
          </Button>
        </Tooltip>
        <Button variant="light" color="gray" onClick={clear} leftSection={<IconX size={16} />}>
          Clear
        </Button>
      </Group>

      {loading && <AiShimmer />}

      {status && (
        <Badge
          variant="light"
          radius="xl"
          styles={{ root: { width: 'fit-content', boxShadow: '0 0 18px rgba(59,130,246,0.25)' } }}
        >
          {status}
        </Badge>
      )}
    </Stack>
  );
}
