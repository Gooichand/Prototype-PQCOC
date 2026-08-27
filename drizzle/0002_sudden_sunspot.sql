ALTER TABLE `evidenceItems` ADD `tamperKind` varchar(64);--> statement-breakpoint
ALTER TABLE `evidenceItems` ADD `tamperedStorageKey` varchar(512);--> statement-breakpoint
ALTER TABLE `evidenceItems` ADD `tamperedStorageUrl` varchar(700);