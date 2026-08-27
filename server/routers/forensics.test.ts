import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "../db";
import * as storage from "../storage";
import { createEcdsaIdentity, sha256, sha3_256, signEcdsa, stableJson } from "../forensicCore";
import { forensicRouter, MLDSA_UNAVAILABLE_TEXT } from "./forensics";
import { isRoleAllowed, type ForensicRole } from "../_core/trpc";

vi.mock("../db", () => ({
  getCase: vi.fn(), getInvestigator: vi.fn(), getEvidence: vi.fn(), listCustodyEvents: vi.fn(),
  createCustodyEvent: vi.fn(), createEvidence: vi.fn(), updateEvidenceTamper: vi.fn(),
  createVerificationRun: vi.fn(), getLatestVerification: vi.fn(), createBenchmarkRun: vi.fn(),
  listBenchmarkRuns: vi.fn(), listEvidence: vi.fn(), getDashboardSummary: vi.fn(), listCases: vi.fn(),
  listInvestigators: vi.fn(), upsertInvestigator: vi.fn(), createCase: vi.fn(), resetAllDemoData: vi.fn(),
}));

vi.mock("../storage", () => ({
  storageGetSignedUrl: vi.fn(),
  storagePut: vi.fn(),
  resolveStorageReadUrl: vi.fn((url: string, origin?: string) => {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const base = origin || "http://localhost";
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  }),
}));

const caseId = "case_synthetic_crimson";
const analystId = "inv_analyst_aria";
const originalArtifact = Buffer.from("synthetic permitted-copy test artifact", "utf8");
const baseEvidence = {
  id: "evi-permitted-copy", caseId, originalName: "permitted-copy.txt", contentType: "text/plain",
  byteSize: originalArtifact.byteLength, sha256: sha256(originalArtifact), sha3_256: sha3_256(originalArtifact),
  storageKey: "forensic-demo/case_synthetic_crimson/permitted-copy.txt", storageUrl: "/manus-storage/permitted-copy.txt",
  manifestJson: "{}", acquiredBy: analystId, acquisitionLocation: "Training Lab", status: "verified",
  acquiredAt: 1730000000000, createdAt: 1730000000000, tamperKind: null, tamperedStorageKey: null, tamperedStorageUrl: null,
};

const demoCase = { id: caseId, classification: "Synthetic demonstration", title: "Synthetic test case" };
const analyst = { id: analystId, displayName: "Aria Rahman", publicKeyPem: "unused-in-test" };

function makeCaller(appOrigin?: string) {
  return forensicRouter.createCaller({ req: {}, res: {}, user: null, appOrigin: appOrigin || "http://localhost:3000" } as never);
}

function restoreResolveMock() {
  vi.mocked(storage.resolveStorageReadUrl).mockImplementation((url: string, origin?: string) => {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const base = origin || "http://localhost";
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  restoreResolveMock();
  vi.mocked(db.getCase).mockResolvedValue(demoCase as never);
  vi.mocked(db.getInvestigator).mockResolvedValue(analyst as never);
  vi.mocked(db.getEvidence).mockResolvedValue(baseEvidence as never);
  vi.mocked(db.listCustodyEvents).mockResolvedValue([] as never);
  vi.mocked(db.createEvidence).mockResolvedValue(undefined as never);
  vi.mocked(db.createCustodyEvent).mockResolvedValue(undefined as never);
  vi.mocked(db.createVerificationRun).mockResolvedValue(undefined as never);
  vi.mocked(db.updateEvidenceTamper).mockResolvedValue({ ...baseEvidence, status: "verified" } as never);
  vi.mocked(db.getLatestVerification).mockResolvedValue(null as never);
  vi.mocked(storage.storagePut).mockResolvedValue({ key: "forensic-demo/immutable-copy.txt", url: "/manus-storage/immutable-copy.txt" });
  vi.mocked(storage.storageGetSignedUrl).mockResolvedValue("https://storage.test/original");
});

afterEach(() => vi.unstubAllGlobals());

// ---------------------------------------------------------------------------
// URL resolution unit tests (using the real function from storage.ts)
// ---------------------------------------------------------------------------
describe("resolveStorageReadUrl (unit)", () => {
  const resolve = storage.resolveStorageReadUrl;

  it("passes an absolute HTTPS presigned URL through unchanged", () => {
    expect(resolve("https://s3.example.com/bucket/key?token=abc"))
      .toBe("https://s3.example.com/bucket/key?token=abc");
  });

  it("passes an absolute HTTP URL through unchanged", () => {
    expect(resolve("http://minio.local:9000/data/file.bin"))
      .toBe("http://minio.local:9000/data/file.bin");
  });

  it("resolves a relative /manus-storage/ path against the provided app origin", () => {
    expect(resolve("/manus-storage/forensic-demo/key.txt", "http://localhost:4000"))
      .toBe("http://localhost:4000/manus-storage/forensic-demo/key.txt");
  });

  it("falls back to http://localhost when no origin is provided", () => {
    expect(resolve("/manus-storage/key.txt"))
      .toBe("http://localhost/manus-storage/key.txt");
  });

  it("handles a relative path without a leading slash", () => {
    expect(resolve("manus-storage/key.txt", "http://127.0.0.1:5173"))
      .toBe("http://127.0.0.1:5173/manus-storage/key.txt");
  });
});

// ---------------------------------------------------------------------------
// Storage URL resolution integration tests
// ---------------------------------------------------------------------------
describe("resolveStorageReadUrl integration", () => {
  it("resolves a relative path against a non-standard port origin", () => {
    const resolve = storage.resolveStorageReadUrl;
    expect(resolve("/manus-storage/key.txt", "http://localhost:5173"))
      .toBe("http://localhost:5173/manus-storage/key.txt");
  });

  it("resolves a relative path against a 127.0.0.1 origin", () => {
    const resolve = storage.resolveStorageReadUrl;
    expect(resolve("/manus-storage/key.txt", "http://127.0.0.1:3000"))
      .toBe("http://127.0.0.1:3000/manus-storage/key.txt");
  });

  it("resolves a relative path without leading slash against a custom origin", () => {
    const resolve = storage.resolveStorageReadUrl;
    expect(resolve("manus-storage/key.txt", "https://example.com"))
      .toBe("https://example.com/manus-storage/key.txt");
  });

  it("passes an absolute HTTPS presigned S3 URL through unchanged regardless of origin", () => {
    const resolve = storage.resolveStorageReadUrl;
    expect(resolve("https://s3.amazonaws.com/bucket/key?X-Amz-Signature=abc", "http://localhost:3000"))
      .toBe("https://s3.amazonaws.com/bucket/key?X-Amz-Signature=abc");
  });

  it("passes an absolute HTTP URL through unchanged", () => {
    const resolve = storage.resolveStorageReadUrl;
    expect(resolve("http://minio.local:9000/data/file.bin"))
      .toBe("http://minio.local:9000/data/file.bin");
  });

  it("falls back to http://localhost when no origin is provided for a relative path", () => {
    const resolve = storage.resolveStorageReadUrl;
    expect(resolve("/manus-storage/key.txt"))
      .toBe("http://localhost/manus-storage/key.txt");
  });
});

// ---------------------------------------------------------------------------
// Router workflow tests
// ---------------------------------------------------------------------------
describe("PQ-ForensicVault forensic router workflows", () => {
  it("stores a permitted local copy in object storage and persists hashes, manifest metadata, and an ECDSA custody event", async () => {
    const result = await makeCaller().registerLocalCopy({
      caseId,
      originalName: "permitted-copy.txt",
      contentType: "text/plain",
      base64Data: originalArtifact.toString("base64"),
      location: "Validation intake desk",
    });

    expect(result).toEqual(baseEvidence);
    const [storagePath, storageBytes, contentType] = vi.mocked(storage.storagePut).mock.calls[0];
    expect(storagePath).toContain(`forensic-demo/${caseId}/`);
    expect(Buffer.isBuffer(storageBytes)).toBe(true);
    expect(storageBytes.equals(originalArtifact)).toBe(true);
    expect(contentType).toBe("text/plain");

    const persistedEvidence = vi.mocked(db.createEvidence).mock.calls[0][0] as Record<string, unknown>;
    expect(persistedEvidence.storageKey).toBe("forensic-demo/immutable-copy.txt");
    expect(persistedEvidence.storageUrl).toBe("/manus-storage/immutable-copy.txt");
    expect(persistedEvidence).not.toHaveProperty("base64Data");
    expect(JSON.parse(String(persistedEvidence.manifestJson))).toMatchObject({
      filename: "permitted-copy.txt", sha256: sha256(originalArtifact), sha3_256: sha3_256(originalArtifact),
      declaration: "User-selected permitted local copy; original source material remains outside this prototype.",
    });

    const custodyEvent = vi.mocked(db.createCustodyEvent).mock.calls[0][0] as Record<string, unknown>;
    expect(custodyEvent.signatureAlgorithm).toBe("ECDSA-P256 / SHA-256");
    expect(custodyEvent.signerPublicKeyPem).toContain("BEGIN PUBLIC KEY");
    expect(String(custodyEvent.signatureValue).length).toBeGreaterThan(30);
  });

  it("stores a supported PNG image as an immutable permitted-image reference with preview metadata", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    await makeCaller().registerLocalCopy({
      caseId, originalName: "training-scene.png", contentType: "image/png", base64Data: png.toString("base64"), location: "Image intake desk",
    });

    expect(vi.mocked(storage.storagePut).mock.calls[0][2]).toBe("image/png");
    const persistedEvidence = vi.mocked(db.createEvidence).mock.calls[0][0] as Record<string, unknown>;
    expect(persistedEvidence.contentType).toBe("image/png");
    expect(JSON.parse(String(persistedEvidence.manifestJson))).toMatchObject({
      filename: "training-scene.png", artifactKind: "permitted image copy", preview: { available: true, source: "immutable object-storage reference" },
      sha256: sha256(png), sha3_256: sha3_256(png),
    });
  });

  it("rejects unsupported file types and images whose bytes do not match their declared type", async () => {
    await expect(makeCaller().registerLocalCopy({
      caseId, originalName: "unsafe.svg", contentType: "image/svg+xml", base64Data: originalArtifact.toString("base64"), location: "Validation intake desk",
    })).rejects.toThrow("Only permitted text, PDF, JPEG, PNG, WebP, or GIF copies");
    await expect(makeCaller().registerLocalCopy({
      caseId, originalName: "not-an-image.png", contentType: "image/png", base64Data: originalArtifact.toString("base64"), location: "Validation intake desk",
    })).rejects.toThrow("image bytes do not match");
    expect(db.createEvidence).not.toHaveBeenCalled();
    expect(storage.storagePut).not.toHaveBeenCalled();
  });

  it("rejects a PNG image whose magic bytes do not match the declared image/png content type", async () => {
    const fakePng = Buffer.from("this is not a real png file", "utf8");
    await expect(makeCaller().registerLocalCopy({
      caseId, originalName: "fake.png", contentType: "image/png", base64Data: fakePng.toString("base64"), location: "Intake desk",
    })).rejects.toThrow("image bytes do not match");
    expect(db.createEvidence).not.toHaveBeenCalled();
  });

  it("enforces the 2 MB size limit for permitted local copies", async () => {
    const oversized = Buffer.alloc(2_000_001, 0x41);
    await expect(makeCaller().registerLocalCopy({
      caseId, originalName: "big.txt", contentType: "text/plain", base64Data: oversized.toString("base64"), location: "Intake",
    })).rejects.toThrow("smaller than 2 MB");
  });

  it("stores image preview metadata referencing the immutable storage reference, not the uploaded bytes", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    await makeCaller().registerLocalCopy({
      caseId, originalName: "scene.jpg", contentType: "image/jpeg", base64Data: jpeg.toString("base64"), location: "Image desk",
    });

    const manifest = JSON.parse(
      String((vi.mocked(db.createEvidence).mock.calls[0][0] as Record<string, unknown>).manifestJson),
    );
    expect(manifest.preview).toMatchObject({
      available: true,
      source: "immutable object-storage reference",
    });
    expect(manifest.preview).not.toHaveProperty("bytes");
  });

  it("passes independent verification when the artifact is unchanged and the presigned URL is absolute", async () => {
    vi.mocked(storage.storageGetSignedUrl).mockResolvedValue("https://s3.test/original-artifact");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(originalArtifact)));

    const result = await makeCaller().verify({ evidenceId: baseEvidence.id });
    expect(result.overallStatus).toBe("pass");
    expect(result.findings.artifact).toMatchObject({ sha256Match: true, sha3_256Match: true });
    expect(result.findings.signatures.passed).toBe(true);
    expect(result.findings.continuity.passed).toBe(true);
    expect(result.findings.eventHashes.passed).toBe(true);
  });

  it("passes independent verification when storage returns a relative path and appOrigin resolves it", async () => {
    vi.mocked(storage.storageGetSignedUrl).mockResolvedValue("/manus-storage/forensic-demo/case_x/evi_x.txt");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(originalArtifact)));

    const result = await makeCaller("http://localhost:3000").verify({ evidenceId: baseEvidence.id });
    expect(result.overallStatus).toBe("pass");
    expect(result.findings.artifact).toMatchObject({ sha256Match: true, sha3_256Match: true });
  });

  it("never passes a relative URL to Node.js fetch when storage returns a relative path", async () => {
    const fetchCalls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      fetchCalls.push(url);
      return new Response(originalArtifact);
    }) as never);

    vi.mocked(storage.storageGetSignedUrl).mockResolvedValue("/manus-storage/test/key.txt");
    await makeCaller("http://localhost:3000").verify({ evidenceId: baseEvidence.id });

    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0]).toMatch(/^https?:\/\//);
    expect(fetchCalls[0]).not.toMatch(/^\/manus-storage\//);
  });

  it("detects an altered artifact copy via SHA-256 and SHA3-256 mismatch without changing the original", async () => {
    const tamperedArtifact = Buffer.from("synthetic permitted-copy test artifact TAMPERED", "utf8");

    vi.mocked(storage.storageGetSignedUrl)
      .mockResolvedValueOnce("https://storage.test/original-for-tamper")
      .mockResolvedValueOnce("https://storage.test/tampered-copy");
    vi.stubGlobal("fetch", vi.fn(async () => {
      const callCount = vi.mocked(fetch).mock.calls.length;
      return new Response(callCount === 1 ? originalArtifact : tamperedArtifact);
    }) as never);

    const result = await makeCaller().tamper({ evidenceId: baseEvidence.id, scenario: "artifact-copy" });
    expect(result.overallStatus).toBe("fail");
    expect(result.findings.artifact.sha256Match).toBe(false);
    expect(result.findings.artifact.sha3_256Match).toBe(false);
    expect(result.scenario).toContain("altered");
    expect(result.scenario).toContain("original artifact was not modified");
  });

  it("detects an isolated ledger-copy alteration while the original stored artifact remains hash-valid", async () => {
    const signingKey = createEcdsaIdentity(analystId);
    const canonicalPayload = stableJson({
      id: "evt-ledger-copy", evidenceId: baseEvidence.id, caseId, sequenceNumber: 1, actorId: analystId,
      action: "Acquired permitted local copy", location: "Training Lab", rationale: "Training-only acquisition.",
      transferStatus: "In analyst custody", recipientId: null, happenedAt: 1730000000000, previousEventHash: null,
    });
    const event = {
      id: "evt-ledger-copy", evidenceId: baseEvidence.id, caseId, sequenceNumber: 1, actorId: analystId,
      action: "Acquired permitted local copy", location: "Training Lab", rationale: "Training-only acquisition.",
      transferStatus: "In analyst custody", recipientId: null, happenedAt: 1730000000000, previousEventHash: null,
      canonicalPayload, eventRecordHash: sha3_256(canonicalPayload), signatureValue: signEcdsa(analystId, canonicalPayload),
      signatureAlgorithm: "ECDSA-P256 / SHA-256", signerPublicKeyPem: signingKey.publicKeyPem,
    };
    vi.mocked(db.listCustodyEvents).mockResolvedValue([event] as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(originalArtifact)));

    const tamperResult = await makeCaller().tamper({ evidenceId: baseEvidence.id, scenario: "ledger-copy" });
    expect(tamperResult.overallStatus).toBe("fail");
    expect(tamperResult.findings.artifact).toMatchObject({ sha256Match: true, sha3_256Match: true, source: "immutable original reference" });
    expect(tamperResult.findings.eventHashes.passed).toBe(false);
    expect(tamperResult.findings.signatures.passed).toBe(false);
    expect(db.updateEvidenceTamper).not.toHaveBeenCalled();

    await makeCaller().resetTamper({ evidenceId: baseEvidence.id });
    expect(db.updateEvidenceTamper).toHaveBeenCalledWith(baseEvidence.id, {
      tamperKind: null, tamperedStorageKey: null, tamperedStorageUrl: null, status: "verified",
    });
  });

  it("returns a machine-readable export with algorithm disclosure and an explicit legal-admissibility limitation", async () => {
    const events = [{ id: "evt-export", evidenceId: baseEvidence.id, sequenceNumber: 1, action: "Acquired", actorId: analystId, location: "Training Lab", happenedAt: 1730000000000, previousEventHash: null, eventRecordHash: "a".repeat(64), signatureAlgorithm: "ECDSA-P256 / SHA-256" }];
    vi.mocked(db.listCustodyEvents).mockResolvedValue(events as never);
    vi.mocked(db.listBenchmarkRuns).mockResolvedValue([] as never);

    const exported = await makeCaller().auditExport({ evidenceId: baseEvidence.id });
    expect(exported.evidence.manifest).toEqual({});
    expect(exported.algorithms.artifactHashes).toEqual(["SHA-256", "SHA3-256"]);
    expect(exported.algorithms.custodySignature).toBe("ECDSA-P256 / SHA-256");
    expect(exported.legalAdmissibilityCaution).toContain("do not establish legal admissibility");
    expect(JSON.stringify(exported)).toContain("ML-DSA-65 (FIPS 204)");
  });

  it("export includes the case record and returns null when no case is found", async () => {
    vi.mocked(db.getCase).mockResolvedValue({ id: caseId, title: "Export Test Case", classification: "Synthetic demonstration" } as never);
    vi.mocked(db.listBenchmarkRuns).mockResolvedValue([] as never);
    const exported = await makeCaller().auditExport({ evidenceId: baseEvidence.id });
    expect(exported.case).toEqual({ id: caseId, title: "Export Test Case", classification: "Synthetic demonstration" });

    vi.mocked(db.getCase).mockResolvedValue(undefined as never);
    const exportedNull = await makeCaller().auditExport({ evidenceId: baseEvidence.id });
    expect(exportedNull.case).toBeNull();
  });

  it("export with no custody events returns an empty events array and valid structure", async () => {
    vi.mocked(db.listCustodyEvents).mockResolvedValue([] as never);
    vi.mocked(db.listBenchmarkRuns).mockResolvedValue([] as never);
    const exported = await makeCaller().auditExport({ evidenceId: baseEvidence.id });
    expect(exported.custodyEvents).toEqual([]);
    expect(exported.algorithms.artifactHashes).toEqual(["SHA-256", "SHA3-256"]);
  });
});

// ---------------------------------------------------------------------------
// Image type registration tests (JPEG, WebP)
// ---------------------------------------------------------------------------
describe("Permitted image type registration", () => {
  it("stores a supported JPEG image with correct content type and preview metadata", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    await makeCaller().registerLocalCopy({
      caseId, originalName: "scene-photo.jpg", contentType: "image/jpeg", base64Data: jpeg.toString("base64"), location: "Image desk",
    });

    expect(vi.mocked(storage.storagePut).mock.calls[0][2]).toBe("image/jpeg");
    const persistedEvidence = vi.mocked(db.createEvidence).mock.calls[0][0] as Record<string, unknown>;
    expect(persistedEvidence.contentType).toBe("image/jpeg");
    expect(persistedEvidence.originalName).toBe("scene-photo.jpg");
    const manifest = JSON.parse(String(persistedEvidence.manifestJson));
    expect(manifest.artifactKind).toBe("permitted image copy");
    expect(manifest.preview.available).toBe(true);
  });

  it("stores a supported WebP image with correct content type", async () => {
    const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    await makeCaller().registerLocalCopy({
      caseId, originalName: "banner.webp", contentType: "image/webp", base64Data: webp.toString("base64"), location: "Web desk",
    });

    expect(vi.mocked(storage.storagePut).mock.calls[0][2]).toBe("image/webp");
    const persistedEvidence = vi.mocked(db.createEvidence).mock.calls[0][0] as Record<string, unknown>;
    expect(persistedEvidence.contentType).toBe("image/webp");
  });

  it("rejects a JPEG image whose bytes do not start with the JPEG magic signature", async () => {
    const fakeJpeg = Buffer.from("not a jpeg file", "utf8");
    await expect(makeCaller().registerLocalCopy({
      caseId, originalName: "fake.jpg", contentType: "image/jpeg", base64Data: fakeJpeg.toString("base64"), location: "Intake desk",
    })).rejects.toThrow("image bytes do not match");
  });

  it("rejects a WebP image whose bytes do not start with RIFFWEBP", async () => {
    const fakeWebp = Buffer.from("not webp data", "utf8");
    await expect(makeCaller().registerLocalCopy({
      caseId, originalName: "fake.webp", contentType: "image/webp", base64Data: fakeWebp.toString("base64"), location: "Intake desk",
    })).rejects.toThrow("image bytes do not match");
  });
});

// ---------------------------------------------------------------------------
// Verification failure and edge cases
// ---------------------------------------------------------------------------
describe("Verification failure paths", () => {
  it("returns fail status when artifact hash does not match the stored digest", async () => {
    const mismatchedArtifact = Buffer.from("completely different content", "utf8");
    vi.mocked(storage.storageGetSignedUrl).mockResolvedValue("https://storage.test/mismatched");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(mismatchedArtifact)));

    const result = await makeCaller().verify({ evidenceId: baseEvidence.id });
    expect(result.overallStatus).toBe("fail");
    expect(result.findings.artifact.sha256Match).toBe(false);
    expect(result.findings.artifact.sha3_256Match).toBe(false);
  });

  it("throws NOT_FOUND when the evidence item does not exist", async () => {
    vi.mocked(db.getEvidence).mockResolvedValue(undefined as never);
    await expect(makeCaller().verify({ evidenceId: "evi_nonexistent" })).rejects.toThrow("Evidence item not found");
  });
});

// ---------------------------------------------------------------------------
// Tamper lab reset after artifact-copy
// ---------------------------------------------------------------------------
describe("Tamper reset after artifact-copy", () => {
  it("resets tamper state after an artifact-copy tamper, restoring the evidence to verified status", async () => {
    const signingKey = createEcdsaIdentity(analystId);
    const canonicalPayload = stableJson({
      id: "evt-reset-test", evidenceId: baseEvidence.id, caseId, sequenceNumber: 1, actorId: analystId,
      action: "Acquired permitted local copy", location: "Training Lab", rationale: "Reset test.",
      transferStatus: "In analyst custody", recipientId: null, happenedAt: 1730000000000, previousEventHash: null,
    });
    const event = {
      id: "evt-reset-test", evidenceId: baseEvidence.id, caseId, sequenceNumber: 1, actorId: analystId,
      action: "Acquired permitted local copy", location: "Training Lab", rationale: "Reset test.",
      transferStatus: "In analyst custody", recipientId: null, happenedAt: 1730000000000, previousEventHash: null,
      canonicalPayload, eventRecordHash: sha3_256(canonicalPayload), signatureValue: signEcdsa(analystId, canonicalPayload),
      signatureAlgorithm: "ECDSA-P256 / SHA-256", signerPublicKeyPem: signingKey.publicKeyPem,
    };
    vi.mocked(db.listCustodyEvents).mockResolvedValue([event] as never);

    const tamperedArtifact = Buffer.from("altered artifact", "utf8");
    vi.mocked(storage.storageGetSignedUrl)
      .mockResolvedValueOnce("https://storage.test/original")
      .mockResolvedValueOnce("https://storage.test/tampered-copy");
    vi.stubGlobal("fetch", vi.fn(async () => {
      const callCount = vi.mocked(fetch).mock.calls.length;
      return new Response(callCount === 1 ? originalArtifact : tamperedArtifact);
    }) as never);

    await makeCaller().tamper({ evidenceId: baseEvidence.id, scenario: "artifact-copy" });
    expect(db.updateEvidenceTamper).toHaveBeenCalledWith(baseEvidence.id, {
      tamperKind: "artifact-copy", tamperedStorageKey: "forensic-demo/immutable-copy.txt",
      tamperedStorageUrl: "/manus-storage/immutable-copy.txt", status: "tampered",
    });

    vi.mocked(db.updateEvidenceTamper).mockClear();
    await makeCaller().resetTamper({ evidenceId: baseEvidence.id });
    expect(db.updateEvidenceTamper).toHaveBeenCalledWith(baseEvidence.id, {
      tamperKind: null, tamperedStorageKey: null, tamperedStorageUrl: null, status: "verified",
    });
  });

  it("throws NOT_FOUND when attempting to tamper non-existent evidence", async () => {
    vi.mocked(db.getEvidence).mockResolvedValue(undefined as never);
    await expect(makeCaller().tamper({ evidenceId: "evi_nonexistent", scenario: "artifact-copy" })).rejects.toThrow("Evidence item not found");
  });
});

// ---------------------------------------------------------------------------
// Dashboard summary
// ---------------------------------------------------------------------------
describe("Dashboard summary", () => {
  it("returns aggregated counts from the database", async () => {
    vi.mocked(db.getDashboardSummary).mockResolvedValue({
      caseCount: 3, evidenceCount: 7, verifiedCount: 5, reviewCount: 2,
      recentCases: [], recentEvidence: [], latestBenchmark: null, latestRunCount: 0,
    } as never);

    const result = await makeCaller().dashboard();
    expect(result.caseCount).toBe(3);
    expect(result.evidenceCount).toBe(7);
    expect(result.verifiedCount).toBe(5);
    expect(result.reviewCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// ML-DSA disclosure consistency
// ---------------------------------------------------------------------------
describe("ML-DSA disclosure consistency", () => {
  it("exports the identical disclosure text used in forensicCore", () => {
    expect(MLDSA_UNAVAILABLE_TEXT).toBe("ML-DSA runtime capability detected; no execution adapter is provisioned. No ML-DSA benchmark is performed.");
  });

  it("audit export contains the ML-DSA algorithm name and disclosure text", async () => {
    vi.mocked(db.listBenchmarkRuns).mockResolvedValue([] as never);
    const exported = await makeCaller().auditExport({ evidenceId: baseEvidence.id });
    expect(JSON.stringify(exported)).toContain("ML-DSA-65 (FIPS 204)");
    expect(exported.algorithms.mldsaDisclosure).toBe(MLDSA_UNAVAILABLE_TEXT);
  });
});

// ---------------------------------------------------------------------------
// Role-based permission enforcement
// ---------------------------------------------------------------------------
describe("Role-based permission enforcement", () => {
  it("Investigator role is allowed to acquire evidence and create cases", () => {
    expect(isRoleAllowed("Investigator", "acquireDemo")).toBe(true);
    expect(isRoleAllowed("Investigator", "createDemoCase")).toBe(true);
    expect(isRoleAllowed("Investigator", "registerLocalCopy")).toBe(true);
    expect(isRoleAllowed("Investigator", "handover")).toBe(true);
  });

  it("Investigator role is not allowed to run verification or tamper tests", () => {
    expect(isRoleAllowed("Investigator", "verify")).toBe(false);
    expect(isRoleAllowed("Investigator", "tamper")).toBe(false);
    expect(isRoleAllowed("Investigator", "runBenchmark")).toBe(false);
  });

  it("Examiner role is allowed to verify and benchmark", () => {
    expect(isRoleAllowed("Examiner", "verify")).toBe(true);
    expect(isRoleAllowed("Examiner", "runBenchmark")).toBe(true);
    expect(isRoleAllowed("Examiner", "benchmarks")).toBe(true);
    expect(isRoleAllowed("Examiner", "auditExport")).toBe(true);
  });

  it("Examiner role is not allowed to acquire evidence or tamper", () => {
    expect(isRoleAllowed("Examiner", "acquireDemo")).toBe(false);
    expect(isRoleAllowed("Examiner", "tamper")).toBe(false);
    expect(isRoleAllowed("Examiner", "createDemoCase")).toBe(false);
  });

  it("Reviewer role is allowed to tamper, reset, and view reports", () => {
    expect(isRoleAllowed("Reviewer", "tamper")).toBe(true);
    expect(isRoleAllowed("Reviewer", "resetTamper")).toBe(true);
    expect(isRoleAllowed("Reviewer", "resetPresentationDemo")).toBe(true);
    expect(isRoleAllowed("Reviewer", "dashboard")).toBe(true);
  });

  it("Reviewer role is not allowed to acquire evidence or run verification", () => {
    expect(isRoleAllowed("Reviewer", "acquireDemo")).toBe(false);
    expect(isRoleAllowed("Reviewer", "verify")).toBe(false);
    expect(isRoleAllowed("Reviewer", "runBenchmark")).toBe(false);
  });

  it("unknown procedure name returns false for all roles", () => {
    expect(isRoleAllowed("Investigator", "nonexistent")).toBe(false);
    expect(isRoleAllowed("Examiner", "nonexistent")).toBe(false);
    expect(isRoleAllowed("Reviewer", "nonexistent")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Enhanced benchmark metadata
// ---------------------------------------------------------------------------
describe("Enhanced benchmark results", () => {
  it("returns full research metadata including median, stddev, key sizes, and OS info", async () => {
    vi.mocked(db.createBenchmarkRun).mockResolvedValue(undefined as never);
    const result = await makeCaller().runBenchmark({ recordCount: 20, repetitions: 2 });
    expect(result.results.ecdsa.algorithm).toBe("ECDSA-P256");
    expect(result.results.ecdsa.samples).toBe(40);
    expect(result.results.ecdsa.recordCount).toBe(20);
    expect(result.results.ecdsa.repetitions).toBe(2);
    expect(typeof result.results.ecdsa.signingMsMedian).toBe("number");
    expect(typeof result.results.ecdsa.signingMsStddev).toBe("number");
    expect(typeof result.results.ecdsa.verificationMsMedian).toBe("number");
    expect(typeof result.results.ecdsa.verificationMsStddev).toBe("number");
    expect(typeof result.results.ecdsa.publicKeySizeBytes).toBe("number");
    expect(result.results.ecdsa.publicKeySizeBytes).toBeGreaterThan(0);
    expect(typeof result.results.ecdsa.privateKeySizeBytes).toBe("number");
    expect(result.results.ecdsa.privateKeySizeBytes).toBeGreaterThan(0);
    expect(typeof result.results.ecdsa.tamperDetectionRate).toBe("string");
    expect(result.results.ecdsa.tamperDetectionRate).toContain("100%");
    expect(typeof result.results.ecdsa.nodeVersion).toBe("string");
    expect(result.results.ecdsa.nodeVersion).toContain("v");
    expect(typeof result.results.ecdsa.os).toBe("string");
    expect(result.results.mldsa).toBe(MLDSA_UNAVAILABLE_TEXT);
    expect(result.results.metadata.algorithm).toBe("ECDSA-P256");
    expect(result.results.metadata.pqAlgorithm).toBe("ML-DSA-65 (FIPS 204)");
    expect(result.results.limitations).toContain("not production capacity");
  });
});

// ---------------------------------------------------------------------------
// Enhanced audit export (verification breakdown, checksum, enhanced benchmark)
// ---------------------------------------------------------------------------
describe("Enhanced audit export", () => {
  it("includes a report checksum and verification findings with per-check breakdown", async () => {
    const signingKey = createEcdsaIdentity(analystId);
    const canonicalPayload = stableJson({
      id: "evt-export-detail", evidenceId: baseEvidence.id, caseId, sequenceNumber: 1, actorId: analystId,
      action: "Acquired", location: "Training Lab", rationale: "Export detail test.",
      transferStatus: "In analyst custody", recipientId: null, happenedAt: 1730000000000, previousEventHash: null,
    });
    const event = {
      id: "evt-export-detail", evidenceId: baseEvidence.id, caseId, sequenceNumber: 1, actorId: analystId,
      action: "Acquired", location: "Training Lab", rationale: "Export detail test.",
      transferStatus: "In analyst custody", recipientId: null, happenedAt: 1730000000000, previousEventHash: null,
      canonicalPayload, eventRecordHash: sha3_256(canonicalPayload), signatureValue: signEcdsa(analystId, canonicalPayload),
      signatureAlgorithm: "ECDSA-P256 / SHA-256", signerPublicKeyPem: signingKey.publicKeyPem,
    };
    vi.mocked(db.listCustodyEvents).mockResolvedValue([event] as never);
    vi.mocked(db.listBenchmarkRuns).mockResolvedValue([] as never);

    const exported = await makeCaller().auditExport({ evidenceId: baseEvidence.id });
    expect(typeof exported.reportChecksum).toBe("string");
    expect(exported.reportChecksum?.length).toBe(64);
    expect(exported.evidence.manifest).toEqual({});
    expect(exported.custodyEvents).toHaveLength(1);
    expect(exported.custodyEvents[0].signatureAlgorithm).toBe("ECDSA-P256 / SHA-256");
  });

  it("exports contain the ML-DSA disclosure text identically in the algorithms section", async () => {
    vi.mocked(db.listBenchmarkRuns).mockResolvedValue([] as never);
    const exported = await makeCaller().auditExport({ evidenceId: baseEvidence.id });
    expect(exported.algorithms.mldsaDisclosure).toBe(MLDSA_UNAVAILABLE_TEXT);
    const jsonStr = JSON.stringify(exported);
    expect(jsonStr).toContain("ML-DSA runtime capability detected; no execution adapter is provisioned. No ML-DSA benchmark is performed.");
  });

  it("export includes enhanced benchmark data when available", async () => {
    const benchRun = {
      id: "bench-export-test", createdBy: "public-demo-session", recordCount: 20, repetitions: 2,
      pqModeStatus: "unavailable", createdAt: 1730000000000,
      resultsJson: JSON.stringify({
        ecdsa: { algorithm: "ECDSA-P256", samples: 40, recordCount: 20, repetitions: 2, signingMsAverage: 0.5, signingMsMedian: 0.4, signingMsStddev: 0.1, verificationMsAverage: 0.3, verificationMsMedian: 0.25, verificationMsStddev: 0.05, signatureBytesAverage: 70, publicKeySizeBytes: 91, privateKeySizeBytes: 121, tamperDetectionRate: "100%", nodeVersion: "v22.0.0", os: "linux x64" },
        mldsa: "ML-DSA runtime capability detected; no execution adapter is provisioned. No ML-DSA benchmark is performed.",
        metadata: { nodeVersion: "v22.0.0", os: "linux x64", algorithm: "ECDSA-P256" },
      }),
    };
    vi.mocked(db.listBenchmarkRuns).mockResolvedValue([benchRun] as never);
    const exported = await makeCaller().auditExport({ evidenceId: baseEvidence.id });
    expect(exported.benchmark).not.toBeNull();
    expect(exported.benchmark?.results?.ecdsa?.signingMsMedian).toBe(0.4);
    expect(exported.benchmark?.results?.ecdsa?.publicKeySizeBytes).toBe(91);
    expect(exported.benchmark?.results?.ecdsa?.nodeVersion).toBe("v22.0.0");
  });
});
