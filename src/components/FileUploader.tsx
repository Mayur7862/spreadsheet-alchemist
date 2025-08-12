// src/components/FileUploader.tsx
'use client';
import { useState } from 'react';
import { 
  Button, 
  Group, 
  FileInput, 
  Text, 
  Paper, 
  Stack,
  Alert,
  LoadingOverlay,
  List,
  Badge,
  Tabs
} from '@mantine/core';
import { 
  IconUpload, 
  IconCheck, 
  IconX, 
  IconFileSpreadsheet, 
  IconFileText
} from '@tabler/icons-react';
import { parseAnyFile, ParsedData } from '../utils/parseFile';
import { useDataStore } from '../store/useDataStore';
import { useValidationStore } from '../store/useValidationStore';
import { validateAllData } from '../utils/validators';

export default function FileUploader() {
  // State for upload process
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ParsedData | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Data store
  const clients = useDataStore((state) => state.clients);
  const workers = useDataStore((state) => state.workers);
  const tasks = useDataStore((state) => state.tasks);
  const setClients = useDataStore((state) => state.setClients);
  const setWorkers = useDataStore((state) => state.setWorkers);
  const setTasks = useDataStore((state) => state.setTasks);

  // Validation store
  const { setErrors, setValidating, clearErrors } = useValidationStore();

  // Handle any file (Excel or CSV) - SINGLE FUNCTION DEFINITION
  const handleFileUpload = async (file: File | null) => {
    if (!file) return;
    
    setLoading(true);
    setUploadError(null);
    setUploadResult(null);
    clearErrors(); // Clear previous validation errors
    
    try {
      console.log('Uploading file:', file.name);
      const result = await parseAnyFile(file);
      
      const ext = file.name.split('.').pop()?.toLowerCase();
      
      // Store the data before validation
      let finalClients: any[] = [];
      let finalWorkers: any[] = [];
      let finalTasks: any[] = [];
      
      if (ext === 'xlsx' || ext === 'xls') {
        // Excel: Replace all data
        setClients(result.clients);
        setWorkers(result.workers);
        setTasks(result.tasks);
        finalClients = result.clients;
        finalWorkers = result.workers;
        finalTasks = result.tasks;
      } else if (ext === 'csv') {
        // CSV: Merge with existing data
        finalClients = result.clients.length > 0 ? [...clients, ...result.clients] : clients;
        finalWorkers = result.workers.length > 0 ? [...workers, ...result.workers] : workers;
        finalTasks = result.tasks.length > 0 ? [...tasks, ...result.tasks] : tasks;
        
        if (result.clients.length > 0) {
          setClients(finalClients);
        }
        if (result.workers.length > 0) {
          setWorkers(finalWorkers);
        }
        if (result.tasks.length > 0) {
          setTasks(finalTasks);
        }
      }
      
      setUploadResult(result);
      console.log('File upload complete:', {
        clients: result.clients.length,
        workers: result.workers.length,
        tasks: result.tasks.length,
        errors: result.errors.length
      });
      
      // 🚀 TRIGGER VALIDATION AFTER UPLOAD
      if (finalClients.length > 0 || finalWorkers.length > 0 || finalTasks.length > 0) {
        setTimeout(() => {
          console.log('🔍 Starting post-upload validation...');
          setValidating(true);
          
          const validationErrors = validateAllData(finalClients, finalWorkers, finalTasks);
          setErrors(validationErrors);
          setValidating(false);
          
          console.log('✅ Validation complete:', validationErrors.length, 'issues found');
        }, 800);
      }
      
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const clearAllData = () => {
    setClients([]);
    setWorkers([]);
    setTasks([]);
    setUploadResult(null);
    setUploadError(null);
    clearErrors();
  };

  const totalRecords = clients.length + workers.length + tasks.length;

  return (
    <Paper p="lg" withBorder>
      <LoadingOverlay visible={loading} />
      
      <Stack gap="md">
        <Group justify="space-between">
          <div>
            <Text size="lg" fw={600}>📊 Upload Your Data</Text>
            <Text size="sm" c="dimmed">
              Excel file (all-in-one) or individual CSV files
            </Text>
          </div>
          {totalRecords > 0 && (
            <Group gap="xs">
              <Badge color="green" variant="light">
                {totalRecords} Records Loaded
              </Badge>
              <Button size="xs" variant="outline" color="red" onClick={clearAllData}>
                Clear All
              </Button>
            </Group>
          )}
        </Group>

        <Tabs defaultValue="any" color="blue">
          <Tabs.List>
            <Tabs.Tab value="any" leftSection={<IconFileSpreadsheet size="1rem" />}>
              📁 Any File
            </Tabs.Tab>
            <Tabs.Tab value="excel" leftSection={<IconFileSpreadsheet size="1rem" />}>
              📊 Excel (Multi-Sheet)
            </Tabs.Tab>
            <Tabs.Tab value="csv" leftSection={<IconFileText size="1rem" />}>
              📄 CSV Files
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="any" pt="md">
            <Stack gap="sm">
              <FileInput
                placeholder="Select Excel (.xlsx) or CSV (.csv) file"
                accept=".xlsx,.xls,.csv"
                leftSection={<IconUpload size={20} />}
                onChange={handleFileUpload}
                size="lg"
              />
              <Text size="xs" c="dimmed">
                • Excel: Automatically loads all 3 sheets (clients, workers, tasks)<br/>
                • CSV: Auto-detects type from filename or headers
              </Text>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="excel" pt="md">
            <Stack gap="sm">
              <FileInput
                placeholder="Select your Excel file with multiple sheets"
                accept=".xlsx,.xls"
                leftSection={<IconFileSpreadsheet size={20} />}
                onChange={handleFileUpload}
                size="lg"
              />
              <Paper p="sm" style={{ backgroundColor: '#f0f8ff' }}>
                <Text size="xs" fw={500} mb="xs">📋 Excel Requirements:</Text>
                <List size="xs" spacing={2}>
                  <List.Item>3 sheets named like: "Clients", "Workers", "Tasks"</List.Item>
                  <List.Item>Or auto-detection by column headers</List.Item>
                  <List.Item>Proper column headers in each sheet</List.Item>
                </List>
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="csv" pt="md">
            <Stack gap="sm">
              <FileInput
                placeholder="Select CSV file (clients.csv, workers.csv, or tasks.csv)"
                accept=".csv"
                leftSection={<IconFileText size={20} />}
                onChange={handleFileUpload}
                size="lg"
              />
              <Paper p="sm" style={{ backgroundColor: '#f0fff0' }}>
                <Text size="xs" fw={500} mb="xs">📄 CSV Tips:</Text>
                <List size="xs" spacing={2}>
                  <List.Item>Filename should contain "client", "worker", or "task"</List.Item>
                  <List.Item>Multiple CSV uploads will merge data</List.Item>
                  <List.Item>Headers auto-detected: ClientID, WorkerID, TaskID</List.Item>
                </List>
              </Paper>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        {/* Success Result */}
        {uploadResult && !uploadError && (
          <Alert color="green" icon={<IconCheck size={16} />}>
            <Stack gap="xs">
              <Text fw={600}>✅ File processed successfully!</Text>
              <Group gap="lg">
                {uploadResult.clients.length > 0 && (
                  <Badge color="blue" variant="light">
                    +{uploadResult.clients.length} Clients
                  </Badge>
                )}
                {uploadResult.workers.length > 0 && (
                  <Badge color="green" variant="light">
                    +{uploadResult.workers.length} Workers
                  </Badge>
                )}
                {uploadResult.tasks.length > 0 && (
                  <Badge color="orange" variant="light">
                    +{uploadResult.tasks.length} Tasks
                  </Badge>
                )}
              </Group>
              
              {uploadResult.errors.length > 0 && (
                <div>
                  <Text size="sm" fw={500} c="orange">⚠️ Parsing Warnings:</Text>
                  <List size="sm">
                    {uploadResult.errors.map((error, idx) => (
                      <List.Item key={idx}>
                        <Text size="xs" c="orange">{error}</Text>
                      </List.Item>
                    ))}
                  </List>
                </div>
              )}
              
              <Text size="xs" c="dimmed" mt="xs">
                🔍 Running comprehensive validation...
              </Text>
            </Stack>
          </Alert>
        )}

        {/* Error Result */}
        {uploadError && (
          <Alert color="red" icon={<IconX size={16} />}>
            <Text fw={600}>❌ Upload failed</Text>
            <Text size="sm">{uploadError}</Text>
          </Alert>
        )}

        {/* Current Data Summary */}
        {totalRecords > 0 && (
          <Paper p="md" style={{ backgroundColor: '#f8fdf8', border: '1px solid #e6f4e6' }}>
            <Group justify="space-between">
              <div>
                <Text size="sm" fw={500}>📊 Current Dataset:</Text>
                <Group gap="md" mt="xs">
                  <Text size="xs">👥 {clients.length} Clients</Text>
                  <Text size="xs">👷 {workers.length} Workers</Text>
                  <Text size="xs">📋 {tasks.length} Tasks</Text>
                </Group>
              </div>
              <Badge color="green" size="lg">
                {totalRecords} Total
              </Badge>
            </Group>
          </Paper>
        )}
      </Stack>
    </Paper>
  );
}
