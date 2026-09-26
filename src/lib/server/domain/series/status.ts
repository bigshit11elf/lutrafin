export const normalizedSeriesStatuses = [
  'continuing',
  'ended',
  'canceled',
  'upcoming',
  'unknown'
] as const;

export type NormalizedSeriesStatus = (typeof normalizedSeriesStatuses)[number];

export function normalizeTmdbStatus(
  status: string | null | undefined
): NormalizedSeriesStatus {
  const normalized = status?.trim().toLowerCase();

  switch (normalized) {
    case 'returning series':
    case 'in production':
      return 'continuing';
    case 'ended':
      return 'ended';
    case 'canceled':
    case 'cancelled':
      return 'canceled';
    case 'planned':
    case 'pilot':
      return 'upcoming';
    default:
      return 'unknown';
  }
}

export function normalizeTvmazeStatus(
  status: string | null | undefined
): NormalizedSeriesStatus {
  const normalized = status?.trim().toLowerCase();

  switch (normalized) {
    case 'running':
      return 'continuing';
    case 'ended':
      return 'ended';
    case 'to be determined':
      return 'unknown';
    default:
      return 'unknown';
  }
}
