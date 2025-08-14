"use client";

import { Card, Group, Text, Button, Stack, List, ThemeIcon, Badge, Space } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useRulesStore } from "@/store/useRulesStore";
import NLRuleInput from "@/components/NLRuleInput";

type Props = {
  data: { clients: any[]; workers: any[]; tasks: any[] };
};

function download(filename: string, data: string, type = "application/json") {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function RuleBuilderPanel({ data }: Props) {
  const rules = useRulesStore((s) => s.rules);
  const exportRules = useRulesStore((s) => s.exportRules);
  const remove = useRulesStore((s) => s.remove);
  const validate = useRulesStore((s) => s.validateRulesAgainstData);

  const issues = validate(data);

  function onExport() {
    const pack = exportRules();
    download("rules.json", JSON.stringify(pack, null, 2));
  }

  return (
    <Stack gap="md">
      <NLRuleInput data={data} />

      <Card withBorder radius="md" p="md">
        <Group justify="space-between">
          <div>
            <Text fw={600}>Current rules</Text>
            <Text size="sm" c="dimmed">Built by UI or AI. Order implies priority if equal values.</Text>
          </div>
          <Group>
            <Badge color={issues.some(i => i.level === "error") ? "red" : "green"}>
              {issues.length} validation {issues.length === 1 ? "issue" : "issues"}
            </Badge>
            <Button variant="light" onClick={onExport}>Generate Rules Config</Button>
          </Group>
        </Group>
        <Space h="sm" />
        <List
          spacing="xs"
          icon={
            <ThemeIcon color="teal" size={20} radius="xl">
              <IconCheck size={14} />
            </ThemeIcon>
          }
        >
          {rules.map((r) => (
            <List.Item key={r.id}>
              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Badge mr="xs" variant="light">{r.type}</Badge>
                  <Text component="span" fw={500}>priority {r.priority}</Text>
                  <Text size="sm" c="dimmed"> — {JSON.stringify(r)}</Text>
                </div>
                <Button size="xs" variant="subtle" color="red" onClick={() => remove(r.id)}>Remove</Button>
              </Group>
            </List.Item>
          ))}
          {rules.length === 0 && <Text size="sm" c="dimmed">No rules yet.</Text>}
        </List>

        {issues.length > 0 && (
          <>
            <Space h="md" />
            <Text fw={600}>Rule validation</Text>
            <List spacing="xs">
              {issues.map((i, idx) => (
                <List.Item key={idx} icon={<ThemeIcon color={i.level === "error" ? "red" : "yellow"} size={16} radius="xl" />}>
                  <Text size="sm" c={i.level === "error" ? "red" : "yellow"}>{i.message}</Text>
                </List.Item>
              ))}
            </List>
          </>
        )}
      </Card>
    </Stack>
  );
}
