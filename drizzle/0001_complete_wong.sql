CREATE TABLE `benchmarkRuns` (
	`id` varchar(48) NOT NULL,
	`createdBy` varchar(64) NOT NULL,
	`recordCount` int NOT NULL,
	`repetitions` int NOT NULL,
	`pqModeStatus` varchar(180) NOT NULL,
	`resultsJson` text NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `benchmarkRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custodyEvents` (
	`id` varchar(48) NOT NULL,
	`evidenceId` varchar(48) NOT NULL,
	`caseId` varchar(48) NOT NULL,
	`sequenceNumber` int NOT NULL,
	`actorId` varchar(48) NOT NULL,
	`action` varchar(120) NOT NULL,
	`location` varchar(255) NOT NULL,
	`rationale` text NOT NULL,
	`transferStatus` varchar(120) NOT NULL,
	`recipientId` varchar(48),
	`happenedAt` bigint NOT NULL,
	`previousEventHash` varchar(128),
	`eventRecordHash` varchar(128) NOT NULL,
	`canonicalPayload` text NOT NULL,
	`signatureAlgorithm` varchar(64) NOT NULL,
	`signatureValue` text NOT NULL,
	`pqStatus` varchar(160) NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `custodyEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `custody_event_sequence_unique` UNIQUE(`evidenceId`,`sequenceNumber`)
);
--> statement-breakpoint
CREATE TABLE `evidenceItems` (
	`id` varchar(48) NOT NULL,
	`caseId` varchar(48) NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`contentType` varchar(160) NOT NULL,
	`byteSize` int NOT NULL,
	`sha256` varchar(64) NOT NULL,
	`sha3_256` varchar(64) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(700) NOT NULL,
	`manifestJson` text NOT NULL,
	`acquiredBy` varchar(48) NOT NULL,
	`acquisitionLocation` varchar(255) NOT NULL,
	`status` enum('verified','review','tampered','sealed') NOT NULL DEFAULT 'verified',
	`acquiredAt` bigint NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `evidenceItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forensicCases` (
	`id` varchar(48) NOT NULL,
	`title` varchar(255) NOT NULL,
	`classification` varchar(64) NOT NULL DEFAULT 'Synthetic demonstration',
	`description` text,
	`createdBy` varchar(64) NOT NULL,
	`status` enum('active','sealed','archived') NOT NULL DEFAULT 'active',
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `forensicCases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `investigators` (
	`id` varchar(48) NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`badgeId` varchar(80) NOT NULL,
	`role` varchar(120) NOT NULL,
	`algorithm` varchar(48) NOT NULL DEFAULT 'ECDSA-P256',
	`publicKeyPem` text,
	`keyFingerprint` varchar(96) NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `investigators_id` PRIMARY KEY(`id`),
	CONSTRAINT `investigators_badge_unique` UNIQUE(`badgeId`)
);
--> statement-breakpoint
CREATE TABLE `verificationRuns` (
	`id` varchar(48) NOT NULL,
	`evidenceId` varchar(48) NOT NULL,
	`executedAt` bigint NOT NULL,
	`overallStatus` enum('pass','fail','review') NOT NULL,
	`findingsJson` text NOT NULL,
	CONSTRAINT `verificationRuns_id` PRIMARY KEY(`id`)
);
