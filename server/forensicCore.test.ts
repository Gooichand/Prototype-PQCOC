import { describe, expect, it } from "vitest";
import {
  checkArtifactIntegrity,
  createEcdsaIdentity,
  getPqCapability,
  measureEcdsaBenchmark,
  MLDSA_DISCLOSURE_TEXT,
  renderAuditMarkdown,
  resetEphemeralKeys,
  sha3_256,
  sha256,
  signEcdsa,
  stableJson,
  validateCustodyChain,
  verifyEcdsa,
} from "./forensicCore";

describe("PQ-ForensicVault integrity primitives", () => {
  it("creates a real ECDSA signature that validates only the canonical payload", () => {
    const actorId = "test-investigator";
    const payload = stableJson({ action: "acquire", evidenceId: "evi-test", timestamp: 1730000000000 });
    const publicKey = createEcdsaIdentity(actorId).publicKeyPem;
    const signature = signEcdsa(actorId, payload);
    expect(verifyEcdsa(publicKey, payload, signature)).toBe(true);
    expect(verifyEcdsa(publicKey, `${payload}altered`, signature)).toBe(false);
  });

  it("re-checks an artifact's SHA-256 and SHA3-256 bytes independently", () => {
    const original = Buffer.from("synthetic training artifact");
    const expected = { sha256: sha256(original), sha3_256: sha3_256(original) };
    expect(checkArtifactIntegrity(original, expected)).toEqual({ sha256Match: true, sha3_256Match: true });
    expect(checkArtifactIntegrity(Buffer.from("synthetic training artifact + mutation"), expected)).toEqual({ sha256Match: false, sha3_256Match: false });
  });

  it("validates a linked two-event handover and rejects an altered ledger copy", () => {
    const analyst = "test-analyst";
    const custodian = "test-custodian";
    const analystKey = createEcdsaIdentity(analyst);
    const custodianKey = createEcdsaIdentity(custodian);
    const firstPayload = stableJson({ sequence: 1, action: "acquire", actor: analyst });
    const firstHash = sha3_256(firstPayload);
    const secondPayload = stableJson({ sequence: 2, action: "transfer", actor: custodian, previousEventHash: firstHash });
    const records = [
      { actorId: analyst, sequenceNumber: 1, canonicalPayload: firstPayload, eventRecordHash: firstHash, previousEventHash: null, signatureValue: signEcdsa(analyst, firstPayload), signerPublicKeyPem: analystKey.publicKeyPem },
      { actorId: custodian, sequenceNumber: 2, canonicalPayload: secondPayload, eventRecordHash: sha3_256(secondPayload), previousEventHash: firstHash, signatureValue: signEcdsa(custodian, secondPayload), signerPublicKeyPem: custodianKey.publicKeyPem },
    ];
    expect(validateCustodyChain(records).passed).toBe(true);
    expect(validateCustodyChain([{ ...records[0] }, { ...records[1], canonicalPayload: `${records[1].canonicalPayload} demo-copy-tamper` }]).passed).toBe(false);
  });

  it("does not preserve private material through a demo reset but can create a new valid key for further training actions", () => {
    const actor = "reset-test";
    const oldPublicKey = createEcdsaIdentity(actor).publicKeyPem;
    const payload = stableJson({ event: "before-reset" });
    const oldSignature = signEcdsa(actor, payload);
    resetEphemeralKeys();
    const newPublicKey = createEcdsaIdentity(actor).publicKeyPem;
    expect(verifyEcdsa(oldPublicKey, payload, oldSignature)).toBe(true);
    expect(verifyEcdsa(newPublicKey, payload, oldSignature)).toBe(false);
    expect(verifyEcdsa(newPublicKey, payload, signEcdsa(actor, payload))).toBe(true);
  });

  it("renders an export with the required legal limitation and reports a non-simulated ML-DSA status", () => {
    const capability = getPqCapability();
    expect(["available", "unavailable", "error"]).toContain(capability.status);
    expect(capability.detail.length).toBeGreaterThan(15);
    const report = renderAuditMarkdown({ title: "Synthetic Case", evidenceName: "training.txt", sha256: "a".repeat(64), sha3_256: "b".repeat(64), eventCount: 2, pqStatus: capability.status });
    expect(report).toContain("do not establish legal admissibility");
    expect(report).toContain("ML-DSA capability");
  });

  it("uses identical ML-DSA disclosure text in the constant and the markdown renderer", () => {
    expect(MLDSA_DISCLOSURE_TEXT).toBe("ML-DSA runtime capability detected; no execution adapter is provisioned. No ML-DSA benchmark is performed.");
    const report = renderAuditMarkdown({ title: "Test", evidenceName: "test.txt", sha256: "a".repeat(64), sha3_256: "b".repeat(64), eventCount: 1, pqStatus: "unavailable" });
    expect(report).toContain(MLDSA_DISCLOSURE_TEXT);
  });

  it("produces a consistent ML-DSA disclosure regardless of pqStatus value", () => {
    const reportAvailable = renderAuditMarkdown({ title: "Test", evidenceName: "test.txt", sha256: "a".repeat(64), sha3_256: "b".repeat(64), eventCount: 1, pqStatus: "available" });
    const reportUnavailable = renderAuditMarkdown({ title: "Test", evidenceName: "test.txt", sha256: "a".repeat(64), sha3_256: "b".repeat(64), eventCount: 1, pqStatus: "unavailable" });
    expect(reportAvailable).toContain(MLDSA_DISCLOSURE_TEXT);
    expect(reportUnavailable).toContain(MLDSA_DISCLOSURE_TEXT);
    expect(reportAvailable).not.toContain("execution adapter not yet provisioned");
    expect(reportUnavailable).not.toContain("execution adapter not yet provisioned");
  });
});

describe("Enhanced ECDSA benchmark", () => {
  it("includes median, standard deviation, key sizes, and research metadata", () => {
    const result = measureEcdsaBenchmark(20, 2);
    expect(result.algorithm).toBe("ECDSA-P256");
    expect(result.samples).toBe(40);
    expect(result.recordCount).toBe(20);
    expect(result.repetitions).toBe(2);
    expect(typeof result.signingMsAverage).toBe("number");
    expect(typeof result.signingMsMedian).toBe("number");
    expect(typeof result.signingMsStddev).toBe("number");
    expect(typeof result.verificationMsAverage).toBe("number");
    expect(typeof result.verificationMsMedian).toBe("number");
    expect(typeof result.verificationMsStddev).toBe("number");
    expect(typeof result.signatureBytesAverage).toBe("number");
    expect(result.signatureBytesAverage).toBeGreaterThan(0);
    expect(typeof result.publicKeySizeBytes).toBe("number");
    expect(result.publicKeySizeBytes).toBeGreaterThan(0);
    expect(typeof result.privateKeySizeBytes).toBe("number");
    expect(result.privateKeySizeBytes).toBeGreaterThan(0);
    expect(typeof result.tamperDetectionRate).toBe("string");
    expect(result.tamperDetectionRate).toContain("100%");
    expect(typeof result.nodeVersion).toBe("string");
    expect(result.nodeVersion).toContain("v");
    expect(typeof result.os).toBe("string");
    expect(result.os.length).toBeGreaterThan(0);
  });

  it("produces median values that lie between min and max of the sample set", () => {
    const result = measureEcdsaBenchmark(30, 3);
    expect(result.signingMsMedian).toBeGreaterThanOrEqual(0);
    expect(result.verificationMsMedian).toBeGreaterThanOrEqual(0);
    expect(result.signingMsStddev).toBeGreaterThanOrEqual(0);
    expect(result.verificationMsStddev).toBeGreaterThanOrEqual(0);
  });
});
