export type ExportCustodyEvent = {
  sequenceNumber: number;
  id: string;
  action: string;
  actorId: string;
  location: string;
  happenedAt: number;
  previousEventHash: string | null;
  eventRecordHash: string;
  signatureAlgorithm: string;
};

type AuditExportInput = {
  generatedAt: number;
  case: { title: string | null } | null;
  evidence: { originalName: string; sha256: string; sha3_256: string; manifest: unknown };
  custodyEvents: ExportCustodyEvent[];
  latestVerification: { overallStatus: string; findings: unknown } | null;
  algorithms: { artifactHashes: string[]; custodySignature: string; pqCapability: { algorithm: string; status: string; detail: string; executionAvailable?: boolean; adapterStatus?: unknown }; mldsaDisclosure?: string };
  benchmark: { createdAt: number; results: {
    ecdsa?: {
      signingMsAverage: number; signingMsMedian?: number; signingMsStddev?: number;
      verificationMsAverage: number; verificationMsMedian?: number; verificationMsStddev?: number;
      signatureBytesAverage: number; samples: number; recordCount?: number; repetitions?: number;
      publicKeySizeBytes?: number; privateKeySizeBytes?: number; storageOverheadBytes?: number;
      tamperDetectionRate?: string; nodeVersion?: string; os?: string;
    };
    mldsa?: string | {
      signingMsAverage: number; signingMsMedian?: number; signingMsStddev?: number;
      verificationMsAverage: number; verificationMsMedian?: number; verificationMsStddev?: number;
      signatureBytesAverage: number; samples: number; recordCount?: number; repetitions?: number;
      publicKeySizeBytes?: number; secretKeySizeBytes?: number; signatureSizeBytes?: number;
      storageOverheadBytes?: number; tamperDetectionRate?: string; nodeVersion?: string; os?: string;
      packageVersion?: string; audit?: string;
    };
    metadata?: { nodeVersion: string; os: string; algorithm: string; executionAvailable?: boolean }
  } } | null;
  legalAdmissibilityCaution: string;
  reportChecksum?: string;
};

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function buildCustodyCsv(report: AuditExportInput): string {
  const metadata = [
    ["report_type", "PQ-ForensicVault audit export"],
    ["generated_at_utc_ms", report.generatedAt],
    ["case", report.case?.title ?? "Unknown case"],
    ["evidence", report.evidence.originalName],
    ["sha256", report.evidence.sha256],
    ["sha3_256", report.evidence.sha3_256],
    ["custody_signature", report.algorithms.custodySignature],
    ["pq_capability", `${report.algorithms.pqCapability.algorithm}: ${report.algorithms.pqCapability.status}`],
    ["latest_verification", report.latestVerification?.overallStatus ?? "No verification run recorded"],
    ["legal_admissibility_caution", report.legalAdmissibilityCaution],
    ["report_checksum", report.reportChecksum ?? "not computed"],
    ...(report.benchmark ? [
      ["benchmark_algorithm", report.benchmark.results?.ecdsa?.signingMsAverage !== undefined ? "ECDSA-P256" : "none"],
      ["benchmark_samples", String(report.benchmark.results?.ecdsa?.samples ?? 0)],
      ["benchmark_record_count", String(report.benchmark.results?.ecdsa?.recordCount ?? "N/A")],
      ["benchmark_repetitions", String(report.benchmark.results?.ecdsa?.repetitions ?? "N/A")],
      ["benchmark_sign_avg_ms", String(report.benchmark.results?.ecdsa?.signingMsAverage ?? "N/A")],
      ["benchmark_sign_median_ms", String(report.benchmark.results?.ecdsa?.signingMsMedian ?? "N/A")],
      ["benchmark_sign_stddev_ms", String(report.benchmark.results?.ecdsa?.signingMsStddev ?? "N/A")],
      ["benchmark_verify_avg_ms", String(report.benchmark.results?.ecdsa?.verificationMsAverage ?? "N/A")],
      ["benchmark_verify_median_ms", String(report.benchmark.results?.ecdsa?.verificationMsMedian ?? "N/A")],
      ["benchmark_verify_stddev_ms", String(report.benchmark.results?.ecdsa?.verificationMsStddev ?? "N/A")],
      ["benchmark_signature_bytes", String(report.benchmark.results?.ecdsa?.signatureBytesAverage ?? "N/A")],
      ["benchmark_public_key_bytes", String(report.benchmark.results?.ecdsa?.publicKeySizeBytes ?? "N/A")],
      ["benchmark_tamper_detection_rate", report.benchmark.results?.ecdsa?.tamperDetectionRate ?? "N/A"],
      ["benchmark_node_version", report.benchmark.results?.ecdsa?.nodeVersion ?? report.benchmark.results?.metadata?.nodeVersion ?? "N/A"],
      ["benchmark_os", report.benchmark.results?.ecdsa?.os ?? report.benchmark.results?.metadata?.os ?? "N/A"],
      ["benchmark_mldsa", (() => {
        const m = report.benchmark.results?.mldsa;
        if (typeof m === "object" && m !== null && "signingMsAverage" in m) return `ML-DSA-65 real: sign=${(m as any).signingMsAverage}ms verify=${(m as any).verificationMsAverage}ms sig=${(m as any).signatureBytesAverage}B`;
        return typeof m === "string" ? m : "not executed";
      })()],
      ["benchmark_mldsa_execution", String(report.benchmark.results?.metadata?.executionAvailable ?? false)],
    ] : [["benchmark", "No benchmark recorded"]]),
    [],
    ["sequence", "event_id", "action", "actor", "location", "timestamp_utc_ms", "previous_event_hash", "record_hash", "signature_algorithm"],
    ...report.custodyEvents.map((event) => [
      event.sequenceNumber, event.id, event.action, event.actorId, event.location, event.happenedAt,
      event.previousEventHash ?? "GENESIS", event.eventRecordHash, event.signatureAlgorithm,
    ]),
  ];
  return metadata.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function buildAuditMarkdown(report: AuditExportInput): string {
  const verification = report.latestVerification
    ? (() => {
      const f = report.latestVerification.findings as Record<string, any>;
      const lines = [`**Latest result:** ${report.latestVerification.overallStatus}`];
      if (f?.artifact) {
        lines.push(`\n### Artifact integrity`);
        lines.push(`- SHA-256: **${f.artifact.sha256Match ? "MATCH" : "MISMATCH"}**`);
        lines.push(`- SHA3-256: **${f.artifact.sha3_256Match ? "MATCH" : "MISMATCH"}**`);
        if (f.artifact.byteSize !== undefined) lines.push(`- Byte size: ${f.artifact.byteSize}`);
        if (f.artifact.source) lines.push(`- Source: ${f.artifact.source}`);
      }
      if (f?.signatures) {
        lines.push(`\n### Signature verification`);
        lines.push(`- Algorithm: ${f.signatures.algorithm ?? "ECDSA-P256 / SHA-256"}`);
        lines.push(`- Result: **${f.signatures.passed ? "VALID" : "INVALID"}** (${f.signatures.validSignatures ?? 0}/${f.signatures.totalEvents ?? 0})`);
      }
      if (f?.continuity) {
        lines.push(`\n### Chain continuity`);
        lines.push(`- Result: **${f.continuity.passed ? "VALID" : "INVALID"}**`);
        lines.push(`- Linked events: ${f.continuity.linkedEvents ?? 0}/${f.continuity.eventCount ?? 0}`);
      }
      if (f?.eventHashes) {
        lines.push(`\n### Event hash integrity`);
        lines.push(`- Result: **${f.eventHashes.passed ? "VALID" : "ALTERED"}** (${f.eventHashes.validHashes ?? 0}/${f.eventHashes.totalEvents ?? 0})`);
      }
      if (f?.limitations) lines.push(`\n*${f.limitations}*`);
      lines.push(`\n<details><summary>Full findings JSON</summary>\n\n\`\`\`json\n${JSON.stringify(report.latestVerification.findings, null, 2)}\n\`\`\`\n</details>`);
      return lines.join("\n");
    })()
    : "No independent verification run has yet been recorded.";
  const eventRows = report.custodyEvents.length
    ? report.custodyEvents.map((event) => `| ${event.sequenceNumber} | ${event.action} | ${event.actorId} | ${event.location} | ${event.happenedAt} | \`${event.eventRecordHash}\` |`).join("\n")
    : "| — | No custody events recorded | — | — | — | — |";
  const benchmarkSection = report.benchmark
    ? (() => {
      const ecdsa = report.benchmark.results?.ecdsa;
      const mldsa = report.benchmark.results?.mldsa;
      const executionAvailable = report.benchmark.results?.metadata?.executionAvailable ?? false;
      const lines = [
        "## Benchmark results",
        "",
        "### ECDSA-P256",
        "",
        `- **Algorithm:** ${ecdsa?.signingMsAverage !== undefined ? "ECDSA-P256" : "N/A"}`,
        `- **Record count:** ${ecdsa?.recordCount ?? "N/A"}`,
        `- **Repetitions:** ${ecdsa?.repetitions ?? "N/A"}`,
        `- **Total samples:** ${ecdsa?.samples ?? 0}`,
        `- **Signing average:** ${ecdsa?.signingMsAverage ?? "N/A"} ms`,
        `- **Signing median:** ${ecdsa?.signingMsMedian ?? "N/A"} ms`,
        `- **Signing stddev:** ${ecdsa?.signingMsStddev ?? "N/A"} ms`,
        `- **Verification average:** ${ecdsa?.verificationMsAverage ?? "N/A"} ms`,
        `- **Verification median:** ${ecdsa?.verificationMsMedian ?? "N/A"} ms`,
        `- **Verification stddev:** ${ecdsa?.verificationMsStddev ?? "N/A"} ms`,
        `- **Signature size:** ${ecdsa?.signatureBytesAverage ?? "N/A"} bytes`,
        `- **Public key size:** ${ecdsa?.publicKeySizeBytes ?? "N/A"} bytes`,
        `- **Tamper detection rate:** ${ecdsa?.tamperDetectionRate ?? "N/A"}`,
      ];
      if (typeof mldsa === "object" && mldsa !== null && "signingMsAverage" in mldsa) {
        lines.push(
          "",
          "### ML-DSA-65 (real execution)",
          "",
          `- **Algorithm:** ML-DSA-65`,
          `- **Record count:** ${mldsa.recordCount ?? "N/A"}`,
          `- **Repetitions:** ${mldsa.repetitions ?? "N/A"}`,
          `- **Total samples:** ${mldsa.samples ?? 0}`,
          `- **Signing average:** ${mldsa.signingMsAverage} ms`,
          `- **Signing median:** ${mldsa.signingMsMedian ?? "N/A"} ms`,
          `- **Signing stddev:** ${mldsa.signingMsStddev ?? "N/A"} ms`,
          `- **Verification average:** ${mldsa.verificationMsAverage} ms`,
          `- **Verification median:** ${mldsa.verificationMsMedian ?? "N/A"} ms`,
          `- **Verification stddev:** ${mldsa.verificationMsStddev ?? "N/A"} ms`,
          `- **Signature size:** ${mldsa.signatureBytesAverage} bytes`,
          `- **Public key size:** ${mldsa.publicKeySizeBytes} bytes`,
          `- **Tamper detection rate:** ${mldsa.tamperDetectionRate}`,
          `- **Package:** ${mldsa.packageVersion ?? "N/A"}`,
          `- **Audit:** ${mldsa.audit ?? "N/A"}`,
        );
      } else {
        lines.push(
          "",
          "### ML-DSA-65",
          "",
          `- **Status:** ${typeof mldsa === "string" ? mldsa : "Not executed"}`,
        );
      }
      lines.push(
        "",
        "### Runtime",
        "",
        `- **Node version:** ${ecdsa?.nodeVersion ?? report.benchmark.results?.metadata?.nodeVersion ?? "N/A"}`,
        `- **OS:** ${ecdsa?.os ?? report.benchmark.results?.metadata?.os ?? "N/A"}`,
        `- **ML-DSA execution:** ${executionAvailable ? "Active (real ML-DSA-65 operations)" : "Not executed"}`,
      );
      return lines.join("\n");
    })()
    : "";
  return `# PQ-ForensicVault Audit Report

**Generated (UTC milliseconds):** ${report.generatedAt}
${report.reportChecksum ? `\n**Report checksum (SHA-256):** \`${report.reportChecksum}\`\n` : ""}
## Evidence manifest

- **Case:** ${report.case?.title ?? "Unknown case"}
- **Evidence:** ${report.evidence.originalName}
- **SHA-256:** \`${report.evidence.sha256}\`
- **SHA3-256:** \`${report.evidence.sha3_256}\`
- **Manifest:** \`${JSON.stringify(report.evidence.manifest)}\`

## Custody history

| Sequence | Action | Actor | Location | UTC milliseconds | Record hash |
| --- | --- | --- | --- | ---: | --- |
${eventRows}

## Verification result

${verification}

## Algorithm and capability disclosure

- **Artifact hashes:** ${report.algorithms.artifactHashes.join(", ")}
- **Custody signature:** ${report.algorithms.custodySignature}
- **Post-quantum capability:** ${report.algorithms.pqCapability.algorithm} — **${report.algorithms.pqCapability.status}**
- **ML-DSA disclosure:** ${report.algorithms.mldsaDisclosure ?? "Not available"}
- **Runtime detail:** ${report.algorithms.pqCapability.detail}

${benchmarkSection}
## Legal and methodological limitation

${report.legalAdmissibilityCaution}
`;
}
