import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getPqCapability,
  measureEcdsaBenchmark,
  measureMldsaBenchmark,
  MLDSA_DISCLOSURE_TEXT,
  getMldsa65ParameterMetadata,
} from "./forensicCore";
import { validateAdapter } from "./crypto/mldsaAdapter";

const BENCHMARK_CONFIGS = [
  { recordCount: 10, repetitions: 3 },
  { recordCount: 25, repetitions: 3 },
  { recordCount: 50, repetitions: 3 },
  { recordCount: 100, repetitions: 3 },
  { recordCount: 200, repetitions: 2 },
];

console.log("Running PQ-ForensicVault benchmark suite...\n");

const preValidationPq = getPqCapability();
console.log(`ML-DSA-65 native capability: ${preValidationPq.nativeNodeStatus}`);
console.log(`ML-DSA-65 adapter detail (pre-validation): ${preValidationPq.detail}\n`);

console.log("Validating ML-DSA-65 adapter...");
const adapterResult = validateAdapter();
console.log(`Adapter validation: ${adapterResult.adapterAvailable ? "PASSED" : "FAILED"}`);
console.log(`Adapter detail: ${adapterResult.detail}\n`);

const pqCapability = getPqCapability();
console.log(`ML-DSA-65 execution available: ${pqCapability.executionAvailable}\n`);

const mldsaMeta = pqCapability.executionAvailable ? getMldsa65ParameterMetadata() : null;
const mldsaDisclosure = pqCapability.executionAvailable
  ? "ML-DSA-65 execution adapter active. Real key generation, signing, verification, and tamper rejection were performed."
  : MLDSA_DISCLOSURE_TEXT;

interface RunResult {
  config: { recordCount: number; repetitions: number };
  ecdsa: ReturnType<typeof measureEcdsaBenchmark>;
  mldsa: ReturnType<typeof measureMldsaBenchmark>;
}

const results = {
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  os: `${process.platform} ${process.arch}`,
  mlDsaCapability: pqCapability,
  mlDsaDisclosure: mldsaDisclosure,
  mlDsaParameterMetadata: mldsaMeta,
  runs: [] as RunResult[],
};

for (const config of BENCHMARK_CONFIGS) {
  console.log(`Benchmarking: ${config.recordCount} records × ${config.repetitions} reps = ${config.recordCount * config.repetitions} samples...`);
  const ecdsa = measureEcdsaBenchmark(config.recordCount, config.repetitions);
  const mldsa = measureMldsaBenchmark(config.recordCount, config.repetitions);
  results.runs.push({ config, ecdsa, mldsa });
  console.log(`  ECDSA  — Sign avg: ${ecdsa.signingMsAverage} ms | Verify avg: ${ecdsa.verificationMsAverage} ms | Sig size: ${ecdsa.signatureBytesAverage} bytes`);
  if (mldsa) {
    console.log(`  ML-DSA — Sign avg: ${mldsa.signingMsAverage} ms | Verify avg: ${mldsa.verificationMsAverage} ms | Sig size: ${mldsa.signatureBytesAverage} bytes`);
  } else {
    console.log(`  ML-DSA — Not executed (${mldsaDisclosure})`);
  }
}

const outputPath = resolve(import.meta.dirname ?? process.cwd(), "..", "benchmark-results.json");
writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf8");
console.log(`\nBenchmark results saved to: ${outputPath}`);

// Generate comparison table
const ecdsaHeader = "| Records | Reps | Samples | ECDSA Sign Avg (ms) | ECDSA Sign Median | ECDSA Verify Avg (ms) | ECDSA Sig Bytes |";
const ecdsaSep = "|---------|------|---------|---------------------|-------------------|-----------------------|-----------------|";
const ecdsaRows = results.runs.map((r) =>
  `| ${r.config.recordCount} | ${r.config.repetitions} | ${r.ecdsa.samples} | ${r.ecdsa.signingMsAverage} | ${r.ecdsa.signingMsMedian} | ${r.ecdsa.verificationMsAverage} | ${r.ecdsa.signatureBytesAverage} |`
);

let mldsaSection = "";
if (results.runs.some((r) => r.mldsa)) {
  const mldsaHeader = "| Records | Reps | Samples | ML-DSA Sign Avg (ms) | ML-DSA Sign Median | ML-DSA Verify Avg (ms) | ML-DSA Sig Bytes | Tamper Rejections |";
  const mldsaSep = "|---------|------|---------|----------------------|--------------------|------------------------|------------------|-------------------|";
  const mldsaRows = results.runs.filter((r) => r.mldsa).map((r) => {
    const m = r.mldsa!;
    return `| ${r.config.recordCount} | ${r.config.repetitions} | ${m.samples} | ${m.signingMsAverage} | ${m.signingMsMedian} | ${m.verificationMsAverage} | ${m.signatureBytesAverage} | ${m.tamperDetectionRate} |`;
  });
  mldsaSection = [
    "",
    "## ML-DSA-65 Performance",
    "",
    mldsaHeader,
    mldsaSep,
    ...mldsaRows,
  ].join("\n");
}

const table = [
  "# PQ-ForensicVault Benchmark Results",
  "",
  `**Generated:** ${results.generatedAt}`,
  `**Node:** ${results.nodeVersion} | **OS:** ${results.os}`,
  `**ML-DSA-65 capability:** ${pqCapability.status}`,
  `**ML-DSA-65 execution:** ${pqCapability.executionAvailable ? "Active — real ML-DSA-65 signing and verification performed" : "Not executed"}`,
  mldsaMeta ? `**ML-DSA-65 package:** ${mldsaMeta.package}@${mldsaMeta.packageVersion} (${mldsaMeta.audit})` : "",
  "",
  "## ECDSA-P256 Performance",
  "",
  ecdsaHeader,
  ecdsaSep,
  ...ecdsaRows,
  mldsaSection,
  "",
  "## Notes",
  "",
  "- All timings are real measurements in this server runtime.",
  "- They are not production capacity or legal admissibility claims.",
  pqCapability.executionAvailable
    ? "- ML-DSA benchmarks use the same records, repetitions, and timing method as ECDSA."
    : "- ML-DSA benchmarks are not performed because the execution adapter is not available.",
  "- ECDSA-P256 remains the active signing algorithm for existing custody events.",
  "",
  "## ML-DSA-65 Parameter Metadata",
  "",
  mldsaMeta
    ? [
        `- **Algorithm:** ${mldsaMeta.algorithm}`,
        `- **Standard:** ${mldsaMeta.standard}`,
        `- **Security level:** Category ${mldsaMeta.securityLevel}`,
        `- **Public key:** ${mldsaMeta.publicKeyBytes} bytes`,
        `- **Secret key:** ${mldsaMeta.secretKeyBytes} bytes`,
        `- **Signature:** ${mldsaMeta.signatureBytes} bytes`,
        `- **Package:** ${mldsaMeta.package}@${mldsaMeta.packageVersion}`,
        `- **Audit:** ${mldsaMeta.audit}`,
      ].join("\n")
    : "ML-DSA-65 execution is not available in this environment.",
].join("\n");

const mdPath = resolve(import.meta.dirname ?? process.cwd(), "..", "BENCHMARK_RESULTS.md");
writeFileSync(mdPath, table, "utf8");
console.log(`Benchmark table saved to: ${mdPath}`);

// Generate CSV
const csvHeader = "record_count,repetitions,samples,ecdsa_sign_avg_ms,ecdsa_sign_median_ms,ecdsa_verify_avg_ms,ecdsa_sig_bytes,mldsa_sign_avg_ms,mldsa_sign_median_ms,mldsa_verify_avg_ms,mldsa_sig_bytes,mldsa_tamper_rejections";
const csvRows = results.runs.map((r) => {
  const m = r.mldsa;
  return [
    r.config.recordCount,
    r.config.repetitions,
    r.ecdsa.samples,
    r.ecdsa.signingMsAverage,
    r.ecdsa.signingMsMedian,
    r.ecdsa.verificationMsAverage,
    r.ecdsa.signatureBytesAverage,
    m && typeof m === "object" && "signingMsAverage" in m ? m.signingMsAverage : "N/A",
    m && typeof m === "object" && "signingMsMedian" in m ? m.signingMsMedian : "N/A",
    m && typeof m === "object" && "verificationMsAverage" in m ? m.verificationMsAverage : "N/A",
    m && typeof m === "object" && "signatureBytesAverage" in m ? m.signatureBytesAverage : "N/A",
    m && typeof m === "object" && "tamperDetectionRate" in m ? m.tamperDetectionRate : "N/A",
  ].join(",");
});
const csvPath = resolve(import.meta.dirname ?? process.cwd(), "..", "benchmark-results.csv");
writeFileSync(csvPath, [csvHeader, ...csvRows].join("\n"), "utf8");
console.log(`Benchmark CSV saved to: ${csvPath}`);
