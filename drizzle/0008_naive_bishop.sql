ALTER TABLE `users` ADD `displayName` varchar(120);--> statement-breakpoint
ALTER TABLE `users` ADD `warrantyNotificationsEnabled` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `returnNotificationsEnabled` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `generalNotificationsEnabled` int DEFAULT 1 NOT NULL;