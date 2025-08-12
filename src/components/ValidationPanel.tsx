'use client';
import { useValidationStore } from '@/store/useValidationStore';
import { Alert, ScrollArea, Text } from '@mantine/core';

export default function ValidationPanel() {
  const errors = useValidationStore((s) => s.errors);

  if (errors.length === 0) {
    return <Alert color="green">No validation errors! 🎉</Alert>;
  }

  return (
    <ScrollArea style={{ maxHeight: 300 }}>
      {errors.map((err, idx) => (
        <Alert key={idx} color={err.severity === 'error' ? 'red' : 'yellow'} mt="sm">
          <Text fw={500}>
            [{err.entity}] Row {err.rowIndex + 1} - {err.field}
          </Text>
          <Text size="sm">{err.message}</Text>
        </Alert>
      ))}
    </ScrollArea>
  );
}
