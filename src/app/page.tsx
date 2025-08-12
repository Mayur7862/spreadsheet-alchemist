// src/app/page.tsx - Add jump-to-row functionality
'use client';
import { Container, Tabs, Text, Badge, Button, Group } from '@mantine/core';
import { useRef, useState } from 'react';
import FileUploader from '@/components/FileUploader';
import DataGrid from '@/components/DataGrid';
import ValidationPanel from '@/components/ValidationPanel';
import { useDataStore } from '@/store/useDataStore';
import { useValidationStore } from '@/store/useValidationStore';
import { validateAllData } from '@/utils/validators';

export default function HomePage() {
  const clients = useDataStore((state) => state.clients);
  const workers = useDataStore((state) => state.workers);
  const tasks = useDataStore((state) => state.tasks);
  const [activeTab, setActiveTab] = useState<string>('clients');

  const { summary, setErrors, setValidating } = useValidationStore();
  
  const totalRecords = clients.length + workers.length + tasks.length;

  const runValidation = () => {
    setValidating(true);
    setTimeout(() => {
      const errors = validateAllData(clients, workers, tasks);
      setErrors(errors);
      setValidating(false);
    }, 100);
  };

  // 🔧 Working jump-to-row handler
  const handleJumpToRow = (entity: 'clients' | 'workers' | 'tasks', rowIndex: number) => {
    // Switch to the correct tab
    setActiveTab(entity);
    
    // Wait for tab to switch, then scroll to and highlight the row
    setTimeout(() => {
      const targetRow = document.querySelector(`[data-row-index="${rowIndex}"]`) as HTMLElement;
      if (targetRow) {
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight the row temporarily
        const originalBg = targetRow.style.backgroundColor;
        targetRow.style.backgroundColor = '#fff3cd';
        targetRow.style.borderLeft = '4px solid #ffc107';
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
          targetRow.style.backgroundColor = originalBg;
          targetRow.style.borderLeft = '';
        }, 3000);
      }
    }, 200);
  };

  return (
    <Container size="xl" py="xl">
      <div style={{ marginBottom: '2rem' }}>
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
      </div>
      
      <FileUploader />

      {/* Validation Panel with working jump-to-row */}
      {totalRecords > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <ValidationPanel onJumpToRow={handleJumpToRow} />
        </div>
      )}

      {totalRecords > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'clients')}>
            <Tabs.List>
              <Tabs.Tab value="clients">
                👥 Clients 
                <Badge size="sm" ml="xs" color="blue">{clients.length}</Badge>
                {summary.clientErrors > 0 && (
                  <Badge size="sm" ml="xs" color="red">{summary.clientErrors}</Badge>
                )}
              </Tabs.Tab>
              <Tabs.Tab value="workers">
                👷 Workers 
                <Badge size="sm" ml="xs" color="green">{workers.length}</Badge>
                {summary.workerErrors > 0 && (
                  <Badge size="sm" ml="xs" color="red">{summary.workerErrors}</Badge>
                )}
              </Tabs.Tab>
              <Tabs.Tab value="tasks">
                📋 Tasks 
                <Badge size="sm" ml="xs" color="orange">{tasks.length}</Badge>
                {summary.taskErrors > 0 && (
                  <Badge size="sm" ml="xs" color="red">{summary.taskErrors}</Badge>
                )}
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="clients" pt="lg">
              <Text mb="md" size="sm" c="dimmed">
                Clients Data ({clients.length} records)
                {summary.clientErrors > 0 && (
                  <Badge size="sm" ml="xs" color="red">
                    {summary.clientErrors} issues
                  </Badge>
                )}
              </Text>
              <DataGrid rowData={clients} entityType="clients" />
            </Tabs.Panel>

            <Tabs.Panel value="workers" pt="lg">
              <Text mb="md" size="sm" c="dimmed">
                Workers Data ({workers.length} records)
                {summary.workerErrors > 0 && (
                  <Badge size="sm" ml="xs" color="red">
                    {summary.workerErrors} issues
                  </Badge>
                )}
              </Text>
              <DataGrid rowData={workers} entityType="workers" />
            </Tabs.Panel>

            <Tabs.Panel value="tasks" pt="lg">
              <Text mb="md" size="sm" c="dimmed">
                Tasks Data ({tasks.length} records)
                {summary.taskErrors > 0 && (
                  <Badge size="sm" ml="xs" color="red">
                    {summary.taskErrors} issues
                  </Badge>
                )}
              </Text>
              <DataGrid rowData={tasks} entityType="tasks" />
            </Tabs.Panel>
          </Tabs>
        </div>
      )}

      {totalRecords === 0 && (
        <div style={{ textAlign: 'center', marginTop: '3rem', padding: '2rem' }}>
          <Text size="xl" c="dimmed">📤 Upload your files to get started</Text>
          <Text size="sm" c="dimmed" mt="sm">
            Excel file with 3 sheets or individual CSV files
          </Text>
        </div>
      )}
    </Container>
  );
}
