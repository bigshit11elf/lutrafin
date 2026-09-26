import { GetSeriesOverview } from '$lib/server/application/use-cases/get-series-overview';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { DrizzleSeriesOverviewRepository } from '$lib/server/infrastructure/database/repositories/series-overview-repository';

export function createGetSeriesOverview(): GetSeriesOverview {
  return new GetSeriesOverview(
    new DrizzleSeriesOverviewRepository(getDatabase())
  );
}
