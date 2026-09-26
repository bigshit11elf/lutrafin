<script lang="ts">
  import type { Language } from '$lib/i18n';

  let {
    value,
    language: _language,
    fallback
  }: {
    value: string | null | undefined;
    language: Language;
    fallback: string;
  } = $props();

  function parseTimestamp(timestamp: string): Date | null {
    const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp)
      ? timestamp
      : `${timestamp}Z`;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatTimestamp(timestamp: string): string {
    const date = parseTimestamp(timestamp);
    if (!date) return timestamp;

    const parts = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date);
    const part = (type: string) =>
      parts.find((entry) => entry.type === type)?.value ?? '';

    return `${part('day')}.${part('month')}.${part('year')}, ${part('hour')}:${part('minute')} Uhr`;
  }

  const formatted = $derived(value ? formatTimestamp(value) : fallback);
</script>

<time datetime={value ?? undefined}>{formatted}</time>
