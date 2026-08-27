# PQ-ForensicVault Final Prototype Validation

**Validation purpose:** Freeze the implementation state that the research paper will describe as a proof-of-concept study of classical ECDSA-P256 and post-quantum ML-DSA-65 signatures for synthetic digital-evidence chain-of-custody records.

**Validated repository revision:** `c928af5` (`v2.1.0` before final hardening edits)

**Validation runtime:** Node.js `v22.13.0`, Linux `x64`, pnpm `10.4.1`

## 1. Quality gates

| Gate | Result | Evidence |
|---|---|---|
| Frozen dependency installation | PASS | `pnpm install --frozen-lockfile` completed successfully |
| Automated tests | PASS | 12 test files; 111 tests passed |
| TypeScript validation | PASS | `pnpm check` completed with exit code 0 |
| Production build | PASS | Vite and server bundle completed successfully |
| Main browser chunk | PASS | `452.92 kB` uncompressed, below the 500 kB advisory threshold |
| Debug output review | PASS | No application debug `console.log` statements were found in the reviewed UI flow |
| Analytics placeholder review | PASS | No unresolved `%VITE_ANALYTICS_*%` placeholders were found in the built HTML |

## 2. End-to-end forensic workflow

The automated workflow test covers the complete synthetic lifecycle:

1. Create a synthetic case and investigator context.
2. Acquire a generated training artifact.
3. Calculate SHA-256 and SHA3-256 digests.
4. Canonicalize and sign the acquisition custody event using ECDSA-P256.
5. Append a custody handover event with prior-event continuity.
6. Verify the unchanged artifact, event hashes, continuity, and signatures.
7. Register a permitted synthetic PNG and verify its stored copy.
8. Tamper only with an artifact copy and confirm verification failure.
9. Tamper only with a ledger copy and confirm verification failure.
10. Reset the controlled tamper state without modifying the original evidence.
11. Run the benchmark procedure.
12. Generate the Markdown audit report and validate the JSON/CSV export pathways.

The workflow uses synthetic or self-created data and does not claim legal admissibility. Cryptographic validation supports integrity and signer association; admissibility remains dependent on jurisdiction, procedure, documentation, expert testimony, and applicable standards.

## 3. Reproducible benchmark

The benchmark runner was executed with five configurations: 10, 25, 50, 100, and 200 records. It uses the same record payloads, repetition counts, and measurement method for ECDSA-P256 and ML-DSA-65. The ML-DSA adapter validation passed key generation, signing, verification, and modified-payload rejection before measurements began.

| Records | Repetitions | Samples | ECDSA sign avg. (ms) | ML-DSA sign avg. (ms) | ECDSA verify avg. (ms) | ML-DSA verify avg. (ms) | ECDSA signature (bytes) | ML-DSA signature (bytes) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 3 | 30 | 0.0696 | 9.5101 | 0.0954 | 2.4354 | 71 | 3309 |
| 25 | 3 | 75 | 0.0421 | 8.1508 | 0.0862 | 2.3487 | 71.1 | 3309 |
| 50 | 3 | 150 | 0.0396 | 8.5854 | 0.0841 | 2.3403 | 71.1 | 3309 |
| 100 | 3 | 300 | 0.0395 | 9.3049 | 0.0854 | 2.3707 | 71 | 3309 |
| 200 | 2 | 400 | 0.0393 | 9.1969 | 0.0854 | 2.36 | 71 | 3309 |

The generated benchmark artifacts are `benchmark-results.json`, `benchmark-results.csv`, `BENCHMARK_RESULTS.md`, and `benchmark-comparison.png`. The plot is regenerated with `pnpm benchmark:plot` from the JSON measurements. The full benchmark is regenerated with `pnpm benchmark`.

ML-DSA-65 measurements were executed through `@noble/post-quantum@0.7.0`, identified in the generated report as FIPS 204 ML-DSA-65. The results are runtime observations, not universal performance claims. The paper should report the machine, operating system, Node.js version, package version, payload design, repetitions, and limitations alongside the results.

## 4. Reproducibility commands

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build
pnpm benchmark
pnpm benchmark:plot
pnpm dev
```

The final release should be created only after the commands above complete successfully and the browser acceptance walkthrough confirms acquisition, hashing, signing, logging, verification, tamper-copy failure, reset, and report export.

## 5. Research limitations

This prototype demonstrates a controlled academic workflow; it is not a certified forensic evidence-management system. It does not replace validated acquisition tools, secure key management, institutional access controls, independent audit procedures, legal review, or jurisdiction-specific evidence standards. Existing custody events use ECDSA-P256 as the active signing algorithm; ML-DSA is measured as a comparison path and must not be presented as having signed an event unless the corresponding server-side execution result is present.
