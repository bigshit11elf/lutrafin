CREATE TABLE `episode_presence_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`media_entity_id` text NOT NULL,
	`season_number` integer NOT NULL,
	`episode_number` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`media_entity_id`) REFERENCES `media_entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `episode_presence_overrides_unique_idx` ON `episode_presence_overrides` (`media_entity_id`,`season_number`,`episode_number`);
--> statement-breakpoint
CREATE INDEX `episode_presence_overrides_media_idx` ON `episode_presence_overrides` (`media_entity_id`);
--> statement-breakpoint
CREATE TABLE `notification_baselines` (
	`media_entity_id` text NOT NULL,
	`provider` text NOT NULL,
	`baseline_at` text NOT NULL,
	PRIMARY KEY(`media_entity_id`, `provider`),
	FOREIGN KEY (`media_entity_id`) REFERENCES `media_entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notification_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_key` text NOT NULL,
	`event_type` text NOT NULL,
	`media_entity_id` text NOT NULL,
	`series_name` text NOT NULL,
	`season_number` integer NOT NULL,
	`air_date` text,
	`metadata_run_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`media_entity_id`) REFERENCES `media_entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_events_key_idx` ON `notification_events` (`event_key`);
--> statement-breakpoint
CREATE INDEX `notification_events_run_idx` ON `notification_events` (`metadata_run_id`);
--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`notification_id` text NOT NULL,
	`provider` text NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`payload_json` text NOT NULL,
	`attempt_count` integer NOT NULL DEFAULT 0,
	`last_attempt_at` text,
	`last_error` text,
	`next_attempt_at` text,
	`notified_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notification_deliveries_due_idx` ON `notification_deliveries` (`status`,`next_attempt_at`);
