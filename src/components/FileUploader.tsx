// src/components/FileUploader.tsx
'use client';

import { useMemo, useState } from 'react';
import {
  Card,
  Group,
  Button,
  Text,
  Stack,
  SegmentedControl,
  FileInput,
  Badge,
  Alert,
  Checkbox,
  Divider,
} from '@mantine/core';
import { IconFileSpreadsheet, IconFiles, IconCheck, IconAlertTriangle, IconDownload } from '@tabler/icons-react';

import { useDataStore } from '@/store/useDataStore';
import { useValidationStore } from '@/store/useValidationStore';
import { validateAllData } from '@/utils/validators';

import type { ParsedData } from '@/utils/parseFile';
import { parseAnyFile } from '@/utils/parseFile';

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

type Mode = 'single' | 'multiple';
type ExportMode = 'workbook' | 'separate';

export default function FileUploader() {
  // base setters
  const setClients = useDataStore((s) => s.setClients);
  const setWorkers = useDataStore((s) => s.setWorkers);
  const setTasks   = useDataStore((s) => s.setTasks);
  const setFiltered = useDataStore((s) => s.setFiltered);

  // current data (for export)
  const clients = useDataStore((s) => s.clients);
  const workers = useDataStore((s) => s.workers);
  const tasks   = useDataStore((s) => s.tasks);

  const { setErrors, setValidating } = useValidationStore();

  const [mode, setMode] = useState<Mode>('single');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [warn, setWarn] = useState<string>('');

  // export controls
  const [exportMode, setExportMode] = useState<ExportMode>('workbook');
  const [includeRules, setIncludeRules] = useState<boolean>(false);

  const clearViews = () => {
    (['clients', 'workers', 'tasks'] as const).forEach((e) => setFiltered(e, null));
  };

  // validate AFTER store updates flush
  const applyBaseAndValidate = (c: any[], w: any[], t: any[]) => {
    setClients(c);
    setWorkers(w);
    setTasks(t);
    clearViews();

    setTimeout(() => {
      setValidating(true);
      const errs = validateAllData(c, w, t);
      setErrors(errs);
      setValidating(false);
    }, 0);
  };

  /** Handle a single file (CSV or Excel workbook). */
  const handleSingleFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true); setWarn(''); setStatus('');

    try {
      const res = await parseAnyFile(file);
      applyBaseAndValidate(res.clients, res.workers, res.tasks);

      const counts = `Loaded: ${res.clients.length} clients, ${res.workers.length} workers, ${res.tasks.length} tasks`;
      setStatus(counts);

      if (res.errors.length) setWarn(`Notes: ${res.errors.join(' • ')}`);
    } catch (e: unknown) {
      setWarn(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /** Handle multiple files (any mix of CSV/XLS/XLSX). */
  const handleMultipleFiles = async (filesOrNull: File[] | File | null) => {
    if (!filesOrNull) return;
    const files = Array.isArray(filesOrNull) ? filesOrNull : [filesOrNull];
    if (files.length === 0) return;

    setBusy(true); setWarn(''); setStatus('');

    const bucket: ParsedData = { clients: [], workers: [], tasks: [], errors: [] };

    try {
      for (const f of files) {
        const res = await parseAnyFile(f);
        bucket.clients.push(...res.clients);
        bucket.workers.push(...res.workers);
        bucket.tasks.push(...res.tasks);
        if (res.errors?.length) bucket.errors.push(...res.errors);
      }

      if (bucket.clients.length + bucket.workers.length + bucket.tasks.length === 0) {
        setWarn('No recognizable data found. Ensure filenames or headers indicate Clients/Workers/Tasks.');
        return;
      }

      applyBaseAndValidate(bucket.clients, bucket.workers, bucket.tasks);

      const counts = `Loaded: ${bucket.clients.length} clients, ${bucket.workers.length} workers, ${bucket.tasks.length} tasks`;
      setStatus(counts);

      if (bucket.errors.length) setWarn(`Notes: ${bucket.errors.join(' • ')}`);
    } catch (e: unknown) {
      setWarn(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /* ----------------- EXPORTS ----------------- */

  const totalRows = useMemo(
    () => clients.length + workers.length + tasks.length,
    [clients.length, workers.length, tasks.length]
  );

  const downloadBlob = (filename: string, data: BlobPart, mime: string) => {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportWorkbook = () => {
    const wb = XLSX.utils.book_new();
    const wsClients = XLSX.utils.json_to_sheet(clients);
    const wsWorkers = XLSX.utils.json_to_sheet(workers);
    const wsTasks   = XLSX.utils.json_to_sheet(tasks);
    XLSX.utils.book_append_sheet(wb, wsClients, 'Clients');
    XLSX.utils.book_append_sheet(wb, wsWorkers, 'Workers');
    XLSX.utils.book_append_sheet(wb, wsTasks,   'Tasks');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob('spreadsheet-alchemist-data.xlsx', buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  const exportSeparateCSVs = () => {
    if (clients.length) {
      const csv = Papa.unparse(clients as any); // data already normalized to validator-friendly strings
      downloadBlob('clients.csv', csv, 'text/csv;charset=utf-8;');
    }
    if (workers.length) {
      const csv = Papa.unparse(workers as any);
      downloadBlob('workers.csv', csv, 'text/csv;charset=utf-8;');
    }
    if (tasks.length) {
      const csv = Papa.unparse(tasks as any);
      downloadBlob('tasks.csv', csv, 'text/csv;charset=utf-8;');
    }
  };

  const getRulesJSON = () => {
    // Try to read from a global left by your RuleBuilder (optional). Fallback to a minimal placeholder.
    if (typeof window !== 'undefined') {
      const w = window as unknown as { rulesJSON?: unknown; __rules?: unknown };
      if (w.rulesJSON) return w.rulesJSON;
      if (w.__rules) return w.__rules;
    }
    return { rules: [], note: 'No rules store found; placeholder generated.', generatedAt: new Date().toISOString() };
  };

  const exportRulesIfNeeded = () => {
    if (!includeRules) return;
    const rules = getRulesJSON();
    const json = JSON.stringify(rules, null, 2);
    downloadBlob('rules.json', json, 'application/json');
  };

  const handleDownload = () => {
    if (totalRows === 0) {
      setWarn('Nothing to download yet. Please upload or edit data first.');
      return;
    }
    if (exportMode === 'workbook') exportWorkbook();
    else exportSeparateCSVs();
    exportRulesIfNeeded();
  };

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        {/* Upload section */}
        <Group justify="space-between">
          <Group>
            <Text fw={600}>Upload data</Text>
            <Badge variant="light" color="blue">Workbook or separate files</Badge>
          </Group>

          <SegmentedControl
            value={mode}
            onChange={(v) => setMode(v as Mode)}
            data={[
              { label: 'Single workbook / CSV', value: 'single' },
              { label: 'Multiple files', value: 'multiple' },
            ]}
          />
        </Group>

        {mode === 'single' ? (
          <FileInput
            label="Upload a single file: Excel (multi/single-sheet) or CSV"
            placeholder="Choose file"
            accept=".xlsx,.xls,.csv"
            leftSection={<IconFileSpreadsheet size={16} />}
            onChange={handleSingleFile}
            disabled={busy}
          />
        ) : (
          <FileInput
            label="Upload 1–3 files (CSV/XLSX/XLS). They can be in any order."
            placeholder="Choose files"
            accept=".csv,.xlsx,.xls"
            multiple
            leftSection={<IconFiles size={16} />}
            onChange={(value) => handleMultipleFiles(value as unknown as File[] | null)}
            disabled={busy}
          />
        )}

        <Group>
          <Button variant="light" disabled={busy} onClick={() => { setStatus(''); setWarn(''); }}>
            Clear messages
          </Button>
        </Group>

        {status && (
          <Alert color="green" icon={<IconCheck size={16} />}>
            {status}
          </Alert>
        )}
        {warn && (
          <Alert color="yellow" icon={<IconAlertTriangle size={16} />}>
            {warn}
          </Alert>
        )}

        <Text size="xs" c="dimmed">
          Auto-detects entity by filename (e.g., <i>clients.csv</i>) or headers (<code>ClientID</code>, <code>WorkerID</code>, <code>TaskID</code>). Validator runs right after upload.
        </Text>

        {/* Export section */}
        <Divider my="sm" />
        <Group justify="space-between">
          <Group>
            <Text fw={600}>Export data</Text>
            <Badge variant="light" color="green">Download your edits</Badge>
          </Group>

          <SegmentedControl
            value={exportMode}
            onChange={(v) => setExportMode(v as ExportMode)}
            data={[
              { label: 'Single Excel (3 sheets)', value: 'workbook' },
              { label: 'Separate CSVs', value: 'separate' },
            ]}
          />
        </Group>

        <Group justify="space-between">
          <Checkbox
            checked={includeRules}
            onChange={(e) => setIncludeRules(e.currentTarget.checked)}
            label="Also download rules.json"
          />
          <Button
            leftSection={<IconDownload size={16} />}
            onClick={handleDownload}
            disabled={busy || totalRows === 0}
          >
            Download
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
