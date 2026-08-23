CREATE TABLE `consideredProducts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`brand` varchar(120),
	`model` varchar(160),
	`category` varchar(80) NOT NULL,
	`estimatedPrice` decimal(12,2),
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`plannedOwnershipMonths` int,
	`expectedWarrantyMonths` int,
	`repairabilityNotes` text,
	`expectedResaleValue` decimal(12,2),
	`expectedResaleValueAtMonths` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consideredProducts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `consideredProducts` ADD CONSTRAINT `consideredProducts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `considered_products_user_idx` ON `consideredProducts` (`userId`);--> statement-breakpoint
CREATE INDEX `considered_products_category_idx` ON `consideredProducts` (`category`);