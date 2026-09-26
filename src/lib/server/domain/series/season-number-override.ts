export function suggestedSeasonNumberFromDisplayName(
  displayName: string
): number | null {
  const match = displayName.match(/(?:staffel|season|s)\s*0*([1-9][0-9]*)/i);
  return match ? Number(match[1]) : null;
}
