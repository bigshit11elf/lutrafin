import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core';

export const mediaLibraries = sqliteTable(
  'media_libraries',
  {
    id: text('id').primaryKey(),
    jellyfinLibraryId: text('jellyfin_library_id').notNull(),
    name: text('name').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    lastSeenInJellyfinAt: text('last_seen_in_jellyfin_at')
  },
  (table) => [
    uniqueIndex('media_libraries_jellyfin_library_id_idx').on(
      table.jellyfinLibraryId
    )
  ]
);

export const mediaEntities = sqliteTable(
  'media_entities',
  {
    id: text('id').primaryKey(),
    mediaType: text('media_type', { enum: ['series'] }).notNull(),
    jellyfinItemId: text('jellyfin_item_id').notNull(),
    jellyfinLibraryId: text('jellyfin_library_id'),
    name: text('name').notNull(),
    originalTitle: text('original_title'),
    sortName: text('sort_name'),
    productionYear: integer('production_year'),
    premiereDate: text('premiere_date'),
    primaryImageTag: text('primary_image_tag'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    lastSeenInJellyfinAt: text('last_seen_in_jellyfin_at'),
    removedFromJellyfinAt: text('removed_from_jellyfin_at')
  },
  (table) => [
    uniqueIndex('media_entities_jellyfin_item_id_idx').on(table.jellyfinItemId),
    index('media_entities_media_type_idx').on(table.mediaType),
    index('media_entities_name_idx').on(table.name)
  ]
);

export const localSeries = sqliteTable('local_series', {
  id: text('id')
    .primaryKey()
    .references(() => mediaEntities.id, { onDelete: 'cascade' }),
  metadataProvider: text('metadata_provider'),
  metadataMatchStatus: text('metadata_match_status', {
    enum: [
      'exact_external_id',
      'cross_provider_id',
      'exact_name_year',
      'manual',
      'unresolved'
    ]
  })
    .notNull()
    .default('unresolved'),
  metadataLastCheckedAt: text('metadata_last_checked_at'),
  metadataNextCheckAt: text('metadata_next_check_at'),
  metadataLastSuccessAt: text('metadata_last_success_at'),
  metadataLastErrorAt: text('metadata_last_error_at'),
  metadataErrorCode: text('metadata_error_code')
});

export const localSeasons = sqliteTable(
  'local_seasons',
  {
    id: text('id').primaryKey(),
    jellyfinItemId: text('jellyfin_item_id').notNull(),
    parentSeriesId: text('parent_series_id')
      .notNull()
      .references(() => mediaEntities.id, { onDelete: 'cascade' }),
    seasonNumber: integer('season_number'),
    displayName: text('display_name').notNull(),
    premiereDate: text('premiere_date'),
    primaryImageTag: text('primary_image_tag'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    lastSeenInJellyfinAt: text('last_seen_in_jellyfin_at'),
    removedFromJellyfinAt: text('removed_from_jellyfin_at')
  },
  (table) => [
    uniqueIndex('local_seasons_jellyfin_item_id_idx').on(table.jellyfinItemId),
    index('local_seasons_parent_series_id_idx').on(table.parentSeriesId)
  ]
);

export const localEpisodes = sqliteTable(
  'local_episodes',
  {
    id: text('id').primaryKey(),
    jellyfinItemId: text('jellyfin_item_id').notNull(),
    parentSeriesId: text('parent_series_id')
      .notNull()
      .references(() => mediaEntities.id, { onDelete: 'cascade' }),
    parentSeasonId: text('parent_season_id').references(() => localSeasons.id, {
      onDelete: 'set null'
    }),
    seasonNumber: integer('season_number'),
    episodeNumber: integer('episode_number'),
    displayName: text('display_name').notNull(),
    premiereDate: text('premiere_date'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    lastSeenInJellyfinAt: text('last_seen_in_jellyfin_at'),
    removedFromJellyfinAt: text('removed_from_jellyfin_at')
  },
  (table) => [
    uniqueIndex('local_episodes_jellyfin_item_id_idx').on(table.jellyfinItemId),
    index('local_episodes_series_season_episode_idx').on(
      table.parentSeriesId,
      table.seasonNumber,
      table.episodeNumber
    )
  ]
);

export const mediaExternalIds = sqliteTable(
  'media_external_ids',
  {
    id: text('id').primaryKey(),
    mediaEntityId: text('media_entity_id')
      .notNull()
      .references(() => mediaEntities.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    externalId: text('external_id').notNull(),
    source: text('source', { enum: ['jellyfin', 'resolved'] }).notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    uniqueIndex('media_external_ids_unique_idx').on(
      table.mediaEntityId,
      table.provider,
      table.externalId
    ),
    index('media_external_ids_provider_idx').on(
      table.provider,
      table.externalId
    )
  ]
);

export const localSeasonExternalIds = sqliteTable(
  'local_season_external_ids',
  {
    id: text('id').primaryKey(),
    localSeasonId: text('local_season_id')
      .notNull()
      .references(() => localSeasons.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    externalId: text('external_id').notNull(),
    source: text('source', { enum: ['jellyfin', 'resolved'] }).notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    uniqueIndex('local_season_external_ids_unique_idx').on(
      table.localSeasonId,
      table.provider,
      table.externalId
    ),
    index('local_season_external_ids_provider_idx').on(
      table.provider,
      table.externalId
    )
  ]
);

export const externalSeriesStates = sqliteTable(
  'external_series_states',
  {
    id: text('id').primaryKey(),
    mediaEntityId: text('media_entity_id')
      .notNull()
      .references(() => mediaEntities.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerSeriesId: text('provider_series_id').notNull(),
    providerRawStatus: text('provider_raw_status'),
    normalizedStatus: text('normalized_status', {
      enum: ['continuing', 'ended', 'canceled', 'upcoming', 'unknown']
    }).notNull(),
    firstAirDate: text('first_air_date'),
    lastAirDate: text('last_air_date'),
    fetchedAt: text('fetched_at').notNull(),
    rawData: text('raw_data', { mode: 'json' })
  },
  (table) => [
    uniqueIndex('external_series_states_unique_idx').on(
      table.mediaEntityId,
      table.provider
    )
  ]
);

export const externalSeasons = sqliteTable(
  'external_seasons',
  {
    id: text('id').primaryKey(),
    externalSeriesStateId: text('external_series_state_id')
      .notNull()
      .references(() => externalSeriesStates.id, { onDelete: 'cascade' }),
    seasonNumber: integer('season_number').notNull(),
    name: text('name'),
    airDate: text('air_date'),
    episodeCount: integer('episode_count'),
    fetchedAt: text('fetched_at').notNull()
  },
  (table) => [
    uniqueIndex('external_seasons_unique_idx').on(
      table.externalSeriesStateId,
      table.seasonNumber
    )
  ]
);

export const externalEpisodes = sqliteTable(
  'external_episodes',
  {
    id: text('id').primaryKey(),
    externalSeriesStateId: text('external_series_state_id')
      .notNull()
      .references(() => externalSeriesStates.id, { onDelete: 'cascade' }),
    seasonNumber: integer('season_number').notNull(),
    episodeNumber: integer('episode_number').notNull(),
    name: text('name'),
    airDate: text('air_date'),
    fetchedAt: text('fetched_at').notNull()
  },
  (table) => [
    uniqueIndex('external_episodes_unique_idx').on(
      table.externalSeriesStateId,
      table.seasonNumber,
      table.episodeNumber
    ),
    index('external_episodes_state_season_idx').on(
      table.externalSeriesStateId,
      table.seasonNumber
    )
  ]
);

export const providerLookups = sqliteTable(
  'provider_lookups',
  {
    id: text('id').primaryKey(),
    mediaEntityId: text('media_entity_id')
      .notNull()
      .references(() => mediaEntities.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    matchMethod: text('match_method', {
      enum: [
        'exact_external_id',
        'cross_provider_id',
        'exact_name_year',
        'manual',
        'unresolved'
      ]
    }).notNull(),
    providerSeriesId: text('provider_series_id'),
    successful: integer('successful', { mode: 'boolean' }).notNull(),
    fetchedAt: text('fetched_at').notNull(),
    nextRefreshAt: text('next_refresh_at'),
    errorCode: text('error_code')
  },
  (table) => [index('provider_lookups_due_idx').on(table.nextRefreshAt)]
);

export const syncRuns = sqliteTable(
  'sync_runs',
  {
    id: text('id').primaryKey(),
    type: text('type', { enum: ['jellyfin', 'metadata'] }).notNull(),
    status: text('status', {
      enum: ['running', 'success', 'failed']
    }).notNull(),
    startedAt: text('started_at').notNull(),
    finishedAt: text('finished_at'),
    durationMs: integer('duration_ms'),
    seriesRead: integer('series_read').notNull().default(0),
    seasonsRead: integer('seasons_read').notNull().default(0),
    added: integer('added').notNull().default(0),
    updated: integer('updated').notNull().default(0),
    removed: integer('removed').notNull().default(0),
    errorCode: text('error_code'),
    errorMessage: text('error_message')
  },
  (table) => [index('sync_runs_started_at_idx').on(table.startedAt)]
);

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const adminSessions = sqliteTable(
  'admin_sessions',
  {
    idHash: text('id_hash').primaryKey(),
    username: text('username').notNull(),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    invalidatedAt: text('invalidated_at')
  },
  (table) => [index('admin_sessions_expires_idx').on(table.expiresAt)]
);

export const ignoredSeries = sqliteTable('ignored_series', {
  mediaEntityId: text('media_entity_id')
    .primaryKey()
    .references(() => mediaEntities.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull()
});

export const episodePresenceOverrides = sqliteTable(
  'episode_presence_overrides',
  {
    id: text('id').primaryKey(),
    mediaEntityId: text('media_entity_id')
      .notNull()
      .references(() => mediaEntities.id, { onDelete: 'cascade' }),
    seasonNumber: integer('season_number').notNull(),
    episodeNumber: integer('episode_number').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    uniqueIndex('episode_presence_overrides_unique_idx').on(
      table.mediaEntityId,
      table.seasonNumber,
      table.episodeNumber
    ),
    index('episode_presence_overrides_media_idx').on(table.mediaEntityId)
  ]
);

export const notificationBaselines = sqliteTable(
  'notification_baselines',
  {
    mediaEntityId: text('media_entity_id')
      .notNull()
      .references(() => mediaEntities.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    baselineAt: text('baseline_at').notNull()
  },
  (table) => [
    uniqueIndex('notification_baselines_unique_idx').on(
      table.mediaEntityId,
      table.provider
    )
  ]
);

export const notificationEvents = sqliteTable(
  'notification_events',
  {
    id: text('id').primaryKey(),
    eventKey: text('event_key').notNull(),
    eventType: text('event_type', {
      enum: ['season_announced', 'season_released']
    }).notNull(),
    mediaEntityId: text('media_entity_id')
      .notNull()
      .references(() => mediaEntities.id, { onDelete: 'cascade' }),
    seriesName: text('series_name').notNull(),
    seasonNumber: integer('season_number').notNull(),
    airDate: text('air_date'),
    metadataRunId: text('metadata_run_id'),
    createdAt: text('created_at').notNull()
  },
  (table) => [
    uniqueIndex('notification_events_key_idx').on(table.eventKey),
    index('notification_events_run_idx').on(table.metadataRunId)
  ]
);

export const notificationDeliveries = sqliteTable(
  'notification_deliveries',
  {
    id: text('id').primaryKey(),
    notificationId: text('notification_id').notNull(),
    provider: text('provider').notNull(),
    status: text('status', {
      enum: ['pending', 'sending', 'sent', 'failed', 'exhausted']
    }).notNull(),
    summary: text('summary').notNull(),
    payloadJson: text('payload_json').notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    claimedAt: text('claimed_at'),
    lastAttemptAt: text('last_attempt_at'),
    lastError: text('last_error'),
    nextAttemptAt: text('next_attempt_at'),
    notifiedAt: text('notified_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('notification_deliveries_due_idx').on(
      table.status,
      table.nextAttemptAt
    )
  ]
);

export const tmdbWatchProviderCache = sqliteTable(
  'tmdb_watch_provider_cache',
  {
    cacheKey: text('cache_key').primaryKey(),
    providerSeriesId: text('provider_series_id').notNull(),
    seasonNumber: integer('season_number').notNull(),
    region: text('region').notNull(),
    providersJson: text('providers_json').notNull(),
    expiresAt: text('expires_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('tmdb_watch_provider_cache_expires_idx').on(table.expiresAt)
  ]
);

export const localSeasonNumberOverrides = sqliteTable(
  'local_season_number_overrides',
  {
    localSeasonId: text('local_season_id')
      .primaryKey()
      .references(() => localSeasons.id, { onDelete: 'cascade' }),
    mediaEntityId: text('media_entity_id')
      .notNull()
      .references(() => mediaEntities.id, { onDelete: 'cascade' }),
    originalSeasonNumber: integer('original_season_number'),
    mappedSeasonNumber: integer('mapped_season_number').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('local_season_number_overrides_media_idx').on(table.mediaEntityId)
  ]
);

export const shoppingListItems = sqliteTable(
  'shopping_list_items',
  {
    id: text('id').primaryKey(),
    mediaEntityId: text('media_entity_id')
      .notNull()
      .references(() => mediaEntities.id, { onDelete: 'cascade' }),
    seasonNumber: integer('season_number').notNull(),
    status: text('status', { enum: ['missing', 'upcoming'] }).notNull(),
    priority: integer('priority').notNull(),
    sourceUrl: text('source_url'),
    sourceLabel: text('source_label'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    uniqueIndex('shopping_list_items_series_season_idx').on(
      table.mediaEntityId,
      table.seasonNumber
    ),
    index('shopping_list_items_priority_idx').on(table.priority)
  ]
);

export const mediaEntitiesRelations = relations(
  mediaEntities,
  ({ many, one }) => ({
    localSeries: one(localSeries, {
      fields: [mediaEntities.id],
      references: [localSeries.id]
    }),
    localSeasons: many(localSeasons),
    externalIds: many(mediaExternalIds),
    externalStates: many(externalSeriesStates)
  })
);

export const localSeasonsRelations = relations(localSeasons, ({ one }) => ({
  series: one(mediaEntities, {
    fields: [localSeasons.parentSeriesId],
    references: [mediaEntities.id]
  })
}));
