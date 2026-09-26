import type {
  ExternalSeriesMetadata,
  SeriesMetadataProvider,
  SeriesResolveInput
} from '../ports/series-metadata-provider';
import { NotificationDeliveryService } from '$lib/server/notifications/delivery-service';

export type MetadataRefreshCandidate = SeriesResolveInput & {
  mediaEntityId: string;
};

export type RefreshSeriesMetadataRepository = {
  getCandidate(
    mediaEntityId: string
  ): Promise<MetadataRefreshCandidate | undefined>;
  getDueCandidates(
    limit: number,
    now: string
  ): Promise<MetadataRefreshCandidate[]>;
  getAllCandidates(limit: number): Promise<MetadataRefreshCandidate[]>;
  saveSuccess(input: {
    mediaEntityId: string;
    provider: string;
    matchMethod: 'exact_external_id' | 'cross_provider_id' | 'exact_name_year';
    metadata: ExternalSeriesMetadata;
    checkedAt: string;
    nextCheckAt: string;
  }): Promise<void>;
  saveUnresolved(input: {
    mediaEntityId: string;
    provider: string;
    checkedAt: string;
    nextCheckAt: string;
    reason: string;
  }): Promise<void>;
  saveError(input: {
    mediaEntityId: string;
    provider: string;
    checkedAt: string;
    nextCheckAt: string;
    errorCode: string;
  }): Promise<void>;
};

export type RefreshSeriesMetadataResult = {
  refreshed: number;
  unresolved: number;
  failed: number;
};

function nextCheckForStatus(status: string, checkedAt: string): string {
  const date = new Date(checkedAt);
  const days = status === 'continuing' || status === 'upcoming' ? 1 : 7;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function nextCheckAfterProblem(checkedAt: string): string {
  const date = new Date(checkedAt);
  date.setUTCHours(date.getUTCHours() + 6);
  return date.toISOString();
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.name : 'ProviderError';
}

export class RefreshSeriesMetadata {
  constructor(
    private readonly provider: SeriesMetadataProvider,
    private readonly repository: RefreshSeriesMetadataRepository
  ) {}

  async refreshOne(
    mediaEntityId: string
  ): Promise<RefreshSeriesMetadataResult> {
    const candidate = await this.repository.getCandidate(mediaEntityId);
    if (!candidate) {
      return { refreshed: 0, unresolved: 0, failed: 0 };
    }

    return this.refreshCandidates([candidate]);
  }

  async refreshDue(limit = 25): Promise<RefreshSeriesMetadataResult> {
    const now = new Date().toISOString();
    return this.refreshCandidates(
      await this.repository.getDueCandidates(limit, now),
      now
    );
  }

  async refreshAll(limit = 250): Promise<RefreshSeriesMetadataResult> {
    return this.refreshCandidates(
      await this.repository.getAllCandidates(limit)
    );
  }

  private async refreshCandidates(
    candidates: MetadataRefreshCandidate[],
    checkedAt = new Date().toISOString()
  ) {
    const result: RefreshSeriesMetadataResult = {
      refreshed: 0,
      unresolved: 0,
      failed: 0
    };

    for (const candidate of candidates) {
      try {
        const resolved = await this.provider.resolveSeries(candidate);
        if (resolved.matchMethod === 'unresolved') {
          result.unresolved += 1;
          await this.repository.saveUnresolved({
            mediaEntityId: candidate.mediaEntityId,
            provider: this.provider.providerName,
            checkedAt,
            nextCheckAt: nextCheckAfterProblem(checkedAt),
            reason: resolved.reason
          });
          continue;
        }

        result.refreshed += 1;
        await this.repository.saveSuccess({
          mediaEntityId: candidate.mediaEntityId,
          provider: resolved.metadata.provider,
          matchMethod: resolved.matchMethod,
          metadata: resolved.metadata,
          checkedAt,
          nextCheckAt: nextCheckForStatus(
            resolved.metadata.normalizedStatus,
            checkedAt
          )
        });
      } catch (error) {
        result.failed += 1;
        await this.repository.saveError({
          mediaEntityId: candidate.mediaEntityId,
          provider: this.provider.providerName,
          checkedAt,
          nextCheckAt: nextCheckAfterProblem(checkedAt),
          errorCode: errorCode(error)
        });
      }
    }

    try {
      await new NotificationDeliveryService().enqueueAndSendRun(checkedAt);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.warn(
        JSON.stringify({
          level: 'warn',
          job: 'notifications',
          message
        })
      );
    }

    return result;
  }
}
