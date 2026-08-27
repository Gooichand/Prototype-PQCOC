import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import {
  createEcdsaIdentity,
  getPqCapability,
  measureEcdsaBenchmark,
  MLDSA_DISCLOSURE_TEXT,
  resetEphemeralKeys,
  sha3_256,
  sha256,
  signEcdsa,
  stableJson,
  verifyEcdsa,
} from "../forensicCore";
import { resolveStorageReadUrl, storageGetSignedUrl, storagePut } from "../storage";
import { publicProcedure, router, investigatorProcedure, examinerProcedure, reviewerProcedure, multiRoleProcedure } from "../_core/trpc";

const DEMO_CASE_ID = "case_synthetic_crimson";
const ANALYST_ID = "inv_analyst_aria";
const CUSTODIAN_ID = "inv_custodian_noah";
const demoOwner = "public-demo-session";
const now = () => Date.now();
const makeId = (prefix: string) => `${prefix}_${nanoid(16)}`;
const permittedImageContentTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const permittedCopyContentTypes = ["text/plain", "application/pdf", ...permittedImageContentTypes] as const;

function hasExpectedImageSignature(contentType: (typeof permittedImageContentTypes)[number], bytes: Buffer) {
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === "image/gif") return bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"));
  return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

function eventPayload(input: {
  id: string; evidenceId: string; caseId: string; sequenceNumber: number; actorId: string;
  action: string; location: string; rationale: string; transferStatus: string; recipientId: string | null;
  happenedAt: number; previousEventHash: string | null;
}) {
  return stableJson(input);
}

async function assertDemoEvidence(evidenceId: string) {
  const evidence = await db.getEvidence(evidenceId);
  if (!evidence) throw new TRPCError({ code: "NOT_FOUND", message: "Evidence item not found." });
  const caseRecord = await db.getCase(evidence.caseId);
  if (!caseRecord || caseRecord.classification !== "Synthetic demonstration") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Tamper actions are restricted to explicitly synthetic demo evidence." });
  }
  return evidence;
}

async function addSignedEvent(input: {
  evidenceId: string; caseId: string; actorId: string; action: string; location: string;
  rationale: string; transferStatus: string; recipientId?: string | null; happenedAt?: number;
}) {
  const events = await db.listCustodyEvents(input.evidenceId);
  const record = {
    id: makeId("evt"),
    evidenceId: input.evidenceId,
    caseId: input.caseId,
    sequenceNumber: events.length + 1,
    actorId: input.actorId,
    action: input.action,
    location: input.location,
    rationale: input.rationale,
    transferStatus: input.transferStatus,
    recipientId: input.recipientId ?? null,
    happenedAt: input.happenedAt ?? now(),
    previousEventHash: events.at(-1)?.eventRecordHash ?? null,
  };
  const canonicalPayload = eventPayload(record);
  const eventRecordHash = sha3_256(canonicalPayload);
  const signingKey = createEcdsaIdentity(record.actorId);
  const signatureValue = signEcdsa(record.actorId, canonicalPayload);
  await db.createCustodyEvent({
    ...record,
    canonicalPayload,
    eventRecordHash,
    signatureAlgorithm: "ECDSA-P256 / SHA-256",
    signatureValue,
    signerPublicKeyPem: signingKey.publicKeyPem,
    pqStatus: getPqCapability().status,
    createdAt: now(),
  });
}

export const MLDSA_UNAVAILABLE_TEXT = MLDSA_DISCLOSURE_TEXT;

/** Idempotent demo seed: all content is synthetic and the generated artifact lives in object storage. */
export async function seedDemoData() {
  const existing = await db.getCase(DEMO_CASE_ID);
  if (existing) return existing;
  return seedDemoDataFresh();
}

/** Creates a predictable clean demo from scratch. Used by resetPresentationDemo and initial seed. */
export async function seedDemoDataFresh() {
  resetEphemeralKeys();
  const seedTime = 1730000000000;
  const analystKey = createEcdsaIdentity(ANALYST_ID);
  const custodianKey = createEcdsaIdentity(CUSTODIAN_ID);
  await db.upsertInvestigator({
    id: ANALYST_ID, displayName: "Aria Rahman", badgeId: "PFV-042", role: "Forensic Acquisition Analyst",
    algorithm: "ECDSA-P256", publicKeyPem: analystKey.publicKeyPem, keyFingerprint: analystKey.fingerprint, createdAt: seedTime,
  });
  await db.upsertInvestigator({
    id: CUSTODIAN_ID, displayName: "Noah Mensah", badgeId: "PFV-118", role: "Evidence Custodian",
    algorithm: "ECDSA-P256", publicKeyPem: custodianKey.publicKeyPem, keyFingerprint: custodianKey.fingerprint, createdAt: seedTime,
  });
  await db.createCase({
    id: DEMO_CASE_ID,
    title: "SYN-24-017 · Crimson Relay",
    classification: "Synthetic demonstration",
    description: "Training-only case holding a generated text artifact. It is not legal evidence and is safe for controlled tamper demonstrations.",
    createdBy: demoOwner,
    status: "active",
    createdAt: seedTime,
    updatedAt: seedTime,
  });
  const evidenceId = "evi_synthetic_manifest";
  const artifact = Buffer.from("PQ-ForensicVault synthetic evidence artifact\nCase: SYN-24-017\nPurpose: academic proof-of-concept training only\n", "utf8");
  const storage = await storagePut("forensic-demo/SYN-24-017/evidence-manifest.txt", artifact, "text/plain");
  const manifest = stableJson({
    evidenceId,
    caseId: DEMO_CASE_ID,
    filename: "synthetic-evidence-manifest.txt",
    contentType: "text/plain",
    byteSize: artifact.byteLength,
    sha256: sha256(artifact),
    sha3_256: sha3_256(artifact),
    acquiredAt: seedTime,
    declaration: "Generated training artifact; not real seized data.",
  });
  await db.createEvidence({
    id: evidenceId, caseId: DEMO_CASE_ID, originalName: "synthetic-evidence-manifest.txt", contentType: "text/plain",
    byteSize: artifact.byteLength, sha256: sha256(artifact), sha3_256: sha3_256(artifact),
    storageKey: storage.key, storageUrl: storage.url, manifestJson: manifest, acquiredBy: ANALYST_ID,
    acquisitionLocation: "Training Lab · Intake Station A", status: "verified", acquiredAt: seedTime, createdAt: seedTime,
  });
  await addSignedEvent({
    evidenceId, caseId: DEMO_CASE_ID, actorId: ANALYST_ID, action: "Acquired generated training artifact",
    location: "Training Lab · Intake Station A", rationale: "Initial synthetic evidence capture for proof-of-concept validation.",
    transferStatus: "In analyst custody", happenedAt: seedTime,
  });
  return await db.getCase(DEMO_CASE_ID);
}

async function verifyEvidence(
  evidenceId: string,
  options: { ledgerCopyTampered?: boolean; useTamperedArtifact?: boolean; appOrigin?: string } = {},
) {
  const evidence = await db.getEvidence(evidenceId);
  if (!evidence) throw new TRPCError({ code: "NOT_FOUND", message: "Evidence item not found." });
  const targetKey = options.useTamperedArtifact && evidence.tamperKind && evidence.tamperedStorageKey
    ? evidence.tamperedStorageKey
    : evidence.storageKey;
  const signedUrl = await storageGetSignedUrl(targetKey);
  const absoluteUrl = resolveStorageReadUrl(signedUrl, options.appOrigin);
  const response = await fetch(absoluteUrl);
  if (!response.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stored evidence artifact could not be read for independent verification." });
  const artifact = Buffer.from(await response.arrayBuffer());
  const calculatedSha256 = sha256(artifact);
  const calculatedSha3 = sha3_256(artifact);
  const artifactSha256 = calculatedSha256 === evidence.sha256;
  const artifactSha3 = calculatedSha3 === evidence.sha3_256;
  const events = await db.listCustodyEvents(evidenceId);
  const ledgerFindings = [] as Array<{ sequence: number; hashValid: boolean; linkValid: boolean; signatureValid: boolean; previousEventHashValid: boolean }>;
  let priorHash: string | null = null;
  for (const sourceEvent of events) {
    const event = options.ledgerCopyTampered && sourceEvent.sequenceNumber === events.length
      ? { ...sourceEvent, canonicalPayload: `${sourceEvent.canonicalPayload}--demo-copy-tamper` }
      : sourceEvent;
    const actor = await db.getInvestigator(event.actorId);
    const previousEventHashValid = event.previousEventHash === priorHash;
    const hashValid = sha3_256(event.canonicalPayload) === event.eventRecordHash;
    const signatureValid = verifyEcdsa(event.signerPublicKeyPem ?? actor?.publicKeyPem ?? null, event.canonicalPayload, event.signatureValue);
    ledgerFindings.push({
      sequence: event.sequenceNumber,
      hashValid,
      linkValid: previousEventHashValid,
      signatureValid,
      previousEventHashValid,
    });
    priorHash = sourceEvent.eventRecordHash;
  }
  const ledgerValid = ledgerFindings.every((finding) => finding.hashValid && finding.linkValid && finding.signatureValid);
  const eventHashesValid = ledgerFindings.every((finding) => finding.hashValid);
  const signaturesValid = ledgerFindings.every((finding) => finding.signatureValid);
  const continuityValid = ledgerFindings.every((finding) => finding.linkValid);
  const pqCapability = getPqCapability();
  const findings = {
    artifact: {
      sha256Match: artifactSha256,
      sha3_256Match: artifactSha3,
      calculatedSha256,
      calculatedSha3_256: calculatedSha3,
      storedSha256: evidence.sha256,
      storedSha3_256: evidence.sha3_256,
      byteSize: artifact.byteLength,
      source: options.useTamperedArtifact ? "controlled synthetic copy" : "immutable original reference",
    },
    signatures: { algorithm: "ECDSA-P256 / SHA-256", passed: signaturesValid, totalEvents: events.length, validSignatures: ledgerFindings.filter((f) => f.signatureValid).length },
    continuity: { eventCount: events.length, passed: continuityValid, linkedEvents: ledgerFindings.filter((f) => f.linkValid).length, ledgerFindings },
    eventHashes: { passed: eventHashesValid, totalEvents: events.length, validHashes: ledgerFindings.filter((f) => f.hashValid).length },
    pqCapability,
    limitations: "This proof-of-concept verifies technical integrity indicators. It does not determine legal admissibility.",
  };
  const overallStatus = artifactSha256 && artifactSha3 && ledgerValid ? "pass" as const : "fail" as const;
  await db.createVerificationRun({ id: makeId("ver"), evidenceId, executedAt: now(), overallStatus, findingsJson: JSON.stringify(findings) });
  return { evidence, overallStatus, findings };
}

export const forensicRouter = router({
  seedDemo: publicProcedure.mutation(async () => seedDemoData()),
  capability: publicProcedure.query(() => getPqCapability()),
  resetPresentationDemo: reviewerProcedure.mutation(async () => {
    await db.resetAllDemoData();
    resetEphemeralKeys();
    const caseRecord = await seedDemoDataFresh();
    const evidence = await db.listEvidence(caseRecord?.id);
    return { caseRecord, evidence, message: "Presentation demo reset complete. Predictable synthetic case and artifact restored." };
  }),
  dashboard: reviewerProcedure.query(async () => {
    await seedDemoData();
    return db.getDashboardSummary();
  }),
  cases: reviewerProcedure.query(async () => {
    await seedDemoData();
    return db.listCases();
  }),
  createDemoCase: investigatorProcedure.input(z.object({
    title: z.string().trim().min(4).max(255),
    description: z.string().trim().min(12).max(1500),
  })).mutation(async ({ input }) => {
    await seedDemoData();
    const timestamp = now();
    return db.createCase({
      id: makeId("case"),
      title: input.title,
      classification: "Synthetic demonstration",
      description: input.description,
      createdBy: demoOwner,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }),
  investigators: multiRoleProcedure.query(async () => {
    await seedDemoData();
    return db.listInvestigators();
  }),
  evidence: multiRoleProcedure.input(z.object({ caseId: z.string().optional() }).optional()).query(async ({ input }) => {
    await seedDemoData();
    return db.listEvidence(input?.caseId);
  }),
  timeline: multiRoleProcedure.input(z.object({ evidenceId: z.string() })).query(async ({ input }) => {
    await seedDemoData();
    return db.listCustodyEvents(input.evidenceId);
  }),
  acquireDemo: investigatorProcedure.input(z.object({ caseId: z.string().default(DEMO_CASE_ID), location: z.string().min(2).max(255).default("Training Lab · Intake Station B") })).mutation(async ({ input }) => {
    await seedDemoData();
    const investigator = await db.getInvestigator(ANALYST_ID);
    if (!investigator) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Synthetic investigator is unavailable." });
    const evidenceId = makeId("evi");
    const timestamp = now();
    const artifact = Buffer.from(`Synthetic generated artifact\nEvidence: ${evidenceId}\nUTC milliseconds: ${timestamp}\nThis is training data only.\n`, "utf8");
    const storage = await storagePut(`forensic-demo/${input.caseId}/${evidenceId}.txt`, artifact, "text/plain");
    const manifest = stableJson({ evidenceId, caseId: input.caseId, filename: `generated-${evidenceId}.txt`, contentType: "text/plain", byteSize: artifact.byteLength, sha256: sha256(artifact), sha3_256: sha3_256(artifact), acquiredAt: timestamp, declaration: "Generated training artifact; no personal or seized data." });
    await db.createEvidence({ id: evidenceId, caseId: input.caseId, originalName: `generated-${evidenceId}.txt`, contentType: "text/plain", byteSize: artifact.byteLength, sha256: sha256(artifact), sha3_256: sha3_256(artifact), storageKey: storage.key, storageUrl: storage.url, manifestJson: manifest, acquiredBy: investigator.id, acquisitionLocation: input.location, status: "verified", acquiredAt: timestamp, createdAt: timestamp });
    await addSignedEvent({ evidenceId, caseId: input.caseId, actorId: investigator.id, action: "Acquired generated training artifact", location: input.location, rationale: "Synthetic proof-of-concept acquisition.", transferStatus: "In analyst custody", happenedAt: timestamp });
    return db.getEvidence(evidenceId);
  }),
  registerLocalCopy: investigatorProcedure.input(z.object({
    caseId: z.string(), originalName: z.string().min(1).max(255), contentType: z.string().min(1).max(160),
    base64Data: z.string().min(1).max(2_800_000), location: z.string().min(2).max(255),
  })).mutation(async ({ input }) => {
    await seedDemoData();
    const evidenceId = makeId("evi");
    const timestamp = now();
    const artifact = Buffer.from(input.base64Data, "base64");
    if (!artifact.byteLength || artifact.byteLength > 2_000_000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "For this demo, select a non-sensitive local copy smaller than 2 MB." });
    if (!(permittedCopyContentTypes as readonly string[]).includes(input.contentType)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only permitted text, PDF, JPEG, PNG, WebP, or GIF copies can be registered in this training prototype." });
    }
    if ((permittedImageContentTypes as readonly string[]).includes(input.contentType) && !hasExpectedImageSignature(input.contentType as (typeof permittedImageContentTypes)[number], artifact)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "The image bytes do not match the declared permitted image type." });
    }
    const storage = await storagePut(`forensic-demo/${input.caseId}/${evidenceId}-${input.originalName.replace(/[^a-z0-9._-]/gi, "_")}`, artifact, input.contentType);
    const isImage = (permittedImageContentTypes as readonly string[]).includes(input.contentType);
    const manifest = stableJson({ evidenceId, caseId: input.caseId, filename: input.originalName, contentType: input.contentType, artifactKind: isImage ? "permitted image copy" : "permitted local copy", byteSize: artifact.byteLength, sha256: sha256(artifact), sha3_256: sha3_256(artifact), acquiredAt: timestamp, preview: isImage ? { available: true, source: "immutable object-storage reference", safety: "Preview is for visual identification only; hashes and signatures remain the integrity controls." } : { available: false }, declaration: "User-selected permitted local copy; original source material remains outside this prototype." });
    await db.createEvidence({ id: evidenceId, caseId: input.caseId, originalName: input.originalName, contentType: input.contentType, byteSize: artifact.byteLength, sha256: sha256(artifact), sha3_256: sha3_256(artifact), storageKey: storage.key, storageUrl: storage.url, manifestJson: manifest, acquiredBy: ANALYST_ID, acquisitionLocation: input.location, status: "verified", acquiredAt: timestamp, createdAt: timestamp });
    await addSignedEvent({ evidenceId, caseId: input.caseId, actorId: ANALYST_ID, action: "Acquired permitted local copy", location: input.location, rationale: "User-selected copy for research demonstration; no original artifact is modified.", transferStatus: "In analyst custody", happenedAt: timestamp });
    return db.getEvidence(evidenceId);
  }),
  handover: investigatorProcedure.input(z.object({ evidenceId: z.string(), recipientId: z.string(), location: z.string().min(2).max(255), reason: z.string().min(4).max(1000), transferStatus: z.string().min(2).max(120).default("Transferred and acknowledged") })).mutation(async ({ input }) => {
    await seedDemoData();
    const evidence = await db.getEvidence(input.evidenceId);
    if (!evidence) throw new TRPCError({ code: "NOT_FOUND", message: "Evidence item not found." });
    const recipient = await db.getInvestigator(input.recipientId);
    if (!recipient) throw new TRPCError({ code: "NOT_FOUND", message: "Receiving investigator not found." });
    await addSignedEvent({ evidenceId: evidence.id, caseId: evidence.caseId, actorId: ANALYST_ID, action: "Transferred custody", location: input.location, rationale: input.reason, transferStatus: input.transferStatus, recipientId: input.recipientId });
    return db.listCustodyEvents(evidence.id);
  }),
  verify: examinerProcedure.input(z.object({ evidenceId: z.string() })).mutation(async ({ input, ctx }) => {
    await seedDemoData();
    return verifyEvidence(input.evidenceId, { appOrigin: ctx.appOrigin });
  }),
  tamper: reviewerProcedure.input(z.object({ evidenceId: z.string(), scenario: z.enum(["artifact-copy", "ledger-copy"]) })).mutation(async ({ input, ctx }) => {
    await seedDemoData();
    const evidence = await assertDemoEvidence(input.evidenceId);
    if (input.scenario === "ledger-copy") {
      const result = await verifyEvidence(evidence.id, { ledgerCopyTampered: true, appOrigin: ctx.appOrigin });
      return { ...result, scenario: "Synthetic in-memory custody-record copy altered; persisted ledger remains untouched." };
    }
    const sourceUrl = await storageGetSignedUrl(evidence.storageKey);
    const absoluteSourceUrl = resolveStorageReadUrl(sourceUrl, ctx.appOrigin);
    const response = await fetch(absoluteSourceUrl);
    if (!response.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Original synthetic artifact could not be copied." });
    const original = Buffer.from(await response.arrayBuffer());
    const altered = Buffer.concat([original, Buffer.from("\nCONTROLLED DEMO TAMPER: altered copy only\n", "utf8")]);
    const copied = await storagePut(`forensic-demo/tampered-copy/${evidence.id}.txt`, altered, evidence.contentType);
    await db.updateEvidenceTamper(evidence.id, { tamperKind: "artifact-copy", tamperedStorageKey: copied.key, tamperedStorageUrl: copied.url, status: "tampered" });
    const result = await verifyEvidence(evidence.id, { useTamperedArtifact: true, appOrigin: ctx.appOrigin });
    return { ...result, scenario: "A separately stored, generated evidence copy was altered. The original artifact was not modified." };
  }),
  resetTamper: reviewerProcedure.input(z.object({ evidenceId: z.string() })).mutation(async ({ input }) => {
    await seedDemoData();
    await assertDemoEvidence(input.evidenceId);
    const evidence = await db.updateEvidenceTamper(input.evidenceId, { tamperKind: null, tamperedStorageKey: null, tamperedStorageUrl: null, status: "verified" });
    return evidence;
  }),
  runBenchmark: examinerProcedure.input(z.object({ recordCount: z.number().int().min(10).max(250).default(50), repetitions: z.number().int().min(1).max(10).default(3) })).mutation(async ({ input }) => {
    await seedDemoData();
    const pqCapability = getPqCapability();
    const ecdsaResult = measureEcdsaBenchmark(input.recordCount, input.repetitions);
    const results = {
      ecdsa: ecdsaResult,
      mldsa: MLDSA_DISCLOSURE_TEXT,
      metadata: { nodeVersion: ecdsaResult.nodeVersion, os: ecdsaResult.os, algorithm: "ECDSA-P256", pqAlgorithm: "ML-DSA-65 (FIPS 204)", pqStatus: pqCapability.status },
      limitations: "Results are lab measurements in this server runtime; they are not production capacity or admissibility claims. This experiment measures signing and verification trade-offs; it does not prove one algorithm universally superior.",
    };
    const run = { id: makeId("bench"), createdBy: demoOwner, recordCount: input.recordCount, repetitions: input.repetitions, pqModeStatus: pqCapability.status, resultsJson: JSON.stringify(results), createdAt: now() };
    await db.createBenchmarkRun(run);
    return { ...run, results };
  }),
  benchmarks: examinerProcedure.query(async () => {
    await seedDemoData();
    return db.listBenchmarkRuns();
  }),
  auditExport: examinerProcedure.input(z.object({ evidenceId: z.string() })).query(async ({ input }) => {
    await seedDemoData();
    const evidence = await db.getEvidence(input.evidenceId);
    if (!evidence) throw new TRPCError({ code: "NOT_FOUND", message: "Evidence item not found." });
    const [caseRecord, events, verification] = await Promise.all([db.getCase(evidence.caseId), db.listCustodyEvents(evidence.id), db.getLatestVerification(evidence.id)]);
    const pqCapability = getPqCapability();
    const benchmarks = await db.listBenchmarkRuns();
    const latestBenchmark = benchmarks[0] ?? null;
    const exportData = {
      reportType: "PQ-ForensicVault audit export",
      generatedAt: now(),
      case: caseRecord ?? null,
      evidence: { ...evidence, manifest: JSON.parse(evidence.manifestJson) },
      custodyEvents: events,
      latestVerification: verification ? { ...verification, findings: JSON.parse(verification.findingsJson) } : null,
      algorithms: { artifactHashes: ["SHA-256", "SHA3-256"], custodySignature: "ECDSA-P256 / SHA-256", pqCapability, mldsaDisclosure: MLDSA_DISCLOSURE_TEXT },
      benchmark: latestBenchmark ? { ...latestBenchmark, results: JSON.parse(latestBenchmark.resultsJson) } : null,
      legalAdmissibilityCaution: "Technical hash, signature, and ledger results do not establish legal admissibility. Admissibility depends on jurisdiction, procedure, documentation, expert testimony, and applicable standards.",
    };
    const reportJson = JSON.stringify(exportData);
    const reportChecksum = sha256(reportJson);
    return { ...exportData, reportChecksum };
  }),
});
