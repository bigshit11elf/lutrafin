import type {
  SeriesMetadataProvider,
  SeriesResolveInput,
  SeriesResolveResult
} from '$lib/server/application/ports/series-metadata-provider';

export class CompositeSeriesMetadataProvider implements SeriesMetadataProvider {
  readonly providerName = 'composite';

  constructor(private readonly providers: SeriesMetadataProvider[]) {}

  async resolveSeries(input: SeriesResolveInput): Promise<SeriesResolveResult> {
    let unresolved: SeriesResolveResult | undefined;
    for (const provider of this.providers) {
      try {
        const result = await provider.resolveSeries(input);
        if (result.matchMethod !== 'unresolved') return result;
        unresolved = result;
      } catch {
        continue;
      }
    }
    return (
      unresolved ?? {
        matchMethod: 'unresolved',
        reason: 'No metadata provider resolved the series'
      }
    );
  }

  async getSeries(providerSeriesId: string) {
    if (!this.providers[0]) throw new Error('No metadata providers configured');
    return this.providers[0].getSeries(providerSeriesId);
  }

  async healthCheck(): Promise<boolean> {
    const checks = await Promise.allSettled(
      this.providers.map((provider) => provider.healthCheck())
    );
    return checks.some((check) => check.status === 'fulfilled' && check.value);
  }
}
