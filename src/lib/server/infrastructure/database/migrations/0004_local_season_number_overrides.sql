CREATE TABLE `local_season_number_overrides` (
  `local_season_id` text PRIMARY KEY NOT NULL,
  `media_entity_id` text NOT NULL,
  `original_season_number` integer,
  `mapped_season_number` integer NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`local_season_id`) REFERENCES `local_seasons`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`media_entity_id`) REFERENCES `media_entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `local_season_number_overrides_media_idx` ON `local_season_number_overrides` (`media_entity_id`);
