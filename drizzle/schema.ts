import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, unique, varchar } from "drizzle-orm/mysql-core";

/** Core user table backing the existing Manus OAuth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const forensicCases = mysqlTable("forensicCases", {
  id: varchar("id", { length: 48 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  classification: varchar("classification", { length: 64 }).notNull().default("Synthetic demonstration"),
  description: text("description"),
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["active", "sealed", "archived"]).notNull().default("active"),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});

export const investigators = mysqlTable("investigators", {
  id: varchar("id", { length: 48 }).primaryKey(),
  displayName: varchar("displayName", { length: 160 }).notNull(),
  badgeId: varchar("badgeId", { length: 80 }).notNull(),
  role: varchar("role", { length: 120 }).notNull(),
  algorithm: varchar("algorithm", { length: 48 }).notNull().default("ECDSA-P256"),
  publicKeyPem: text("publicKeyPem"),
  keyFingerprint: varchar("keyFingerprint", { length: 96 }).notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
}, (table) => [unique("investigators_badge_unique").on(table.badgeId)]);

export const evidenceItems = mysqlTable("evidenceItems", {
  id: varchar("id", { length: 48 }).primaryKey(),
  caseId: varchar("caseId", { length: 48 }).notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  contentType: varchar("contentType", { length: 160 }).notNull(),
  byteSize: int("byteSize").notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  sha3_256: varchar("sha3_256", { length: 64 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 700 }).notNull(),
  tamperKind: varchar("tamperKind", { length: 64 }),
  tamperedStorageKey: varchar("tamperedStorageKey", { length: 512 }),
  tamperedStorageUrl: varchar("tamperedStorageUrl", { length: 700 }),
  manifestJson: text("manifestJson").notNull(),
  acquiredBy: varchar("acquiredBy", { length: 48 }).notNull(),
  acquisitionLocation: varchar("acquisitionLocation", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["verified", "review", "tampered", "sealed"]).notNull().default("verified"),
  acquiredAt: bigint("acquiredAt", { mode: "number" }).notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
});

export const custodyEvents = mysqlTable("custodyEvents", {
  id: varchar("id", { length: 48 }).primaryKey(),
  evidenceId: varchar("evidenceId", { length: 48 }).notNull(),
  caseId: varchar("caseId", { length: 48 }).notNull(),
  sequenceNumber: int("sequenceNumber").notNull(),
  actorId: varchar("actorId", { length: 48 }).notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  rationale: text("rationale").notNull(),
  transferStatus: varchar("transferStatus", { length: 120 }).notNull(),
  recipientId: varchar("recipientId", { length: 48 }),
  happenedAt: bigint("happenedAt", { mode: "number" }).notNull(),
  previousEventHash: varchar("previousEventHash", { length: 128 }),
  eventRecordHash: varchar("eventRecordHash", { length: 128 }).notNull(),
  canonicalPayload: text("canonicalPayload").notNull(),
  signatureAlgorithm: varchar("signatureAlgorithm", { length: 64 }).notNull(),
  signatureValue: text("signatureValue").notNull(),
  signerPublicKeyPem: text("signerPublicKeyPem"),
  pqStatus: varchar("pqStatus", { length: 160 }).notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
}, (table) => [unique("custody_event_sequence_unique").on(table.evidenceId, table.sequenceNumber)]);

export const verificationRuns = mysqlTable("verificationRuns", {
  id: varchar("id", { length: 48 }).primaryKey(),
  evidenceId: varchar("evidenceId", { length: 48 }).notNull(),
  executedAt: bigint("executedAt", { mode: "number" }).notNull(),
  overallStatus: mysqlEnum("overallStatus", ["pass", "fail", "review"]).notNull(),
  findingsJson: text("findingsJson").notNull(),
});

export const benchmarkRuns = mysqlTable("benchmarkRuns", {
  id: varchar("id", { length: 48 }).primaryKey(),
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  recordCount: int("recordCount").notNull(),
  repetitions: int("repetitions").notNull(),
  pqModeStatus: varchar("pqModeStatus", { length: 180 }).notNull(),
  resultsJson: text("resultsJson").notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ForensicCase = typeof forensicCases.$inferSelect;
export type Investigator = typeof investigators.$inferSelect;
export type EvidenceItem = typeof evidenceItems.$inferSelect;
export type CustodyEvent = typeof custodyEvents.$inferSelect;
