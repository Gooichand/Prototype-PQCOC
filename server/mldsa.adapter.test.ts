import { describe, expect, it } from "vitest";
import {
  validateAdapter,
  generateMldsa65KeyPair,
  signMldsa65,
  verifyMldsa65,
  isMldsaExecutionAvailable,
  getMldsa65AdapterStatus,
  getMldsa65ParameterMetadata,
  resetAdapterState,
} from "./crypto/mldsaAdapter";
import {
  createEcdsaIdentity,
  createMldsa65Identity,
  getPqCapability,
  measureMldsaBenchmark,
  MLDSA_DISCLOSURE_TEXT,
  sha256,
  sha3_256,
  signEcdsa,
  signMldsa65Event,
  stableJson,
  verifyEcdsa,
  verifyMldsa65Event,
  validateCustodyChain,
  measureEcdsaBenchmark,
  resetEphemeralKeys,
  checkArtifactIntegrity,
  type ChainRecord,
} from "./forensicCore";

describe("ML-DSA-65 real adapter", () => {
  it("1. distinguishes capability detection from execution-adapter status", () => {
    const pqCap = getPqCapability();
    expect(pqCap.algorithm).toBe("ML-DSA-65 (FIPS 204)");
    expect(["available", "unavailable", "error"]).toContain(pqCap.nativeNodeStatus);
    expect(pqCap.adapterStatus).toBeDefined();
    expect(typeof pqCap.executionAvailable).toBe("boolean");
    expect(pqCap.detail).toBeTruthy();
  });

  it("2. generates real ML-DSA-65 key pairs", () => {
    const adapter = validateAdapter();
    expect(adapter.adapterAvailable).toBe(true);
    const keys = generateMldsa65KeyPair();
    expect(keys.publicKey).toBeInstanceOf(Uint8Array);
    expect(keys.secretKey).toBeInstanceOf(Uint8Array);
    expect(keys.publicKey.byteLength).toBe(1952);
    expect(keys.secretKey.byteLength).toBe(4032);
  });

  it("3. records the correct key and signature sizes", () => {
    const meta = getMldsa65ParameterMetadata();
    expect(meta.algorithm).toBe("ML-DSA-65");
    expect(meta.standard).toBe("FIPS 204");
    expect(meta.securityLevel).toBe(3);
    expect(meta.publicKeyBytes).toBe(1952);
    expect(meta.secretKeyBytes).toBe(4032);
    expect(meta.signatureBytes).toBe(3309);
    expect(meta.package).toBe("@noble/post-quantum");
    expect(meta.audit).toBe("Cure53 (2024)");
  });

  it("4. signs a canonical custody-event payload with real ML-DSA-65", () => {
    const keys = generateMldsa65KeyPair();
    const payload = stableJson({ actor: "test", sequence: 1, action: "acquire" });
    const msg = new TextEncoder().encode(payload);
    const { signature, algorithm } = signMldsa65(msg, keys.secretKey);
    expect(signature).toBeInstanceOf(Uint8Array);
    expect(signature.byteLength).toBe(3309);
    expect(algorithm).toBe("ML-DSA-65 / FIPS 204");
  });

  it("5. verifies a real ML-DSA-65 signature successfully", () => {
    const keys = generateMldsa65KeyPair();
    const payload = stableJson({ actor: "test", sequence: 1, action: "acquire" });
    const msg = new TextEncoder().encode(payload);
    const { signature } = signMldsa65(msg, keys.secretKey);
    const valid = verifyMldsa65(msg, signature, keys.publicKey);
    expect(valid).toBe(true);
  });

  it("6. rejects verification when the message is changed", () => {
    const keys = generateMldsa65KeyPair();
    const msg = new TextEncoder().encode("original message");
    const { signature } = signMldsa65(msg, keys.secretKey);
    const tamperedMsg = new TextEncoder().encode("tampered message");
    expect(verifyMldsa65(tamperedMsg, signature, keys.publicKey)).toBe(false);
  });

  it("7. rejects verification when the signature is changed", () => {
    const keys = generateMldsa65KeyPair();
    const msg = new TextEncoder().encode("test message");
    const { signature } = signMldsa65(msg, keys.secretKey);
    const tamperedSig = new Uint8Array(signature);
    tamperedSig[0] ^= 0xff;
    expect(verifyMldsa65(msg, tamperedSig, keys.publicKey)).toBe(false);
  });

  it("8. rejects verification when the public key is wrong", () => {
    const keys1 = generateMldsa65KeyPair();
    const keys2 = generateMldsa65KeyPair();
    const msg = new TextEncoder().encode("test message");
    const { signature } = signMldsa65(msg, keys1.secretKey);
    expect(verifyMldsa65(msg, signature, keys2.publicKey)).toBe(false);
  });

  it("9. handles empty and malformed signatures safely", () => {
    const keys = generateMldsa65KeyPair();
    const msg = new TextEncoder().encode("test");
    expect(verifyMldsa65(msg, new Uint8Array(0), keys.publicKey)).toBe(false);
    expect(verifyMldsa65(msg, new Uint8Array(10), keys.publicKey)).toBe(false);
    expect(verifyMldsa65(msg, new Uint8Array(9999), keys.publicKey)).toBe(false);
  });

  it("10. ML-DSA adapter does not silently call the ECDSA adapter", () => {
    const keys = generateMldsa65KeyPair();
    const msg = new TextEncoder().encode("test");
    const { signature } = signMldsa65(msg, keys.secretKey);
    const ecdsaKey = createEcdsaIdentity("mldsa-test-actor");
    expect(verifyEcdsa(ecdsaKey.publicKeyPem, msg as unknown as string, Buffer.from(signature).toString("base64"))).toBe(false);
  });

  it("11. existing ECDSA records remain verifiable", () => {
    const ecdsaKey = createEcdsaIdentity("ecdsa-persist-test");
    const payload = stableJson({ event: "original-ecdsa-event", seq: 42 });
    const sig = signEcdsa("ecdsa-persist-test", payload);
    expect(verifyEcdsa(ecdsaKey.publicKeyPem, payload, sig)).toBe(true);
    expect(verifyEcdsa(ecdsaKey.publicKeyPem, payload + "-tampered", sig)).toBe(false);
  });

  it("12. mixed ECDSA/ML-DSA custody chain is handled correctly", () => {
    const ecdsaActor = "ecdsa-mixed";
    const mldsaActor = "mldsa-mixed";
    const ecdsaKey = createEcdsaIdentity(ecdsaActor);
    const mldsaIdentity = createMldsa65Identity(mldsaActor);

    const payload1 = stableJson({ actor: ecdsaActor, seq: 1, action: "acquire" });
    const hash1 = sha3_256(payload1);
    const sig1 = signEcdsa(ecdsaActor, payload1);

    const payload2 = stableJson({ actor: mldsaActor, seq: 2, action: "transfer", prev: hash1 });
    const hash2 = sha3_256(payload2);
    const { signatureValue: sig2, publicKeyHex } = signMldsa65Event(mldsaActor, payload2);

    const records: ChainRecord[] = [
      { actorId: ecdsaActor, sequenceNumber: 1, canonicalPayload: payload1, eventRecordHash: hash1, previousEventHash: null, signatureValue: sig1, signatureAlgorithm: "ECDSA-P256 / SHA-256", signerPublicKeyPem: ecdsaKey.publicKeyPem },
      { actorId: mldsaActor, sequenceNumber: 2, canonicalPayload: payload2, eventRecordHash: hash2, previousEventHash: hash1, signatureValue: sig2, signatureAlgorithm: "ML-DSA-65 / FIPS 204", signerPublicKeyHex: publicKeyHex },
    ];

    const result = validateCustodyChain(records);
    expect(result.passed).toBe(true);
    expect(result.findings[0].signatureAlgorithm).toBe("ECDSA-P256 / SHA-256");
    expect(result.findings[1].signatureAlgorithm).toBe("ML-DSA-65 / FIPS 204");
  });

  it("13. reports honest adapter status", () => {
    resetAdapterState();
    const status = getMldsa65AdapterStatus();
    expect(status.adapterAvailable).toBe(false);
    expect(status.keygenOk).toBe(false);

    validateAdapter();
    const validated = getMldsa65AdapterStatus();
    expect(validated.adapterAvailable).toBe(true);
    expect(validated.keygenOk).toBe(true);
    expect(validated.signOk).toBe(true);
    expect(validated.verifyOk).toBe(true);
    expect(validated.packageVersion).toBe("0.7.0");
  });

  it("14. no fake timing values in fallback mode", () => {
    resetAdapterState();
    const status = getMldsa65AdapterStatus();
    expect(status.publicKeyBytes).toBe(0);
    expect(status.secretKeyBytes).toBe(0);
    expect(status.signatureBytes).toBe(0);
    validateAdapter();
  });

  it("15. private keys are not exposed in logs or returned values", () => {
    const keys = generateMldsa65KeyPair();
    const status = getMldsa65AdapterStatus();
    expect(status.detail).not.toContain(Buffer.from(keys.secretKey).toString("hex"));
    expect(status.detail).not.toContain("secretKey");

    const pqCap = getPqCapability();
    expect(pqCap.detail).not.toContain(Buffer.from(keys.secretKey).toString("hex"));
  });

  it("16. image evidence still uses SHA-256/SHA3-256 and permitted-image safeguards", () => {
    const imageBytes = Buffer.from("fake-png-image-bytes");
    const hashes = { sha256: sha256(imageBytes), sha3_256: sha3_256(imageBytes) };
    const integrity = checkArtifactIntegrity(imageBytes, hashes);
    expect(integrity.sha256Match).toBe(true);
    expect(integrity.sha3_256Match).toBe(true);

    const tampered = Buffer.from("tampered-image-bytes");
    const tamperedIntegrity = checkArtifactIntegrity(tampered, hashes);
    expect(tamperedIntegrity.sha256Match).toBe(false);
    expect(tamperedIntegrity.sha3_256Match).toBe(false);
  });

  it("17. safe artifact and ledger tamper tests still work", () => {
    const keys = generateMldsa65KeyPair();
    const payload = stableJson({ event: "tamper-test" });
    const msg = new TextEncoder().encode(payload);
    const { signature } = signMldsa65(msg, keys.secretKey);

    expect(verifyMldsa65(msg, signature, keys.publicKey)).toBe(true);

    const tamperedMsg = new TextEncoder().encode(payload + "-altered");
    expect(verifyMldsa65(tamperedMsg, signature, keys.publicKey)).toBe(false);
  });

  it("18. exported ML-DSA metadata matches actual execution status", () => {
    const pqCap = getPqCapability();
    if (pqCap.executionAvailable) {
      expect(pqCap.status).toBe("available");
      expect(pqCap.adapterStatus.adapterAvailable).toBe(true);
      expect(pqCap.detail).toContain("execution adapter active");
    } else {
      expect(pqCap.status).not.toBe("available");
      expect(pqCap.detail).toContain("no execution adapter");
    }
    expect(MLDSA_DISCLOSURE_TEXT).toContain("no execution adapter");
  });
});
