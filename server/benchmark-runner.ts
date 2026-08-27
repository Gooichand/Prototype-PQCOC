import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getPqCapability,
  measureEcdsaBenchmark,
  MLDSA_DISCLOSURE_TEXT,
} from "./forensicCore";

const BENCHMARK_CONFIGS = [
  { recordCount: 10, repetitions: 3 },
  { recordCount: 25, repetitions: 3 },
  { recordCount: 50, repetitions: 3 },
  { recordCount: 100, repetitions: 3 },
  { recordCount: 200, repetitions: 2 },
];

console.log("Running PQ-ForensicVault benchmark suite...\n");

const pqCapability = getPqCapability();
console.log(`ML-DSA-65 capability: ${pqCapability.status}`);
console.log(`ML-DSA disclosure: ${MLDSA_DISCLOSURE_TEXT}\n`);

const results = {
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  os: `${process.platform} ${process.arch}`,
  mlDsaCapability: pqCapability,
  mlDsaDisclosure: MLDSA_DISCLOSURE_TEXT,
  runs: [] as Array<{
    config: { recordCount: number; repetitions: number };
    ecdsa: ReturnType<typeof measureEcdsaBenchmark>;
    mldsa: string;
  }>,
};

for (const config of BENCHMARK_CONFIGS) {
  console.log(`Benchmarking ECDSA-P256: ${config.recordCount} records × ${config.repetitions} reps = ${config.recordCount * config.repetitions} samples...`);
  const ecdsa = measureEcdsaBenchmark(config.recordCount, config.repetitions);
  results.runs.push({ config, ecdsa, mldsa: MLDSA_DISCLOSURE_TEXT });
  console.log(`  Sign avg: ${ecdsa.signingMsAverage} ms | Verify avg: ${ecdsa.verificationMsAverage} ms | Sig size: ${ecdsa.signatureBytesAverage} bytes`);
}

const outputPath = resolve(import.meta.dirname ?? process.cwd(), "..", "benchmark-results.json");
writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf8");
console.log(`\nBenchmark results saved to: ${outputPath}`);

// Generate comparison table
const header = "| Records | Reps | Samples | Sign Avg (ms) | Sign Median | Verify Avg (ms) | Verify Median | Sig Bytes | PK Bytes |";
const separator = "|---------|------|---------|---------------|-------------|-----------------|---------------|-----------|----------|";
const rows = results.runs.map((r) =>
  `| ${r.config.recordCount} | ${r.config.repetitions} | ${r.ecdsa.samples} | ${r.ecdsa.signingMsAverage} | ${r.ecdsa.signingMsMedian} | ${r.ecdsa.verificationMsAverage} | ${r.ecdsa.verificationMsMedian} | ${r.ecdsa.signatureBytesAverage} | ${r.ecdsa.publicKeySizeBytes} |`
);

const table = [
  "# PQ-ForensicVault ECDSA-P256 Benchmark Results",
  "",
  `**Generated:** ${results.generatedAt}`,
  `**Node:** ${results.nodeVersion} | **OS:** ${results.os}`,
  `**ML-DSA-65 capability:** ${pqCapability.status}`,
  `**ML-DSA disclosure:** ${MLDSA_DISCLOSURE_TEXT}`,
  "",
  "## ECDSA-P256 Performance",
  "",
  header,
  separator,
  ...rows,
  "",
  "## Notes",
  "",
  "- All timings are lab measurements in this server runtime.",
  "- They are not production capacity or legal admissibility claims.",
  "- ML-DSA benchmarks are not performed when capability is unavailable.",
  "- ECDSA-P256 remains the active signing algorithm.",
].join("\n");

const mdPath = resolve(import.meta.dirname ?? process.cwd(), "..", "BENCHMARK_RESULTS.md");
writeFileSync(mdPath, table, "utf8");
console.log(`Benchmark table saved to: ${mdPath}`);
