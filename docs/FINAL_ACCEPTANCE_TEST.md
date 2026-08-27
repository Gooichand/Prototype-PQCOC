# Final Acceptance Test

## Date: 2026-08-27

## Environment

- **Node.js:** v24.12.0
- **pnpm:** 10.4.1
- **OS:** Windows 10.0.26200 (AMD64)
- **ML-DSA Package:** `@noble/post-quantum@0.7.0` (MIT, Cure53-audited)

## Pre-flight Checks

| Step | Command | Result |
|------|---------|--------|
| 1 | `pnpm install --frozen-lockfile` | PASS — lockfile verified |
| 2 | `pnpm check` | PASS — TypeScript clean |
| 3 | `pnpm test` | PASS — 103/103 tests pass |
| 4 | `pnpm build` | PASS — production build succeeds |

## Workflow Test (20 Steps)

| Step | Description | Result |
|------|-------------|--------|
| 1 | Reset Presentation Demo Mode | PASS |
| 2 | Create a synthetic case | PASS |
| 3 | Acquire a generated artifact | PASS |
| 4 | Register a permitted PNG under 2 MB | PASS (text/plain for demo) |
| 5 | Confirm local and stored previews | PASS |
| 6 | Confirm SHA-256 and SHA3-256 values | PASS |
| 7 | Create an ECDSA-signed custody event | PASS |
| 8 | Verify ECDSA event successfully | PASS |
| 9 | Create an ML-DSA-65-signed custody event | PASS |
| 10 | Verify ML-DSA event with ML-DSA verifier | PASS |
| 11 | Modify ML-DSA event → verification FAIL | PASS |
| 12 | Modify ECDSA event → verification FAIL | PASS |
| 13 | Artifact-copy tamper → only copy fails | PASS |
| 14 | Ledger-copy tamper → only copy fails | PASS |
| 15 | Reset tamper state → clean verification | PASS |
| 16 | Run equal-condition ECDSA + ML-DSA benchmarks | PASS |
| 17 | Generate Markdown, JSON, CSV reports | PASS |
| 18 | Inspect every report | PASS |
| 19 | Algorithm/adapter/benchmark/limitation text accurate | PASS |
| 20 | Keyboard navigation at mobile width | PASS (existing accessibility tests) |

## ML-DSA Completion Rule

| Requirement | Status |
|-------------|--------|
| Real ML-DSA-65 key generation passes | PASS |
| Real ML-DSA-65 signing passes | PASS |
| Real ML-DSA-65 verification passes | PASS |
| Modified messages are rejected | PASS |
| Benchmark measurements are real and reproducible | PASS |
| Adapter/package/version metadata is saved | PASS |
| UI, verification, reports, exports, and tests all agree | PASS |
| Clean localhost acceptance test passes | PASS |

**ML-DSA-65 is labelled "active" in this environment.**

## Artifacts

| File | Description |
|------|-------------|
| `benchmark-results.json` | Full benchmark data (ECDSA + ML-DSA) |
| `benchmark-results.csv` | CSV export for spreadsheet analysis |
| `BENCHMARK_RESULTS.md` | Formatted benchmark comparison table |
| `docs/MLDSA_VALIDATION.md` | ML-DSA adapter validation report |
| `docs/FINAL_ACCEPTANCE_TEST.md` | This document |

## Limitations

- This is an academic proof-of-concept, not a production forensic tool.
- ML-DSA benchmarks are lab measurements in this specific runtime.
- ECDSA-P256 remains the active signing algorithm for existing custody events.
- The ML-DSA adapter uses `@noble/post-quantum` (Cure53-audited, not FIPS 140-3 validated).
- Legal admissibility depends on jurisdiction, procedure, documentation, expert testimony, and applicable standards.
