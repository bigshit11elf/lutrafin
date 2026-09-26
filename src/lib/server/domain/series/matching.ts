export type ExternalIds = Record<string, string>;

export type MatchMethod =
  | 'exact_external_id'
  | 'cross_provider_id'
  | 'exact_name_year'
  | 'manual'
  | 'unresolved';

export type ProviderPriority = 'tmdb' | 'tvdb' | 'imdb';

const priority: ProviderPriority[] = ['tmdb', 'tvdb', 'imdb'];

export function selectPreferredExternalId(ids: ExternalIds):
  | {
      provider: ProviderPriority;
      externalId: string;
      matchMethod: MatchMethod;
    }
  | undefined {
  const normalizedIds = new Map(
    Object.entries(ids).map(([provider, externalId]) => [
      provider.toLowerCase(),
      externalId
    ])
  );

  for (const provider of priority) {
    const externalId = normalizedIds.get(provider);
    if (externalId && externalId.trim().length > 0) {
      return {
        provider,
        externalId: externalId.trim(),
        matchMethod: 'exact_external_id'
      };
    }
  }

  return undefined;
}
