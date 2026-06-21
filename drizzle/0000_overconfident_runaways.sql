CREATE TABLE `DismissedNotification` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entityType` text NOT NULL,
	`entityId` integer NOT NULL,
	`eventType` text NOT NULL,
	`eventDate` text NOT NULL,
	`dismissedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DismissedNotification_entityId_entityType_eventType_eventDate_unique` ON `DismissedNotification` (`entityId`,`entityType`,`eventType`,`eventDate`);--> statement-breakpoint
CREATE TABLE `DoctorProduct` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`doctorId` integer NOT NULL,
	`productId` integer NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`doctorId`) REFERENCES `Doctor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dp_doctor_idx` ON `DoctorProduct` (`doctorId`);--> statement-breakpoint
CREATE INDEX `dp_product_idx` ON `DoctorProduct` (`productId`);--> statement-breakpoint
CREATE UNIQUE INDEX `DoctorProduct_doctorId_productId_unique` ON `DoctorProduct` (`doctorId`,`productId`);--> statement-breakpoint
CREATE TABLE `Doctor` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`contact` text NOT NULL,
	`address` text NOT NULL,
	`birthDate` text,
	`isMarried` integer DEFAULT false NOT NULL,
	`spouseName` text,
	`anniversary` text,
	`childrenCount` integer DEFAULT 0 NOT NULL,
	`childrenNames` text,
	`qualification` text NOT NULL,
	`specialization` text NOT NULL,
	`email` text,
	`registrationNo` text,
	`experienceYrs` integer,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `doctor_name_idx` ON `Doctor` (`name`);--> statement-breakpoint
CREATE INDEX `doctor_contact_idx` ON `Doctor` (`contact`);--> statement-breakpoint
CREATE INDEX `doctor_created_idx` ON `Doctor` (`createdAt`);--> statement-breakpoint
CREATE TABLE `ExcelUpload` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fileName` text NOT NULL,
	`fileHash` text NOT NULL,
	`fileSize` integer NOT NULL,
	`fileData` blob NOT NULL,
	`uploadDate` text DEFAULT (datetime('now')) NOT NULL,
	`status` text DEFAULT 'PROCESSED' NOT NULL,
	`format` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ExcelUpload_fileHash_unique` ON `ExcelUpload` (`fileHash`);--> statement-breakpoint
CREATE TABLE `Notification` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entityType` text NOT NULL,
	`entityId` integer NOT NULL,
	`eventType` text NOT NULL,
	`eventDate` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`isRead` integer DEFAULT false NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Pharmacy` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`ownerName` text NOT NULL,
	`licenseId` text NOT NULL,
	`gstNumber` text,
	`drugLicense` text,
	`address` text NOT NULL,
	`contact` text NOT NULL,
	`ownerBirthDate` text,
	`doctorId` integer,
	`isDraft` integer DEFAULT false NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`doctorId`) REFERENCES `Doctor`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Pharmacy_licenseId_unique` ON `Pharmacy` (`licenseId`);--> statement-breakpoint
CREATE INDEX `pharmacy_name_idx` ON `Pharmacy` (`name`);--> statement-breakpoint
CREATE INDEX `pharmacy_license_idx` ON `Pharmacy` (`licenseId`);--> statement-breakpoint
CREATE INDEX `pharmacy_created_idx` ON `Pharmacy` (`createdAt`);--> statement-breakpoint
CREATE TABLE `PharmacyProduct` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pharmacyId` integer NOT NULL,
	`productId` integer NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`pharmacyId`) REFERENCES `Pharmacy`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pp_pharmacy_idx` ON `PharmacyProduct` (`pharmacyId`);--> statement-breakpoint
CREATE INDEX `pp_product_idx` ON `PharmacyProduct` (`productId`);--> statement-breakpoint
CREATE UNIQUE INDEX `PharmacyProduct_pharmacyId_productId_unique` ON `PharmacyProduct` (`pharmacyId`,`productId`);--> statement-breakpoint
CREATE TABLE `Product` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`pack` text,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `product_name_idx` ON `Product` (`name`);--> statement-breakpoint
CREATE INDEX `product_created_idx` ON `Product` (`createdAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `Product_name_pack_unique` ON `Product` (`name`,`pack`);--> statement-breakpoint
CREATE TABLE `SalesTransaction` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pharmacyId` integer NOT NULL,
	`productId` integer NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`saleQty` integer DEFAULT 0 NOT NULL,
	`freeQty` integer DEFAULT 0 NOT NULL,
	`freeAmt` real DEFAULT 0 NOT NULL,
	`date` text NOT NULL,
	`uploadId` integer,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`pharmacyId`) REFERENCES `Pharmacy`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploadId`) REFERENCES `ExcelUpload`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sales_pharmacy_idx` ON `SalesTransaction` (`pharmacyId`);--> statement-breakpoint
CREATE INDEX `sales_product_idx` ON `SalesTransaction` (`productId`);--> statement-breakpoint
CREATE INDEX `sales_date_idx` ON `SalesTransaction` (`date`);--> statement-breakpoint
CREATE TABLE `User` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`prefix` text DEFAULT 'Mr.' NOT NULL,
	`firstName` text DEFAULT '' NOT NULL,
	`lastName` text DEFAULT '' NOT NULL,
	`birthDate` text,
	`email` text NOT NULL,
	`passwordHash` text NOT NULL,
	`role` text DEFAULT 'ADMIN' NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `User_username_unique` ON `User` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_unique` ON `User` (`email`);