CREATE TABLE `tmdb_watch_provider_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`provider_series_id` text NOT NULL,
	`season_number` integer NOT NULL,
	`region` text NOT NULL,
	`providers_json` text NOT NULL,
	`expires_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tmdb_watch_provider_cache_expires_idx` ON `tmdb_watch_provider_cache` (`expires_at`);
