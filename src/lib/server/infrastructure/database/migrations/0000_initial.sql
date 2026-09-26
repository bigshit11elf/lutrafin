PRAGMA foreign_keys=ON;
--> statement-breakpoint

CREATE TABLE `media_libraries` (
  `id` text PRIMARY KEY NOT NULL,
  `jellyfin_library_id` text NOT NULL,
  `name` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `last_seen_in_jellyfin_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_libraries_jellyfin_library_id_idx` ON `media_libraries` (`jellyfin_library_id`);
--> statement-breakpoint
CREATE TABLE `media_entities` (
  `id` text PRIMARY KEY NOT NULL,
  `media_type` text NOT NULL,
  `jellyfin_item_id` text NOT NULL,
  `jellyfin_library_id` text,
  `name` text NOT NULL,
  `original_title` text,
  `sort_name` text,
  `production_year` integer,
  `premiere_date` text,
  `primary_image_tag` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `last_seen_in_jellyfin_at` text,
  `removed_from_jellyfin_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_entities_jellyfin_item_id_idx` ON `media_entities` (`jellyfin_item_id`);
--> statement-breakpoint
CREATE INDEX `media_entities_media_type_idx` ON `media_entities` (`media_type`);
--> statement-breakpoint
CREATE INDEX `media_entities_name_idx` ON `media_entities` (`name`);
--> statement-breakpoint
CREATE TABLE `local_series` (
  `id` text PRIMARY KEY NOT NULL,
  `metadata_provider` text,
  `metadata_match_status` text DEFAULT 'unresolved' NOT NULL,
  `metadata_last_checked_at` text,
  `metadata_next_check_at` text,
  `metadata_last_success_at` text,
  `metadata_last_error_at` text,
  `metadata_error_code` text,
  FOREIGN KEY (`id`) REFERENCES `media_entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `local_seasons` (
  `id` text PRIMARY KEY NOT NULL,
  `jellyfin_item_id` text NOT NULL,
  `parent_series_id` text NOT NULL,
  `season_number` integer,
  `display_name` text NOT NULL,
  `premiere_date` text,
  `primary_image_tag` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `last_seen_in_jellyfin_at` text,
  `removed_from_jellyfin_at` text,
  FOREIGN KEY (`parent_series_id`) REFERENCES `media_entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_seasons_jellyfin_item_id_idx` ON `local_seasons` (`jellyfin_item_id`);
--> statement-breakpoint
CREATE INDEX `local_seasons_parent_series_id_idx` ON `local_seasons` (`parent_series_id`);
--> statement-breakpoint
CREATE TABLE `media_external_ids` (
  `id` text PRIMARY KEY NOT NULL,
  `media_entity_id` text NOT NULL,
  `provider` text NOT NULL,
  `external_id` text NOT NULL,
  `source` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`media_entity_id`) REFERENCES `media_entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_external_ids_unique_idx` ON `media_external_ids` (`media_entity_id`,`provider`,`external_id`);
--> statement-breakpoint
CREATE INDEX `media_external_ids_provider_idx` ON `media_external_ids` (`provider`,`external_id`);
--> statement-breakpoint
CREATE TABLE `external_series_states` (
  `id` text PRIMARY KEY NOT NULL,
  `media_entity_id` text NOT NULL,
  `provider` text NOT NULL,
  `provider_series_id` text NOT NULL,
  `provider_raw_status` text,
  `normalized_status` text NOT NULL,
  `first_air_date` text,
  `last_air_date` text,
  `fetched_at` text NOT NULL,
  `raw_data` text,
  FOREIGN KEY (`media_entity_id`) REFERENCES `media_entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_series_states_unique_idx` ON `external_series_states` (`media_entity_id`,`provider`);
--> statement-breakpoint
CREATE TABLE `external_seasons` (
  `id` text PRIMARY KEY NOT NULL,
  `external_series_state_id` text NOT NULL,
  `season_number` integer NOT NULL,
  `name` text,
  `air_date` text,
  `episode_count` integer,
  `fetched_at` text NOT NULL,
  FOREIGN KEY (`external_series_state_id`) REFERENCES `external_series_states`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_seasons_unique_idx` ON `external_seasons` (`external_series_state_id`,`season_number`);
--> statement-breakpoint
CREATE TABLE `provider_lookups` (
  `id` text PRIMARY KEY NOT NULL,
  `media_entity_id` text NOT NULL,
  `provider` text NOT NULL,
  `match_method` text NOT NULL,
  `provider_series_id` text,
  `successful` integer NOT NULL,
  `fetched_at` text NOT NULL,
  `next_refresh_at` text,
  `error_code` text,
  FOREIGN KEY (`media_entity_id`) REFERENCES `media_entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `provider_lookups_due_idx` ON `provider_lookups` (`next_refresh_at`);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `type` text NOT NULL,
  `status` text NOT NULL,
  `started_at` text NOT NULL,
  `finished_at` text,
  `duration_ms` integer,
  `series_read` integer DEFAULT 0 NOT NULL,
  `seasons_read` integer DEFAULT 0 NOT NULL,
  `added` integer DEFAULT 0 NOT NULL,
  `updated` integer DEFAULT 0 NOT NULL,
  `removed` integer DEFAULT 0 NOT NULL,
  `error_code` text,
  `error_message` text
);
--> statement-breakpoint
CREATE INDEX `sync_runs_started_at_idx` ON `sync_runs` (`started_at`);
