ALTER TABLE `products` MODIFY COLUMN `warrantyExpiresAt` date;--> statement-breakpoint
ALTER TABLE `products` MODIFY COLUMN `returnExpiresAt` date;--> statement-breakpoint
ALTER TABLE `products` ADD `warrantyStartsAt` date;--> statement-breakpoint
ALTER TABLE `products` ADD `returnStartsAt` date;--> statement-breakpoint
ALTER TABLE `reminders` ADD `attentionKind` enum('warranty_expiring','return_ending','missing_invoice','warranty_review','return_review','custom');--> statement-breakpoint
ALTER TABLE `reminders` ADD `dueDate` date;