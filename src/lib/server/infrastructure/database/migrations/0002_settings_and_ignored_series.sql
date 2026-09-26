CREATE TABLE `app_settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ignored_series` (
  `media_entity_id` text PRIMARY KEY NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`media_entity_id`) REFERENCES `media_entities`(`id`) ON UPDATE no action ON DELETE cascade
);
