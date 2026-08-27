import { describe, expect, it } from "vitest";
import { buildAuditMarkdown, buildCustodyCsv } from "./forensicExports";

const audit = {
  generatedAt: 1730000000000,
  case: { title: "Synthetic export case" },
  evidence: { originalName: "training-copy.txt", sha256: "a".repeat(64), sha3_256: "b".repeat(64), manifest: { declaration: "Synthetic only" } },
  custodyEvents: [{ sequenceNumber: 1, id: "evt-001", action: "Acquired", actorId: "inv-001", location: "Training Lab", happenedAt: 1730000000000, previousEventHash: null, eventRecordHash: "c".repeat(64), signatureAlgorithm: "ECDSA-P256 / SHA-256" }],
  latestVerification: {
    overallStatus: "pass",
    findings: {
      artifact: { sha256Match: true, sha3_256Match: true, byteSize: 1024, source: "immutable original reference" },
      signatures: { algorithm: "ECDSA-P256 / SHA-256", passed: true, totalEvents: 1, validSignatures: 1 },
      continuity: { passed: true, eventCount: 1, linkedEvents: 1 },
      eventHashes: { passed: true, totalEvents: 1, validHashes: 1 },
      limitations: "Technical integrity indicators only.",
    },
  },
  algorithms: { artifactHashes: ["SHA-256", "SHA3-256"], custodySignature: "ECDSA-P256 / SHA-256", pqCapability: { algorithm: "ML-DSA-65 (FIPS 204)", status: "unavailable", detail: "No usable runtime implementation." }, mldsaDisclosure: "ML-DSA runtime capability detected; no execution adapter is provisioned. No ML-DSA benchmark is performed." },
  benchmark: {
    createdAt: 1730000000000,
    results: {
      ecdsa: {
        algorithm: "ECDSA-P256", samples: 150, recordCount: 50, repetitions: 3,
        signingMsAverage: 0.5, signingMsMedian: 0.4, signingMsStddev: 0.1,
        verificationMsAverage: 0.3, verificationMsMedian: 0.25, verificationMsStddev: 0.05,
        signatureBytesAverage: 70.2, publicKeySizeBytes: 91, privateKeySizeBytes: 121,
        tamperDetectionRate: "100%", nodeVersion: "v22.0.0", os: "linux x64",
      },
      mldsa: "ML-DSA runtime capability detected; no execution adapter is provisioned. No ML-DSA benchmark is performed.",
      metadata: { nodeVersion: "v22.0.0", os: "linux x64", algorithm: "ECDSA-P256" },
    },
  },
  legalAdmissibilityCaution: "Technical checks do not establish legal admissibility.",
  reportChecksum: "a".repeat(64),
};

describe("forensic export rendering", () => {
  it("includes the audit metadata, custody history, algorithm disclosure, and legal limitation in CSV", () => {
    const csv = buildCustodyCsv(audit);
    expect(csv).toContain('"sha256","' + "a".repeat(64) + '"');
    expect(csv).toContain('"pq_capability","ML-DSA-65 (FIPS 204): unavailable"');
    expect(csv).toContain('"legal_admissibility_caution","Technical checks do not establish legal admissibility."');
    expect(csv).toContain('"evt-001","Acquired"');
  });

  it("renders all required audit sections and a structured verification result in the report", () => {
    const markdown = buildAuditMarkdown(audit);
    expect(markdown).toContain("## Evidence manifest");
    expect(markdown).toContain("## Custody history");
    expect(markdown).toContain("## Verification result");
    expect(markdown).toContain("## Algorithm and capability disclosure");
    expect(markdown).toContain("## Legal and methodological limitation");
    expect(markdown).toContain("Technical checks do not establish legal admissibility.");
  });

  it("renders the ML-DSA algorithm name and capability status in the report", () => {
    const markdown = buildAuditMarkdown(audit);
    expect(markdown).toContain("ML-DSA-65 (FIPS 204)");
    expect(markdown).toContain("unavailable");
    expect(markdown).toContain("ECDSA-P256 / SHA-256");
  });

  it("renders custody event details in the report table", () => {
    const markdown = buildAuditMarkdown(audit);
    expect(markdown).toContain("Acquired");
    expect(markdown).toContain("inv-001");
    expect(markdown).toContain("Training Lab");
  });
});

describe("Custody CSV export", () => {
  it("includes the event record hash and signature algorithm in CSV rows", () => {
    const csv = buildCustodyCsv(audit);
    expect(csv).toContain('"evt-001"');
    expect(csv).toContain('"ECDSA-P256 / SHA-256"');
    expect(csv).toContain('"sequence"');
    expect(csv).toContain('"event_id"');
    expect(csv).toContain('"action"');
  });

  it("renders a CSV with proper header row for custody events", () => {
    const csv = buildCustodyCsv(audit);
    const lines = csv.split("\n");
    const headerLine = lines.find((line) => line.includes('"sequence"'));
    expect(headerLine).toBeTruthy();
    expect(headerLine).toContain('"actor"');
    expect(headerLine).toContain('"timestamp_utc_ms"');
  });
});

describe("Audit export edge cases", () => {
  it("handles an export with no custody events and no verification", () => {
    const emptyAudit = { ...audit, custodyEvents: [], latestVerification: null };
    const markdown = buildAuditMarkdown(emptyAudit);
    expect(markdown).toContain("No custody events recorded");
    expect(markdown).toContain("No independent verification run has yet been recorded.");
    const csv = buildCustodyCsv(emptyAudit);
    expect(csv).toContain('"No verification run recorded"');
  });

  it("handles an export with null case", () => {
    const nullCaseAudit = { ...audit, case: null };
    const markdown = buildAuditMarkdown(nullCaseAudit);
    expect(markdown).toContain("Unknown case");
    const csv = buildCustodyCsv(nullCaseAudit);
    expect(csv).toContain('"Unknown case"');
  });
});

describe("Enhanced benchmark in exports", () => {
  it("CSV includes enhanced benchmark fields: median, stddev, key size, OS, node version", () => {
    const csv = buildCustodyCsv(audit);
    expect(csv).toContain('"benchmark_sign_median_ms","0.4"');
    expect(csv).toContain('"benchmark_sign_stddev_ms","0.1"');
    expect(csv).toContain('"benchmark_verify_median_ms","0.25"');
    expect(csv).toContain('"benchmark_verify_stddev_ms","0.05"');
    expect(csv).toContain('"benchmark_public_key_bytes","91"');
    expect(csv).toContain('"benchmark_tamper_detection_rate","100%"');
    expect(csv).toContain('"benchmark_node_version","v22.0.0"');
    expect(csv).toContain('"benchmark_os","linux x64"');
    expect(csv).toContain('"benchmark_record_count","50"');
    expect(csv).toContain('"benchmark_repetitions","3"');
  });

  it("Markdown includes enhanced benchmark fields", () => {
    const markdown = buildAuditMarkdown(audit);
    expect(markdown).toContain("**Record count:** 50");
    expect(markdown).toContain("**Repetitions:** 3");
    expect(markdown).toContain("**Signing median:** 0.4 ms");
    expect(markdown).toContain("**Signing stddev:** 0.1 ms");
    expect(markdown).toContain("**Verification median:** 0.25 ms");
    expect(markdown).toContain("**Verification stddev:** 0.05 ms");
    expect(markdown).toContain("**Public key size:** 91 bytes");
    expect(markdown).toContain("**Tamper detection rate:** 100%");
    expect(markdown).toContain("**Node version:** v22.0.0");
    expect(markdown).toContain("**OS:** linux x64");
  });

  it("CSV includes the report checksum", () => {
    const csv = buildCustodyCsv(audit);
    expect(csv).toContain('"report_checksum","' + "a".repeat(64) + '"');
  });

  it("Markdown includes the report checksum", () => {
    const markdown = buildAuditMarkdown(audit);
    expect(markdown).toContain("**Report checksum (SHA-256):**");
    expect(markdown).toContain("a".repeat(64));
  });
});

describe("Verification breakdown in Markdown", () => {
  it("renders per-check breakdown for artifact, signatures, continuity, and event hashes", () => {
    const markdown = buildAuditMarkdown(audit);
    expect(markdown).toContain("### Artifact integrity");
    expect(markdown).toContain("SHA-256: **MATCH**");
    expect(markdown).toContain("SHA3-256: **MATCH**");
    expect(markdown).toContain("### Signature verification");
    expect(markdown).toContain("Result: **VALID** (1/1)");
    expect(markdown).toContain("### Chain continuity");
    expect(markdown).toContain("Linked events: 1/1");
    expect(markdown).toContain("### Event hash integrity");
    expect(markdown).toContain("**VALID** (1/1)");
    expect(markdown).toContain("Technical integrity indicators only.");
  });

  it("renders a collapsible full findings JSON section", () => {
    const markdown = buildAuditMarkdown(audit);
    expect(markdown).toContain("<details><summary>Full findings JSON</summary>");
    expect(markdown).toContain('"sha256Match": true');
  });
});
