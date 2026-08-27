import { ENV } from "./_core/env";

// =============================================================================
// In-memory store (used when DATABASE_URL is not set)
// =============================================================================

interface MemUser {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

interface MemCase {
  id: string;
  title: string | null;
  classification: string;
  description: string | null;
  createdBy: string;
  status: "active" | "sealed" | "archived";
  createdAt: number;
  updatedAt: number;
}

interface MemInvestigator {
  id: string;
  displayName: string;
  badgeId: string;
  role: string;
  algorithm: string;
  publicKeyPem: string | null;
  keyFingerprint: string;
  createdAt: number;
}

interface MemEvidence {
  id: string;
  caseId: string;
  originalName: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  sha3_256: string;
  storageKey: string;
  storageUrl: string;
  tamperKind: string | null;
  tamperedStorageKey: string | null;
  tamperedStorageUrl: string | null;
  manifestJson: string;
  acquiredBy: string;
  acquisitionLocation: string;
  status: "verified" | "review" | "tampered" | "sealed";
  acquiredAt: number;
  createdAt: number;
}

interface MemCustodyEvent {
  id: string;
  evidenceId: string;
  caseId: string;
  sequenceNumber: number;
  actorId: string;
  action: string;
  location: string;
  rationale: string;
  transferStatus: string;
  recipientId: string | null;
  happenedAt: number;
  previousEventHash: string | null;
  eventRecordHash: string;
  canonicalPayload: string;
  signatureAlgorithm: string;
  signatureValue: string;
  signerPublicKeyPem: string | null;
  pqStatus: string;
  createdAt: number;
}

interface MemVerificationRun {
  id: string;
  evidenceId: string;
  executedAt: number;
  overallStatus: "pass" | "fail" | "review";
  findingsJson: string;
}

interface MemBenchmarkRun {
  id: string;
  createdBy: string;
  recordCount: number;
  repetitions: number;
  pqModeStatus: string;
  resultsJson: string;
  createdAt: number;
}

let _userIdCounter = 0;
const memStore = {
  users: [] as MemUser[],
  cases: [] as MemCase[],
  investigators: [] as MemInvestigator[],
  evidence: [] as MemEvidence[],
  custodyEvents: [] as MemCustodyEvent[],
  verificationRuns: [] as MemVerificationRun[],
  benchmarkRuns: [] as MemBenchmarkRun[],
};

function useMem(): boolean {
  return !process.env.DATABASE_URL;
}

function byId<T extends { id: string }>(arr: T[], id: string): T | undefined {
  return arr.find((r) => r.id === id);
}

// =============================================================================
// Drizzle ORM path (when DATABASE_URL is set)
// =============================================================================

import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  benchmarkRuns,
  custodyEvents,
  evidenceItems,
  forensicCases,
  investigators,
  InsertUser,
  users,
  verificationRuns,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// =============================================================================
// Unified API
// =============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  if (useMem()) {
    const existing = memStore.users.find((u) => u.openId === user.openId);
    const now = new Date();
    if (existing) {
      if (user.name !== undefined) existing.name = user.name ?? null;
      if (user.email !== undefined) existing.email = user.email ?? null;
      if (user.loginMethod !== undefined) existing.loginMethod = user.loginMethod ?? null;
      if (user.role !== undefined) existing.role = user.role;
      existing.lastSignedIn = user.lastSignedIn ?? now;
      existing.updatedAt = now;
    } else {
      memStore.users.push({
        id: ++_userIdCounter,
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
        createdAt: now,
        updatedAt: now,
        lastSignedIn: user.lastSignedIn ?? now,
      });
    }
    return;
  }

  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  if (useMem()) {
    return memStore.users.find((u) => u.openId === openId);
  }
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listCases() {
  if (useMem()) {
    return [...memStore.cases].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  const db = await requireDb();
  return db.select().from(forensicCases).orderBy(desc(forensicCases.updatedAt));
}

export async function getCase(caseId: string) {
  if (useMem()) {
    return byId(memStore.cases, caseId);
  }
  const db = await requireDb();
  const rows = await db.select().from(forensicCases).where(eq(forensicCases.id, caseId)).limit(1);
  return rows[0];
}

export async function createCase(values: typeof forensicCases.$inferInsert) {
  if (useMem()) {
    const record: MemCase = {
      id: values.id,
      title: values.title,
      classification: values.classification ?? "Synthetic demonstration",
      description: values.description ?? null,
      createdBy: values.createdBy,
      status: (values.status as MemCase["status"]) ?? "active",
      createdAt: values.createdAt as number,
      updatedAt: values.updatedAt as number,
    };
    memStore.cases.push(record);
    return record;
  }
  const db = await requireDb();
  await db.insert(forensicCases).values(values);
  return getCase(values.id);
}

export async function listInvestigators() {
  if (useMem()) {
    return [...memStore.investigators].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  const db = await requireDb();
  return db.select().from(investigators).orderBy(investigators.displayName);
}

export async function getInvestigator(investigatorId: string) {
  if (useMem()) {
    return byId(memStore.investigators, investigatorId);
  }
  const db = await requireDb();
  const rows = await db.select().from(investigators).where(eq(investigators.id, investigatorId)).limit(1);
  return rows[0];
}

export async function upsertInvestigator(values: typeof investigators.$inferInsert) {
  if (useMem()) {
    const existing = byId(memStore.investigators, values.id);
    if (existing) {
      existing.displayName = values.displayName;
      existing.role = values.role;
      existing.algorithm = values.algorithm ?? "ECDSA-P256";
      existing.publicKeyPem = values.publicKeyPem ?? null;
      existing.keyFingerprint = values.keyFingerprint;
    } else {
      memStore.investigators.push({
        id: values.id,
        displayName: values.displayName,
        badgeId: values.badgeId,
        role: values.role,
        algorithm: values.algorithm ?? "ECDSA-P256",
        publicKeyPem: values.publicKeyPem ?? null,
        keyFingerprint: values.keyFingerprint,
        createdAt: values.createdAt as number,
      });
    }
    return getInvestigator(values.id);
  }
  const db = await requireDb();
  await db.insert(investigators).values(values).onDuplicateKeyUpdate({
    set: {
      displayName: values.displayName,
      role: values.role,
      algorithm: values.algorithm,
      publicKeyPem: values.publicKeyPem,
      keyFingerprint: values.keyFingerprint,
    },
  });
  return getInvestigator(values.id);
}

export async function listEvidence(caseId?: string) {
  if (useMem()) {
    const items = caseId
      ? memStore.evidence.filter((e) => e.caseId === caseId)
      : memStore.evidence;
    return [...items].sort((a, b) => b.acquiredAt - a.acquiredAt);
  }
  const db = await requireDb();
  return caseId
    ? db.select().from(evidenceItems).where(eq(evidenceItems.caseId, caseId)).orderBy(desc(evidenceItems.acquiredAt))
    : db.select().from(evidenceItems).orderBy(desc(evidenceItems.acquiredAt));
}

export async function getEvidence(evidenceId: string) {
  if (useMem()) {
    return byId(memStore.evidence, evidenceId);
  }
  const db = await requireDb();
  const rows = await db.select().from(evidenceItems).where(eq(evidenceItems.id, evidenceId)).limit(1);
  return rows[0];
}

export async function createEvidence(values: typeof evidenceItems.$inferInsert) {
  if (useMem()) {
    const record: MemEvidence = {
      id: values.id,
      caseId: values.caseId,
      originalName: values.originalName,
      contentType: values.contentType,
      byteSize: values.byteSize,
      sha256: values.sha256,
      sha3_256: values.sha3_256,
      storageKey: values.storageKey,
      storageUrl: values.storageUrl,
      tamperKind: values.tamperKind ?? null,
      tamperedStorageKey: values.tamperedStorageKey ?? null,
      tamperedStorageUrl: values.tamperedStorageUrl ?? null,
      manifestJson: values.manifestJson,
      acquiredBy: values.acquiredBy,
      acquisitionLocation: values.acquisitionLocation,
      status: (values.status as MemEvidence["status"]) ?? "verified",
      acquiredAt: values.acquiredAt as number,
      createdAt: values.createdAt as number,
    };
    memStore.evidence.push(record);
    return record;
  }
  const db = await requireDb();
  await db.insert(evidenceItems).values(values);
  return getEvidence(values.id);
}

export async function updateEvidenceTamper(
  evidenceId: string,
  values: Pick<typeof evidenceItems.$inferInsert, "tamperKind" | "tamperedStorageKey" | "tamperedStorageUrl" | "status">,
) {
  if (useMem()) {
    const item = byId(memStore.evidence, evidenceId);
    if (item) {
      if (values.tamperKind !== undefined) item.tamperKind = values.tamperKind ?? null;
      if (values.tamperedStorageKey !== undefined) item.tamperedStorageKey = values.tamperedStorageKey ?? null;
      if (values.tamperedStorageUrl !== undefined) item.tamperedStorageUrl = values.tamperedStorageUrl ?? null;
      if (values.status !== undefined) item.status = values.status as MemEvidence["status"];
    }
    return item;
  }
  const db = await requireDb();
  await db.update(evidenceItems).set(values).where(eq(evidenceItems.id, evidenceId));
  return getEvidence(evidenceId);
}

export async function listCustodyEvents(evidenceId: string) {
  if (useMem()) {
    return memStore.custodyEvents
      .filter((e) => e.evidenceId === evidenceId)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }
  const db = await requireDb();
  return db.select().from(custodyEvents).where(eq(custodyEvents.evidenceId, evidenceId)).orderBy(custodyEvents.sequenceNumber);
}

export async function createCustodyEvent(values: typeof custodyEvents.$inferInsert) {
  if (useMem()) {
    const record: MemCustodyEvent = {
      id: values.id,
      evidenceId: values.evidenceId,
      caseId: values.caseId,
      sequenceNumber: values.sequenceNumber,
      actorId: values.actorId,
      action: values.action,
      location: values.location,
      rationale: values.rationale,
      transferStatus: values.transferStatus,
      recipientId: values.recipientId ?? null,
      happenedAt: values.happenedAt as number,
      previousEventHash: values.previousEventHash ?? null,
      eventRecordHash: values.eventRecordHash,
      canonicalPayload: values.canonicalPayload,
      signatureAlgorithm: values.signatureAlgorithm,
      signatureValue: values.signatureValue,
      signerPublicKeyPem: values.signerPublicKeyPem ?? null,
      pqStatus: values.pqStatus,
      createdAt: values.createdAt as number,
    };
    memStore.custodyEvents.push(record);
    return values;
  }
  const db = await requireDb();
  await db.insert(custodyEvents).values(values);
  return values;
}

export async function createVerificationRun(values: typeof verificationRuns.$inferInsert) {
  if (useMem()) {
    memStore.verificationRuns.push({
      id: values.id,
      evidenceId: values.evidenceId,
      executedAt: values.executedAt as number,
      overallStatus: values.overallStatus as MemVerificationRun["overallStatus"],
      findingsJson: values.findingsJson,
    });
    return values;
  }
  const db = await requireDb();
  await db.insert(verificationRuns).values(values);
  return values;
}

export async function getLatestVerification(evidenceId: string) {
  if (useMem()) {
    return memStore.verificationRuns
      .filter((v) => v.evidenceId === evidenceId)
      .sort((a, b) => b.executedAt - a.executedAt)[0];
  }
  const db = await requireDb();
  const rows = await db.select().from(verificationRuns).where(eq(verificationRuns.evidenceId, evidenceId)).orderBy(desc(verificationRuns.executedAt)).limit(1);
  return rows[0];
}

export async function createBenchmarkRun(values: typeof benchmarkRuns.$inferInsert) {
  if (useMem()) {
    memStore.benchmarkRuns.push({
      id: values.id,
      createdBy: values.createdBy,
      recordCount: values.recordCount,
      repetitions: values.repetitions,
      pqModeStatus: values.pqModeStatus,
      resultsJson: values.resultsJson,
      createdAt: values.createdAt as number,
    });
    return values;
  }
  const db = await requireDb();
  await db.insert(benchmarkRuns).values(values);
  return values;
}

export async function listBenchmarkRuns() {
  if (useMem()) {
    return [...memStore.benchmarkRuns].sort((a, b) => b.createdAt - a.createdAt);
  }
  const db = await requireDb();
  return db.select().from(benchmarkRuns).orderBy(desc(benchmarkRuns.createdAt));
}

const DEMO_CASE_ID = "case_synthetic_crimson";

export async function resetAllDemoData() {
  if (useMem()) {
    memStore.evidence = memStore.evidence.filter((e) => e.caseId !== DEMO_CASE_ID);
    memStore.custodyEvents = memStore.custodyEvents.filter((e) => e.caseId !== DEMO_CASE_ID);
    memStore.verificationRuns = [];
    memStore.benchmarkRuns = [];
    memStore.cases = memStore.cases.filter((c) => c.id !== DEMO_CASE_ID);
    return;
  }
  const db = await requireDb();
  const demoEvidence = await db.select({ id: evidenceItems.id }).from(evidenceItems).where(eq(evidenceItems.caseId, DEMO_CASE_ID));
  const evidenceIds = demoEvidence.map((e) => e.id);
  for (const eid of evidenceIds) {
    await db.delete(custodyEvents).where(eq(custodyEvents.evidenceId, eid));
    await db.delete(verificationRuns).where(eq(verificationRuns.evidenceId, eid));
  }
  await db.delete(evidenceItems).where(eq(evidenceItems.caseId, DEMO_CASE_ID));
  await db.delete(forensicCases).where(eq(forensicCases.id, DEMO_CASE_ID));
  await db.delete(benchmarkRuns);
}

export async function getDashboardSummary() {
  const [cases, evidence, latestRuns, benchmarks] = await Promise.all([
    listCases(),
    listEvidence(),
    listBenchmarkRuns(),
    listBenchmarkRuns(),
  ]);
  return {
    caseCount: cases.length,
    evidenceCount: evidence.length,
    verifiedCount: evidence.filter((item: { status: string }) => item.status === "verified" || item.status === "sealed").length,
    reviewCount: evidence.filter((item: { status: string }) => item.status === "review" || item.status === "tampered").length,
    recentCases: cases.slice(0, 4),
    recentEvidence: evidence.slice(0, 5),
    latestBenchmark: benchmarks[0] ?? null,
    latestRunCount: latestRuns.length,
  };
}

function requireDb(): ReturnType<typeof drizzle> {
  if (!process.env.DATABASE_URL) {
    throw new Error("Database is not available for this operation.");
  }
  if (!_db) {
    _db = drizzle(process.env.DATABASE_URL);
  }
  return _db;
}
