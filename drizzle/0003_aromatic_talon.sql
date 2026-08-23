ALTER TABLE `documents` ADD `extractionModel` varchar(120);--> statement-breakpoint
ALTER TABLE `documents` ADD `extractionError` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `extractionReviewedAt` timestamp;