ALTER TABLE `documents` MODIFY COLUMN `documentType` enum('invoice','receipt','warranty','service_record','manual','order_confirmation','other') NOT NULL DEFAULT 'other';--> statement-breakpoint
ALTER TABLE `ownershipEvents` MODIFY COLUMN `eventType` enum('purchased','return_window_started','return_window_ended','warranty_started','warranty_expiring','warranty_expired','service_requested','repaired','replaced','resold','product_created','product_updated','purchase_recorded','document_added','service_recorded','reminder_dismissed') NOT NULL;--> statement-breakpoint
ALTER TABLE `serviceRecords` MODIFY COLUMN `status` enum('reported','claim_preparing','submitted','in_progress','resolved','open','scheduled','completed','cancelled') NOT NULL DEFAULT 'reported';--> statement-breakpoint
ALTER TABLE `documents` ADD `fileName` varchar(255);--> statement-breakpoint
ALTER TABLE `documents` ADD `fileType` varchar(120);--> statement-breakpoint
ALTER TABLE `documents` ADD `uploadedAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `ownershipEvents` ADD `title` varchar(255);--> statement-breakpoint
ALTER TABLE `ownershipEvents` ADD `eventDate` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `description` text;--> statement-breakpoint
ALTER TABLE `products` ADD `invoiceNumber` varchar(160);--> statement-breakpoint
ALTER TABLE `reminders` ADD `title` varchar(255);--> statement-breakpoint
ALTER TABLE `reminders` ADD `message` text;--> statement-breakpoint
ALTER TABLE `reminders` ADD `isRead` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reminders` ADD `isCompleted` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `serviceRecords` ADD `requestedAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `serviceRecords` ADD `resolvedAt` timestamp;