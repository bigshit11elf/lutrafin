import { describe, expect, it } from 'vitest';
import { compareSeasons } from '../src/lib/server/domain/series/season-comparison';
import { selectPreferredExternalId } from '../src/lib/server/domain/series/matching';
import { suggestedSeasonNumberFromDisplayName } from '../src/lib/server/domain/series/season-number-override';
import {
  normalizeTmdbStatus,
  normalizeTvmazeStatus
} from '../src/lib/server/domain/series/status';

const today = new Date('2026-09-22T12:00:00.000Z');

describe('series status normalization', () => {
  it('normalizes TMDB statuses', () => {
    expect(normalizeTmdbStatus('Returning Series')).toBe('continuing');
    expect(normalizeTmdbStatus('Ended')).toBe('ended');
    expect(normalizeTmdbStatus('Canceled')).toBe('canceled');
    expect(normalizeTmdbStatus('Planned')).toBe('upcoming');
    expect(normalizeTmdbStatus('unexpected')).toBe('unknown');
  });

  it('normalizes TVmaze statuses', () => {
    expect(normalizeTvmazeStatus('Running')).toBe('continuing');
    expect(normalizeTvmazeStatus('Ended')).toBe('ended');
    expect(normalizeTvmazeStatus('To Be Determined')).toBe('unknown');
  });
});

describe('season comparison', () => {
  it('excludes season 0 from regular season calculations', () => {
    const result = compareSeasons(
      [{ seasonNumber: 0 }, { seasonNumber: 1 }, { seasonNumber: 2 }],
      [
        { seasonNumber: 0, airDate: '2020-01-01' },
        { seasonNumber: 1, airDate: '2020-01-01' }
      ],
      today
    );

    expect(result.localSeasonNumbers).toEqual([1, 2]);
    expect(result.comparableLocalSeasonNumbers).toEqual([1]);
    expect(result.localMaxRegularSeason).toBe(1);
  });

  it('ignores provider-unknown local seasons for comparable gaps', () => {
    const result = compareSeasons(
      [
        { seasonNumber: null },
        { seasonNumber: 1 },
        { seasonNumber: 2 },
        { seasonNumber: 3 },
        { seasonNumber: 5 }
      ],
      [
        { seasonNumber: 0, airDate: '1988-10-15' },
        { seasonNumber: 1, airDate: '1966-09-08' },
        { seasonNumber: 2, airDate: '1967-09-14' },
        { seasonNumber: 3, airDate: '1968-09-20' }
      ],
      today
    );

    expect(result.localSeasonNumbers).toEqual([1, 2, 3, 5]);
    expect(result.comparableLocalSeasonNumbers).toEqual([1, 2, 3]);
    expect(result.localMaxRegularSeason).toBe(3);
    expect(result.missingSeasonNumbers).toEqual([]);
  });

  it('detects announced provider seasons even with higher local artifacts', () => {
    const result = compareSeasons(
      [
        { seasonNumber: 1 },
        { seasonNumber: 2 },
        { seasonNumber: 3 },
        { seasonNumber: 5 }
      ],
      [
        { seasonNumber: 1, airDate: '2020-01-01' },
        { seasonNumber: 2, airDate: '2021-01-01' },
        { seasonNumber: 3, airDate: '2022-01-01' },
        { seasonNumber: 4, airDate: '2027-01-01' }
      ],
      today
    );

    expect(result.hasAnnouncedFutureSeason).toBe(true);
  });

  it('calculates local and external latest seasons', () => {
    const result = compareSeasons(
      [
        { seasonNumber: 1 },
        { seasonNumber: 4 },
        { seasonNumber: null },
        { seasonNumber: -1 }
      ],
      [
        { seasonNumber: 1, airDate: '2022-01-01' },
        { seasonNumber: 2, airDate: '2023-01-01' },
        { seasonNumber: 3, airDate: '2024-01-01' },
        { seasonNumber: 4, airDate: '2027-01-01' }
      ],
      today
    );

    expect(result.localMaxRegularSeason).toBe(4);
    expect(result.externalLatestKnownSeason).toBe(4);
    expect(result.externalLatestAiredSeason).toBe(3);
  });

  it('detects missing aired seasons and gaps', () => {
    const result = compareSeasons(
      [{ seasonNumber: 1 }, { seasonNumber: 2 }, { seasonNumber: 4 }],
      [
        { seasonNumber: 1, airDate: '2020-01-01' },
        { seasonNumber: 2, airDate: '2021-01-01' },
        { seasonNumber: 3, airDate: '2022-01-01' },
        { seasonNumber: 4, airDate: '2023-01-01' }
      ],
      today
    );

    expect(result.missingSeasonNumbers).toEqual([3]);
    expect(result.missingAiredSeasonCount).toBe(1);
    expect(result.hasNewAiredSeason).toBe(true);
  });

  it('distinguishes announced future seasons from available seasons', () => {
    const result = compareSeasons(
      [
        { seasonNumber: 1 },
        { seasonNumber: 2 },
        { seasonNumber: 3 },
        { seasonNumber: 4 }
      ],
      [
        { seasonNumber: 1, airDate: '2020-01-01' },
        { seasonNumber: 2, airDate: '2021-01-01' },
        { seasonNumber: 3, airDate: '2022-01-01' },
        { seasonNumber: 4, airDate: '2023-01-01' },
        { seasonNumber: 5, airDate: '2027-03-01' }
      ],
      today
    );

    expect(result.hasNewAiredSeason).toBe(false);
    expect(result.hasAnnouncedFutureSeason).toBe(true);
  });

  it('does not mark undated provider seasons as aired', () => {
    const result = compareSeasons(
      [{ seasonNumber: 1 }],
      [
        { seasonNumber: 1, airDate: '2020-01-01' },
        { seasonNumber: 2, airDate: null }
      ],
      today
    );

    expect(result.externalLatestKnownSeason).toBe(2);
    expect(result.externalLatestAiredSeason).toBe(1);
    expect(result.missingSeasonNumbers).toEqual([]);
  });
});

describe('season number override suggestions', () => {
  it('recognizes regular season display names', () => {
    expect(suggestedSeasonNumberFromDisplayName('Staffel 1')).toBe(1);
    expect(suggestedSeasonNumberFromDisplayName('Season 02')).toBe(2);
    expect(suggestedSeasonNumberFromDisplayName('S03')).toBe(3);
  });

  it('ignores names without regular season hints', () => {
    expect(suggestedSeasonNumberFromDisplayName('Specials')).toBeNull();
    expect(suggestedSeasonNumberFromDisplayName('Bonus')).toBeNull();
  });
});

describe('external id matching', () => {
  it('prioritizes TMDB over TVDB and IMDb', () => {
    expect(
      selectPreferredExternalId({
        IMDb: 'tt1234567',
        TVDB: '98765',
        TMDB: '12345'
      })
    ).toEqual({
      provider: 'tmdb',
      externalId: '12345',
      matchMethod: 'exact_external_id'
    });
  });

  it('falls back to TVDB and then IMDb', () => {
    expect(
      selectPreferredExternalId({ IMDb: 'tt1234567', TVDB: '98765' })?.provider
    ).toBe('tvdb');
    expect(selectPreferredExternalId({ IMDb: 'tt1234567' })?.provider).toBe(
      'imdb'
    );
  });

  it('returns unresolved input as undefined instead of guessing', () => {
    expect(selectPreferredExternalId({})).toBeUndefined();
    expect(selectPreferredExternalId({ TMDB: '   ' })).toBeUndefined();
  });
});
