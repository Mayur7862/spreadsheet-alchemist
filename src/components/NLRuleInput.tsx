"use client";

import { useState } from "react";
import { Card, Textarea, Button, Group, Text, Stack, Badge } from "@mantine/core";
import { useRulesStore } from "@/store/useRulesStore";
import { Rule } from "@/rules/schema";

type Props = {
  data: { clients: any[]; workers: any[]; tasks: any[] };
};

export default function NLRuleInput({ data }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Rule[] | null>(null);
  const addMany = useRulesStore((s) => s.addMany);

  async function convert() {
    if (!text.trim()) return;
    setLoading(true);
    setPreview(null);
    try {
      const res = await fetch("/api/nl2rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, data }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to convert");
      setPreview(json.rules as Rule[]);
    } catch (e: any) {
      alert(e?.message ?? "Conversion failed");
    } finally {
      setLoading(false);
    }
  }

  function acceptAll() {
    if (!preview?.length) return;
    addMany(preview);
    setPreview(null);
    setText("");
  }

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <div>
          <Text fw={600}>Natural language → Rules</Text>
          <Text size="sm" c="dimmed">Describe the rule(s). Example: “Make T12 and T14 co-run, and limit Sales workers to 3 slots per phase.”</Text>
        </div>
        <Textarea
          placeholder="Type your rule ask here…"
          minRows={3}
          autosize
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
        />
        <Group>
          <Button loading={loading} onClick={convert}>Convert to rules</Button>
          {preview && preview.length > 0 && (
            <Button color="green" variant="light" onClick={acceptAll}>Accept all ({preview.length})</Button>
          )}
        </Group>

        {preview && (
          <Stack gap="xs">
            <Text size="sm" fw={600}>Preview</Text>
            {preview.length === 0 && <Text size="sm">No rules recognized.</Text>}
            {preview.map((r) => (
              <Card key={r.id} withBorder padding="sm" radius="sm">
                <Group gap="xs">
                  <Badge variant="light">{r.type}</Badge>
                  <Text size="sm">priority: {r.priority}</Text>
                </Group>
                <Text size="sm" mt={6}>
                  {JSON.stringify(r)}
                </Text>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
