CREATE TABLE `shopping_list_items` (
  `id` text PRIMARY KEY NOT NULL,
  `media_entity_id` text NOT NULL,
  `season_number` integer NOT NULL,
  `status` text NOT NULL,
  `priority` integer NOT NULL,
  `source_url` text,
  `source_label` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`media_entity_id`) REFERENCES `media_entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shopping_list_items_series_season_idx` ON `shopping_list_items` (`media_entity_id`,`season_number`);
--> statement-breakpoint
CREATE INDEX `shopping_list_items_priority_idx` ON `shopping_list_items` (`priority`);
