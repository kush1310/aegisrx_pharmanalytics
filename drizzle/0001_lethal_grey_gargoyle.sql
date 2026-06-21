ALTER TABLE `Doctor` ADD `spouseBirthDate` text;--> statement-breakpoint
ALTER TABLE `Doctor` ADD `childrenBirthDates` text;--> statement-breakpoint
ALTER TABLE `Doctor` ADD `hospitalName` text;--> statement-breakpoint
ALTER TABLE `Doctor` ADD `hospitalOpeningDate` text;--> statement-breakpoint
ALTER TABLE `Doctor` ADD `hospitalsCount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `Doctor` ADD `hospitalNames` text;--> statement-breakpoint
ALTER TABLE `Doctor` ADD `hospitalOpeningDates` text;--> statement-breakpoint
ALTER TABLE `Notification` ADD `isCleared` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `Pharmacy` ADD `primaryContact` text;--> statement-breakpoint
ALTER TABLE `Pharmacy` ADD `secondaryContact` text;