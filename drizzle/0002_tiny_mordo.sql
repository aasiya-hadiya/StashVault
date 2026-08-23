ALTER TABLE `ownershipEvents` MODIFY COLUMN `eventType` enum('purchased','return_window_started','return_window_ended','warranty_started','warranty_expiring','warranty_expired','service_requested','repaired','replaced','resold','product_created','product_updated','purchase_recorded','document_added','document_deleted','service_recorded','reminder_dismissed') NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `processingStatus` enum('not_requested','queued','processing','completed','failed') DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `extractedData` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `extractionConfidence` decimal(5,2);--> statement-breakpoint
ALTER TABLE `documents` ADD `processedAt` timestamp;