// Renders an editable AG Grid table for the given entity and rows.
// On edit, it calls patchRow(entity, rowIndex, patch) so both the base
// and (if visible) filtered views stay in sync.

'use client';
import { useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, CellValueChangedEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useDataStore } from '@/store/useDataStore';

interface Props {
  entity: 'clients' | 'workers' | 'tasks';
  rows: any[];
}

export default function DataTable({ entity, rows }: Props) {
  const patchRow = useDataStore((s) => s.patchRow);
  const gridRef = useRef<AgGridReact>(null);

  // Build columns from the first row's keys
  const columnDefs: ColDef[] = useMemo(() => {
    const sample = rows[0] ?? {};
    return Object.keys(sample).map((key) => ({
      headerName: key,
      field: key,
      editable: true,
      resizable: true,
      filter: true,
      floatingFilter: true,
    }));
  }, [rows]);

  const defaultColDef: ColDef = useMemo(() => ({ sortable: true, flex: 1, minWidth: 120 }), []);

  function onCellValueChanged(e: CellValueChangedEvent<any>) {
    const idx = e.node.rowIndex ?? 0;
    const field = e.colDef.field as string;
    patchRow(entity, idx, { [field]: e.newValue });
  }

  return (
    <div className="ag-theme-alpine" style={{ height: 420, width: '100%' }}>
      <AgGridReact
        ref={gridRef}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        animateRows
        onCellValueChanged={onCellValueChanged}
      />
    </div>
  );
}
