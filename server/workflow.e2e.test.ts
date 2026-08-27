import { describe, expect, it } from "vitest";
import {
  createEcdsaIdentity,
  getPqCapability,
  measureEcdsaBenchmark,
  MLDSA_DISCLOSURE_TEXT,
  renderAuditMarkdown,
  sha256,
  sha3_256,
  signEcdsa,
  stableJson,
  verifyEcdsa,
  checkArtifactIntegrity,
  validateCustodyChain,
  type ChainRecord,
} from "./forensicCore";

const ANALYST_ID = "inv_analyst_aria";
const CUSTODIAN_ID = "inv_custodian_noah";

function makeChainRecord(
  actorId: string,
  sequenceNumber: number,
  previousEventHash: string | null,
  overrides: Partial<ChainRecord> = {},
): ChainRecord {
  const canonicalPayload = stableJson({
    actorId,
    sequenceNumber,
    action: `custody-event-${sequenceNumber}`,
    timestamp: 1730000000000 + sequenceNumber,
    ...overrides,
  });
  const eventRecordHash = sha3_256(canonicalPayload);
  const key = createEcdsaIdentity(actorId);
  const signatureValue = signEcdsa(actorId, canonicalPayload);
  return {
    actorId,
    sequenceNumber,
    canonicalPayload,
    eventRecordHash,
    previousEventHash,
    signatureValue,
    signatureAlgorithm: "ECDSA-P256 / SHA-256",
    signerPublicKeyPem: key.publicKeyPem,
    ...overrides,
  };
}

describe("Full end-to-end workflow: acquisition → hashing → signing → logging → verification → report", () => {
  it("completes the entire forensic chain of custody workflow", () => {
    // ── Step 1: Acquisition ──────────────────────────────────────────
    const evidenceContent = Buffer.from(
      "PQ-ForensicVault synthetic evidence artifact\nCase: SYN-24-017\nPurpose: academic proof-of-concept\n",
      "utf8",
    );
    expect(evidenceContent.byteLength).toBeGreaterThan(0);

    // ── Step 2: Hashing (SHA-256 + SHA3-256) ────────────────────────
    const hashSha256 = sha256(evidenceContent);
    const hashSha3 = sha3_256(evidenceContent);
    expect(hashSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSha3).toMatch(/^[0-9a-f]{64}$/);

    // Verify deterministic hashing
    expect(sha256(evidenceContent)).toBe(hashSha256);
    expect(sha3_256(evidenceContent)).toBe(hashSha3);

    // ── Step 3: ECDSA signing (custody event creation) ──────────────
    const analystKey = createEcdsaIdentity(ANALYST_ID);
    expect(analystKey.publicKeyPem).toContain("BEGIN PUBLIC KEY");
    expect(analystKey.fingerprint).toMatch(/^[0-9a-f]{32}$/);

    const custodyPayload = stableJson({
      actorId: ANALYST_ID,
      evidenceId: "evi_e2e_001",
      caseId: "case_e2e_001",
      sequenceNumber: 1,
      action: "Acquired generated training artifact",
      location: "Training Lab · Intake Station A",
      rationale: "Initial synthetic evidence capture.",
      transferStatus: "In analyst custody",
      happenedAt: 1730000000000,
      previousEventHash: null,
    });
    const eventHash = sha3_256(custodyPayload);
    const signature = signEcdsa(ANALYST_ID, custodyPayload);
    expect(signature).toBeTruthy();

    // Verify signature is valid
    expect(verifyEcdsa(analystKey.publicKeyPem, custodyPayload, signature)).toBe(true);

    // Tampered payload fails verification
    expect(verifyEcdsa(analystKey.publicKeyPem, custodyPayload + "-tampered", signature)).toBe(false);

    // ── Step 4: Logging (chain of custody events) ───────────────────
    const event1 = makeChainRecord(ANALYST_ID, 1, null);
    const custodianKey = createEcdsaIdentity(CUSTODIAN_ID);
    const event2 = makeChainRecord(CUSTODIAN_ID, 2, event1.eventRecordHash);

    expect(event1.previousEventHash).toBeNull();
    expect(event2.previousEventHash).toBe(event1.eventRecordHash);
    expect(event1.eventRecordHash).not.toBe(event2.eventRecordHash);

    const chainRecords: ChainRecord[] = [event1, event2];

    // ── Step 5: Verification ────────────────────────────────────────
    // Artifact integrity check
    const integrity = checkArtifactIntegrity(evidenceContent, { sha256: hashSha256, sha3_256: hashSha3 });
    expect(integrity.sha256Match).toBe(true);
    expect(integrity.sha3_256Match).toBe(true);

    // Tampered artifact fails
    const tamperedContent = Buffer.from("TAMPERED", "utf8");
    const tamperedIntegrity = checkArtifactIntegrity(tamperedContent, { sha256: hashSha256, sha3_256: hashSha3 });
    expect(tamperedIntegrity.sha256Match).toBe(false);
    expect(tamperedIntegrity.sha3_256Match).toBe(false);

    // Chain of custody verification
    const chainResult = validateCustodyChain(chainRecords);
    expect(chainResult.passed).toBe(true);
    expect(chainResult.findings).toHaveLength(2);
    for (const finding of chainResult.findings) {
      expect(finding.eventHashValid).toBe(true);
      expect(finding.chainLinkValid).toBe(true);
      expect(finding.signatureValid).toBe(true);
    }

    // Broken chain fails (wrong public key)
    const brokenChain = validateCustodyChain([
      event1,
      { ...event2, signerPublicKeyPem: analystKey.publicKeyPem },
    ]);
    expect(brokenChain.passed).toBe(false);
    expect(brokenChain.findings[1].signatureValid).toBe(false);

    // ── Step 6: ML-DSA capability probe ─────────────────────────────
    const pqCap = getPqCapability();
    expect(pqCap.algorithm).toBe("ML-DSA-65 (FIPS 204)");
    expect(["available", "unavailable", "error"]).toContain(pqCap.status);

    // ── Step 7: Benchmark ───────────────────────────────────────────
    const benchmark = measureEcdsaBenchmark(20, 2);
    expect(benchmark.algorithm).toBe("ECDSA-P256");
    expect(benchmark.samples).toBe(40); // 20 records × 2 reps
    expect(benchmark.signingMsAverage).toBeGreaterThan(0);
    expect(benchmark.signingMsMedian).toBeGreaterThan(0);
    expect(benchmark.verificationMsAverage).toBeGreaterThan(0);
    expect(benchmark.verificationMsMedian).toBeGreaterThan(0);
    expect(benchmark.signingMsStddev).toBeGreaterThanOrEqual(0);
    expect(benchmark.verificationMsStddev).toBeGreaterThanOrEqual(0);
    expect(benchmark.publicKeySizeBytes).toBeGreaterThan(0);
    expect(benchmark.privateKeySizeBytes).toBeGreaterThan(0);
    expect(benchmark.signatureBytesAverage).toBeGreaterThan(0);
    expect(benchmark.storageOverheadBytes).toBeGreaterThan(0);
    expect(benchmark.tamperDetectionRate).toContain("100%");
    expect(benchmark.nodeVersion).toBeTruthy();
    expect(benchmark.os).toBeTruthy();

    // ── Step 8: Audit report generation ─────────────────────────────
    const markdown = renderAuditMarkdown({
      title: "SYN-24-017 · Crimson Relay",
      evidenceName: "synthetic-evidence-manifest.txt",
      sha256: hashSha256,
      sha3_256: hashSha3,
      eventCount: chainRecords.length,
      pqStatus: pqCap.status,
    });

    expect(markdown).toContain("# PQ-ForensicVault Audit Report");
    expect(markdown).toContain("SYN-24-017 · Crimson Relay");
    expect(markdown).toContain(hashSha256);
    expect(markdown).toContain(hashSha3);
    expect(markdown).toContain("2");
    expect(markdown).toContain(MLDSA_DISCLOSURE_TEXT);
    expect(markdown).toContain("ECDSA-P256");
    expect(markdown).toContain("legal admissibility");

    // ── Step 9: Stable JSON serialization ────────────────────────────
    const json1 = stableJson({ b: 2, a: 1 });
    const json2 = stableJson({ a: 1, b: 2 });
    expect(json1).toBe(json2);
    expect(json1).toContain('"a":1');
    expect(json1).toContain('"b":2');
  });

  it("produces consistent benchmark results across runs (deterministic fields)", () => {
    const b1 = measureEcdsaBenchmark(10, 1);
    const b2 = measureEcdsaBenchmark(10, 1);
    expect(b1.algorithm).toBe(b2.algorithm);
    expect(b1.samples).toBe(b2.samples);
    expect(b1.recordCount).toBe(b2.recordCount);
    expect(b1.repetitions).toBe(b2.repetitions);
    expect(b1.publicKeySizeBytes).toBe(b2.publicKeySizeBytes);
    expect(b1.privateKeySizeBytes).toBe(b2.privateKeySizeBytes);
    expect(b1.nodeVersion).toBe(b2.nodeVersion);
    expect(b1.os).toBe(b2.os);
  });

  it("ML-DSA disclosure text is identical everywhere", () => {
    const fromCore = MLDSA_DISCLOSURE_TEXT;
    const markdown = renderAuditMarkdown({
      title: "test",
      evidenceName: "test.txt",
      sha256: "a".repeat(64),
      sha3_256: "b".repeat(64),
      eventCount: 1,
      pqStatus: "unavailable",
    });
    expect(markdown).toContain(fromCore);
    const benchmark = measureEcdsaBenchmark(10, 1);
    expect(benchmark).toBeDefined();
  });

  it("detects tampered payloads across the chain", () => {
    const key = createEcdsaIdentity("tamper-tester");
    const originalPayload = stableJson({ action: "transfer", actor: "tester" });
    const sig = signEcdsa("tamper-tester", originalPayload);

    expect(verifyEcdsa(key.publicKeyPem, originalPayload, sig)).toBe(true);

    const tamperedPayloads = [
      stableJson({ action: "transfer", actor: "tester", extra: "injected" }),
      stableJson({ action: "TRANSFER", actor: "tester" }),
      stableJson({ action: "transfer", actor: "TESTER" }),
    ];

    for (const tampered of tamperedPayloads) {
      expect(verifyEcdsa(key.publicKeyPem, tampered, sig)).toBe(false);
    }
  });
});
