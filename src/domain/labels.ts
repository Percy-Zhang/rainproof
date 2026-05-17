export function parseLabelsInput(value: string): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const label of value.split(',')) {
    const trimmed = label.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    labels.push(trimmed);
  }

  return labels;
}

export function getLabelAutocompleteOptions(
  labelHistory: string[],
  currentInput: string,
  limit = 4,
): string[] {
  const query = getActiveLabelSegment(currentInput).toLowerCase();
  if (!query) {
    return [];
  }

  const selected = new Set(parseLabelsInput(currentInput).map((label) => label.toLowerCase()));
  const stats = new Map<string, { label: string; count: number; firstSeen: number }>();

  labelHistory.forEach((label, index) => {
    const trimmed = label.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed) {
      return;
    }

    const current = stats.get(key);
    if (current) {
      current.count += 1;
      return;
    }

    stats.set(key, { label: trimmed, count: 1, firstSeen: index });
  });

  return Array.from(stats.values())
    .filter((item) => item.label.toLowerCase().includes(query) && !selected.has(item.label.toLowerCase()))
    .sort((left, right) => right.count - left.count || left.firstSeen - right.firstSeen)
    .slice(0, limit)
    .map((item) => item.label);
}

export function applyLabelSuggestion(currentInput: string, suggestion: string): string {
  const parts = currentInput.split(',');
  parts.pop();
  return parseLabelsInput([...parts, suggestion].join(',')).join(', ');
}

function getActiveLabelSegment(value: string): string {
  return value.split(',').at(-1)?.trim() ?? '';
}
