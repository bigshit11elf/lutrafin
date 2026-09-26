import { GetSeriesDetails } from '$lib/server/application/use-cases/get-series-details';
import { getDatabase } from '$lib/server/infrastructure/database/client';
import { DrizzleSeriesDetailsRepository } from '$lib/server/infrastructure/database/repositories/series-details-repository';

export function createGetSeriesDetails(): GetSeriesDetails {
  return new GetSeriesDetails(
    new DrizzleSeriesDetailsRepository(getDatabase())
  );
}
