// src/components/DataGrid.tsx
'use client';
import { Paper, ScrollArea, Table, Text } from '@mantine/core';

interface Props {
  rowData: any[];
  entityType: 'clients' | 'workers' | 'tasks';
}

export default function DataGrid({ rowData, entityType }: Props) {
  console.log(`Rendering ${entityType} grid with ${rowData?.length || 0} rows`);

  if (!rowData || rowData.length === 0) {
    return (
      <Paper p="xl" style={{ textAlign: 'center' }}>
        <Text size="lg" c="dimmed">No {entityType} data loaded</Text>
        <Text size="sm" c="dimmed">Upload a file to see the data here</Text>
      </Paper>
    );
  }

  // Get column headers from first row
  const headers = Object.keys(rowData[0]);

  return (
    <Paper withBorder>
      <ScrollArea>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              {headers.map((header) => (
                <Table.Th key={header} style={{ minWidth: 150 }}>
                  {header}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rowData.slice(0, 100).map((row, index) => (
              <Table.Tr key={index}>
                {headers.map((header) => (
                  <Table.Td key={header} style={{ maxWidth: 200, overflow: 'hidden' }}>
                    <Text size="sm" truncate>
                      {String(row[header] || '')}
                    </Text>
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      
      <Text p="sm" size="xs" c="dimmed" ta="center">
        Showing {Math.min(rowData.length, 100)} of {rowData.length} records
      </Text>
    </Paper>
  );
}
