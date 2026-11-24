CREATE TABLE `spielpause_results` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`member_id` text NOT NULL,
	`game` text NOT NULL,
	`time_ms` integer NOT NULL,
	`moves` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "spielpause_results_game" CHECK("spielpause_results"."game" IN ('rubik')),
	CONSTRAINT "spielpause_results_values" CHECK("spielpause_results"."time_ms" > 0 AND "spielpause_results"."moves" > 0)
);
--> statement-breakpoint
CREATE INDEX `spielpause_results_best` ON `spielpause_results` (`campaign_id`,`member_id`,`game`,`time_ms`);--> statement-breakpoint
CREATE INDEX `spielpause_results_recent` ON `spielpause_results` (`campaign_id`,`member_id`,`created_at`);