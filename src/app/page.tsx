// src/app/page.tsx
'use client';
import { Container, Tabs, Text, Badge } from '@mantine/core';
import FileUploader from '@/components/FileUploader';
import DataGrid from '@/components/DataGrid';
import { useDataStore } from '@/store/useDataStore';

export default function HomePage() {
  const clients = useDataStore((state) => state.clients);
  const workers = useDataStore((state) => state.workers);
  const tasks = useDataStore((state) => state.tasks);

  const totalRecords = clients.length + workers.length + tasks.length;

  console.log('Page render:', { 
    clientsCount: clients.length, 
    workersCount: workers.length, 
    tasksCount: tasks.length,
    totalRecords
  });

  return (
    <Container size="xl" py="xl">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '2.5rem' }}>🧙‍♂️ Spreadsheet Alchemist</h1>
        <Text c="dimmed" size="lg">Transform messy data into clean, validated datasets</Text>
        {totalRecords > 0 && (
          <Badge size="lg" variant="light" color="green" mt="sm">
            📊 {totalRecords} Total Records Loaded
          </Badge>
        )}
      </div>
      
      <FileUploader />

      {totalRecords > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <Tabs defaultValue="clients">
            <Tabs.List>
              <Tabs.Tab value="clients">
                👥 Clients <Badge size="sm" ml="xs" color="blue">{clients.length}</Badge>
              </Tabs.Tab>
              <Tabs.Tab value="workers">
                👷 Workers <Badge size="sm" ml="xs" color="green">{workers.length}</Badge>
              </Tabs.Tab>
              <Tabs.Tab value="tasks">
                📋 Tasks <Badge size="sm" ml="xs" color="orange">{tasks.length}</Badge>
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="clients" pt="lg">
              <Text mb="md" size="sm" c="dimmed">Clients Data ({clients.length} records)</Text>
              <DataGrid rowData={clients} entityType="clients" />
            </Tabs.Panel>

            <Tabs.Panel value="workers" pt="lg">
              <Text mb="md" size="sm" c="dimmed">Workers Data ({workers.length} records)</Text>
              <DataGrid rowData={workers} entityType="workers" />
            </Tabs.Panel>

            <Tabs.Panel value="tasks" pt="lg">
              <Text mb="md" size="sm" c="dimmed">Tasks Data ({tasks.length} records)</Text>
              <DataGrid rowData={tasks} entityType="tasks" />
            </Tabs.Panel>
          </Tabs>
        </div>
      )}

      {totalRecords === 0 && (
        <div style={{ textAlign: 'center', marginTop: '3rem', padding: '2rem' }}>
          <Text size="xl" c="dimmed">📤 Upload your Excel file to get started</Text>
          <Text size="sm" c="dimmed" mt="sm">
            Your file should contain 3 sheets with clients, workers, and tasks data
          </Text>
        </div>
      )}
    </Container>
  );
}
