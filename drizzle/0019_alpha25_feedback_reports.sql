CREATE TABLE `feedback_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`kind` text NOT NULL,
	`area` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`steps` text DEFAULT '' NOT NULL,
	`expected` text DEFAULT '' NOT NULL,
	`actual` text DEFAULT '' NOT NULL,
	`page` text DEFAULT '' NOT NULL,
	`app_version` text NOT NULL,
	`browser` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'eingegangen' NOT NULL,
	`severity` text,
	`operator_note` text DEFAULT '' NOT NULL,
	`reply` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "feedback_reports_kind" CHECK("feedback_reports"."kind" IN ('fehler','idee','allgemein')),
	CONSTRAINT "feedback_reports_status_values" CHECK("feedback_reports"."status" IN ('eingegangen','in_pruefung','erledigt','abgelehnt'))
);
--> statement-breakpoint
CREATE INDEX `feedback_reports_reporter` ON `feedback_reports` (`campaign_id`,`reporter_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `feedback_reports_status` ON `feedback_reports` (`campaign_id`,`status`,`created_at`);