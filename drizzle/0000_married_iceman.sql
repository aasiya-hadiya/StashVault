CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` int,
	`name` varchar(255) NOT NULL,
	`documentType` enum('receipt','warranty','manual','order_confirmation','other') NOT NULL DEFAULT 'other',
	`fileKey` varchar(1024) NOT NULL,
	`fileUrl` varchar(2048),
	`mimeType` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ownershipEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` int NOT NULL,
	`eventType` enum('product_created','product_updated','purchase_recorded','document_added','service_recorded','reminder_dismissed') NOT NULL,
	`description` varchar(500) NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ownershipEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`brand` varchar(120),
	`model` varchar(160),
	`category` varchar(80) NOT NULL,
	`purchasePrice` decimal(12,2),
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`purchasedAt` timestamp,
	`purchasedFrom` varchar(255),
	`serialNumber` varchar(160),
	`notes` text,
	`warrantyMonths` int,
	`warrantyExpiresAt` timestamp,
	`returnPeriodDays` int,
	`returnExpiresAt` timestamp,
	`imageUrl` varchar(2048),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` int NOT NULL,
	`reminderType` enum('warranty','return','service','custom') NOT NULL,
	`remindAt` timestamp NOT NULL,
	`status` enum('active','dismissed','sent') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `serviceRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` int NOT NULL,
	`provider` varchar(255),
	`issue` varchar(500) NOT NULL,
	`status` enum('open','scheduled','completed','cancelled') NOT NULL DEFAULT 'open',
	`cost` decimal(12,2),
	`servicedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `serviceRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ownershipEvents` ADD CONSTRAINT `ownershipEvents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ownershipEvents` ADD CONSTRAINT `ownershipEvents_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reminders` ADD CONSTRAINT `reminders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reminders` ADD CONSTRAINT `reminders_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `serviceRecords` ADD CONSTRAINT `serviceRecords_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `serviceRecords` ADD CONSTRAINT `serviceRecords_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `documents_user_idx` ON `documents` (`userId`);--> statement-breakpoint
CREATE INDEX `documents_product_idx` ON `documents` (`productId`);--> statement-breakpoint
CREATE INDEX `ownership_events_user_idx` ON `ownershipEvents` (`userId`);--> statement-breakpoint
CREATE INDEX `ownership_events_product_idx` ON `ownershipEvents` (`productId`);--> statement-breakpoint
CREATE INDEX `products_user_idx` ON `products` (`userId`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category`);--> statement-breakpoint
CREATE INDEX `products_warranty_expiry_idx` ON `products` (`warrantyExpiresAt`);--> statement-breakpoint
CREATE INDEX `reminders_user_idx` ON `reminders` (`userId`);--> statement-breakpoint
CREATE INDEX `reminders_product_idx` ON `reminders` (`productId`);--> statement-breakpoint
CREATE INDEX `reminders_due_idx` ON `reminders` (`remindAt`);--> statement-breakpoint
CREATE INDEX `service_records_user_idx` ON `serviceRecords` (`userId`);--> statement-breakpoint
CREATE INDEX `service_records_product_idx` ON `serviceRecords` (`productId`);