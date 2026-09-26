CREATE TABLE `local_episodes` (
  `id` text PRIMARY KEY NOT NULL,
  `jellyfin_item_id` text NOT NULL,
  `parent_series_id` text NOT NULL,
  `parent_season_id` text,
  `season_number` integer,
  `episode_number` integer,
  `display_name` text NOT NULL,
  `premiere_date` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `last_seen_in_jellyfin_at` text,
  `removed_from_jellyfin_at` text,
  FOREIGN KEY (`parent_series_id`) REFERENCES `media_entities`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`parent_season_id`) REFERENCES `local_seasons`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_episodes_jellyfin_item_id_idx` ON `local_episodes` (`jellyfin_item_id`);
--> statement-breakpoint
CREATE INDEX `local_episodes_series_season_episode_idx` ON `local_episodes` (`parent_series_id`,`season_number`,`episode_number`);
--> statement-breakpoint
CREATE TABLE `external_episodes` (
  `id` text PRIMARY KEY NOT NULL,
  `external_series_state_id` text NOT NULL,
  `season_number` integer NOT NULL,
  `episode_number` integer NOT NULL,
  `name` text,
  `air_date` text,
  `fetched_at` text NOT NULL,
  FOREIGN KEY (`external_series_state_id`) REFERENCES `external_series_states`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_episodes_unique_idx` ON `external_episodes` (`external_series_state_id`,`season_number`,`episode_number`);
--> statement-breakpoint
CREATE INDEX `external_episodes_state_season_idx` ON `external_episodes` (`external_series_state_id`,`season_number`);
