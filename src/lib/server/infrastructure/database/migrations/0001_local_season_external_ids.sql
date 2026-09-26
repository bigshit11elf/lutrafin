CREATE TABLE `local_season_external_ids` (
  `id` text PRIMARY KEY NOT NULL,
  `local_season_id` text NOT NULL,
  `provider` text NOT NULL,
  `external_id` text NOT NULL,
  `source` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`local_season_id`) REFERENCES `local_seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_season_external_ids_unique_idx` ON `local_season_external_ids` (`local_season_id`,`provider`,`external_id`);
--> statement-breakpoint
CREATE INDEX `local_season_external_ids_provider_idx` ON `local_season_external_ids` (`provider`,`external_id`);
