// src/components/ValidationPanel.tsx
'use client';
import { 
  Paper, 
  Text, 
  Badge, 
  Stack, 
  Group, 
  Alert, 
  ScrollArea, 
  Button,
  Collapse,
  ActionIcon,
  Divider,
  Notification
} from '@mantine/core';
import { 
  IconAlertTriangle, 
  IconX, 
  IconCheck, 
  IconChevronDown,
  IconChevronUp,
  IconLogicAnd,
  IconExternalLink
} from '@tabler/icons-react';
import { useValidationStore } from '../store/useValidationStore';
import { useDataStore } from '../store/useDataStore';
import { validateAllData } from '../utils/validators';
import { useState } from 'react';

interface ValidationPanelProps {
  onJumpToRow?: (entity: 'clients' | 'workers' | 'tasks', rowIndex: number) => void;
}

export default function ValidationPanel({ onJumpToRow }: ValidationPanelProps) {
  const { errors, summary, isValidating, setErrors, setValidating, removeError } = useValidationStore();
  const { clients, workers, tasks, setClients, setWorkers, setTasks } = useDataStore();
  const [fixingErrors, setFixingErrors] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<{
    errors: boolean;
    warnings: boolean;
  }>({ errors: true, warnings: false });

  const criticalErrors = errors.filter(e => e.severity === 'error');
  const warnings = errors.filter(e => e.severity === 'warning');

  // Working Jump to Row function
  const scrollToError = (entityType: 'clients' | 'workers' | 'tasks', rowIndex: number) => {
    if (onJumpToRow) {
      onJumpToRow(entityType, rowIndex);
    } else {
      // Fallback: Scroll to the tab and highlight row
      const tabButton = document.querySelector(`[data-value="${entityType}"]`) as HTMLElement;
      if (tabButton) {
        tabButton.click();
        
        // Wait for tab to switch, then scroll to row
        setTimeout(() => {
          const targetRow = document.querySelector(`[data-row-index="${rowIndex}"]`) as HTMLElement;
          if (targetRow) {
            targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetRow.style.backgroundColor = '#fff3cd';
            setTimeout(() => {
              targetRow.style.backgroundColor = '';
            }, 3000);
          }
        }, 200);
      }
    }
  };

  // Working Auto-Fix function
  const applyAutoFix = async (error: any) => {
    if (!error.autoFixValue) return;
    
    setFixingErrors(prev => new Set([...prev, error.id]));

    try {
      // Get current data
      let currentData: any[];
      let updateFunction: (data: any[]) => void;

      switch (error.entity) {
        case 'clients':
          currentData = [...clients];
          updateFunction = setClients;
          break;
        case 'workers':
          currentData = [...workers];
          updateFunction = setWorkers;
          break;
        case 'tasks':
          currentData = [...tasks];
          updateFunction = setTasks;
          break;
        default:
          return;
      }

      // Apply the fix
      if (error.rowIndex >= 0 && error.rowIndex < currentData.length) {
        currentData[error.rowIndex] = {
          ...currentData[error.rowIndex],
          [error.field]: error.autoFixValue
        };

        // Update the store
        updateFunction(currentData);

        // Remove this specific error
        removeError(error.id);

        // Re-run validation after a short delay
        setTimeout(() => {
          setValidating(true);
          const validationErrors = validateAllData(
            error.entity === 'clients' ? currentData : clients,
            error.entity === 'workers' ? currentData : workers,
            error.entity === 'tasks' ? currentData : tasks
          );
          setErrors(validationErrors);
          setValidating(false);
        }, 300);

        console.log(`✅ Auto-fixed: ${error.entity} row ${error.rowIndex + 1}, field ${error.field}`);
      }
    } catch (fixError) {
      console.error('Auto-fix failed:', fixError);
    } finally {
      setFixingErrors(prev => {
        const newSet = new Set(prev);
        newSet.delete(error.id);
        return newSet;
      });
    }
  };

  // Bulk auto-fix for all fixable errors
  const applyAllAutoFixes = async () => {
    const fixableErrors = errors.filter(e => e.autoFixValue !== undefined);
    
    for (const error of fixableErrors) {
      await applyAutoFix(error);
      // Small delay between fixes to avoid race conditions
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  if (isValidating) {
    return (
      <Paper p="md" withBorder>
        <Group>
          <div className="animate-spin">⚙️</div>
          <Text>Running comprehensive validation...</Text>
        </Group>
      </Paper>
    );
  }

  if (errors.length === 0) {
    return (
      <Paper p="md" withBorder style={{ backgroundColor: '#f0fff0' }}>
        <Group>
          <IconCheck size="1.5rem" color="green" />
          <div>
            <Text fw={600} c="green">✅ All validations passed!</Text>
            <Text size="sm" c="dimmed">No data quality issues detected.</Text>
          </div>
        </Group>
      </Paper>
    );
  }

  const toggleSection = (section: 'errors' | 'warnings') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const fixableErrorsCount = errors.filter(e => e.autoFixValue !== undefined).length;

  return (
    <Paper withBorder>
      <Stack gap="md">
        {/* Enhanced Summary Header */}
        <Paper p="md" style={{ 
          backgroundColor: summary.totalErrors > 0 ? '#fff5f5' : '#fffbf0',
          borderBottom: '1px solid #eee'
        }}>
          <Group justify="space-between">
            <div>
              <Text fw={600} size="lg">🔍 Validation Results</Text>
              <Text size="sm" c="dimmed">
                Last run: {summary.lastValidation?.toLocaleTimeString() || 'Never'} • 
                Click on highlighted cells in tables to edit and fix issues
              </Text>
            </div>
            <Group gap="xs">
              {summary.totalErrors > 0 && (
                <Badge color="red" variant="filled">
                  {summary.totalErrors} Errors
                </Badge>
              )}
              {summary.totalWarnings > 0 && (
                <Badge color="orange" variant="filled">
                  {summary.totalWarnings} Warnings
                </Badge>
              )}
              {summary.criticalIssues > 0 && (
                <Badge color="red" variant="outline">
                  🚨 {summary.criticalIssues} Critical
                </Badge>
              )}
              {fixableErrorsCount > 0 && (
                <Button
                  size="xs"
                  color="green"
                  leftSection={<IconLogicAnd size="0.8rem" />}
                  onClick={applyAllAutoFixes}
                  loading={fixingErrors.size > 0}
                >
                  Fix All ({fixableErrorsCount})
                </Button>
              )}
            </Group>
          </Group>

          <Group gap="lg" mt="md">
            <Group gap="xs">
              <Text size="sm" fw={500}>By Entity:</Text>
              <Badge color="blue" variant="light">👥 Clients: {summary.clientErrors}</Badge>
              <Badge color="green" variant="light">👷 Workers: {summary.workerErrors}</Badge>
              <Badge color="orange" variant="light">📋 Tasks: {summary.taskErrors}</Badge>
            </Group>
          </Group>
        </Paper>

        {/* Critical Errors with Working Jump Links */}
        {criticalErrors.length > 0 && (
          <div>
            <Group justify="space-between" style={{ cursor: 'pointer' }} onClick={() => toggleSection('errors')}>
              <Group>
                <IconAlertTriangle size="1.2rem" color="red" />
                <Text fw={600} c="red">Critical Errors ({criticalErrors.length})</Text>
              </Group>
              <ActionIcon variant="subtle" size="sm">
                {expandedSections.errors ? <IconChevronUp /> : <IconChevronDown />}
              </ActionIcon>
            </Group>

            <Collapse in={expandedSections.errors}>
              <ScrollArea style={{ maxHeight: 400 }} mt="sm">
                <Stack gap="xs">
                  {criticalErrors.map((error) => (
                    <Alert key={error.id} color="red" variant="light">
                      <Group justify="space-between" align="flex-start">
                        <div style={{ flex: 1 }}>
                          <Group gap="xs" mb="xs">
                            <Badge size="xs" color="red">{error.entity}</Badge>
                            <Badge 
                              size="xs" 
                              variant="outline"
                              style={{ cursor: 'pointer' }}
                              onClick={() => scrollToError(error.entity, error.rowIndex)}
                            >
                              {error.entityId} • Row {error.rowIndex + 1}
                            </Badge>
                            <Badge size="xs" variant="outline">{error.field}</Badge>
                          </Group>
                          <Text size="sm" fw={500} mb="xs">{error.message}</Text>
                          {error.suggestion && (
                            <Text size="xs" c="dimmed" mb="xs">
                              💡 {error.suggestion}
                            </Text>
                          )}
                          {error.autoFixValue !== undefined && (
                            <Paper p="xs" style={{ backgroundColor: '#e7f5ff' }}>
                              <Text size="xs" c="blue">
                                🔧 <strong>Suggested fix:</strong> "{String(error.autoFixValue)}"
                              </Text>
                            </Paper>
                          )}
                        </div>
                        <Stack gap="xs" align="center" style={{ minWidth: 120 }}>
                          <Button 
                            size="xs" 
                            variant="light" 
                            color="blue" 
                            leftSection={<IconExternalLink size="0.7rem" />}
                            onClick={() => scrollToError(error.entity, error.rowIndex)}
                            fullWidth
                          >
                            Jump to Row
                          </Button>
                          {error.autoFixValue !== undefined && (
                            <Button 
                              size="xs" 
                              variant="light" 
                              color="green" 
                              leftSection={<IconLogicAnd size="0.7rem" />}
                              onClick={() => applyAutoFix(error)}
                              loading={fixingErrors.has(error.id)}
                              fullWidth
                            >
                              Auto-fix
                            </Button>
                          )}
                        </Stack>
                      </Group>
                    </Alert>
                  ))}
                </Stack>
              </ScrollArea>
            </Collapse>
          </div>
        )}

        {criticalErrors.length > 0 && warnings.length > 0 && <Divider />}

        {/* Warnings with Working Jump Links */}
        {warnings.length > 0 && (
          <div>
            <Group justify="space-between" style={{ cursor: 'pointer' }} onClick={() => toggleSection('warnings')}>
              <Group>
                <IconAlertTriangle size="1.2rem" color="orange" />
                <Text fw={600} c="orange">Warnings ({warnings.length})</Text>
              </Group>
              <ActionIcon variant="subtle" size="sm">
                {expandedSections.warnings ? <IconChevronUp /> : <IconChevronDown />}
              </ActionIcon>
            </Group>

            <Collapse in={expandedSections.warnings}>
              <ScrollArea style={{ maxHeight: 300 }} mt="sm">
                <Stack gap="xs">
                  {warnings.map((error) => (
                    <Alert key={error.id} color="orange" variant="light">
                      <Group justify="space-between" align="flex-start">
                        <div style={{ flex: 1 }}>
                          <Group gap="xs" mb="xs">
                            <Badge size="xs" color="orange">{error.entity}</Badge>
                            <Badge 
                              size="xs" 
                              variant="outline"
                              style={{ cursor: 'pointer' }}
                              onClick={() => scrollToError(error.entity, error.rowIndex)}
                            >
                              {error.entityId} • Row {error.rowIndex + 1}
                            </Badge>
                            <Badge size="xs" variant="outline">{error.field}</Badge>
                          </Group>
                          <Text size="sm" fw={500} mb="xs">{error.message}</Text>
                          {error.suggestion && (
                            <Text size="xs" c="dimmed">
                              💡 {error.suggestion}
                            </Text>
                          )}
                          {error.autoFixValue !== undefined && (
                            <Paper p="xs" mt="xs" style={{ backgroundColor: '#fff4e6' }}>
                              <Text size="xs" c="orange">
                                🔧 <strong>Suggested fix:</strong> "{String(error.autoFixValue)}"
                              </Text>
                            </Paper>
                          )}
                        </div>
                        <Stack gap="xs" align="center" style={{ minWidth: 120 }}>
                          <Button 
                            size="xs" 
                            variant="light" 
                            color="orange" 
                            leftSection={<IconExternalLink size="0.7rem" />}
                            onClick={() => scrollToError(error.entity, error.rowIndex)}
                            fullWidth
                          >
                            Jump to Row
                          </Button>
                          {error.autoFixValue !== undefined && (
                            <Button 
                              size="xs" 
                              variant="light" 
                              color="green" 
                              leftSection={<IconLogicAnd size="0.7rem" />}
                              onClick={() => applyAutoFix(error)}
                              loading={fixingErrors.has(error.id)}
                              fullWidth
                            >
                              Auto-fix
                            </Button>
                          )}
                        </Stack>
                      </Group>
                    </Alert>
                  ))}
                </Stack>
              </ScrollArea>
            </Collapse>
          </div>
        )}

        {/* Quick Actions */}
        <Paper p="sm" style={{ backgroundColor: '#f8f9fa' }}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              💡 <strong>How to fix issues:</strong> Use "Auto-fix" for automatic repairs, 
              "Jump to Row" to navigate, or click highlighted cells to edit manually.
            </Text>
            {fixableErrorsCount > 0 && (
              <Badge color="green" variant="light">
                {fixableErrorsCount} Auto-fixable
              </Badge>
            )}
          </Group>
        </Paper>
      </Stack>
    </Paper>
  );
}