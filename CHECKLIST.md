# PQ-ForensicVault Final Checklist

## Repository and installation

| Check | Required result | Status at final release |
|---|---|---|
| Clone repository | Repository is available from GitHub | PASS |
| Checkout release | `v2.2.0-final-prototype` resolves to commit `9877bb0` | PASS |
| Install dependencies | `pnpm install --frozen-lockfile` succeeds | PASS |
| No committed secrets | No credentials or evidence bytes are committed | PASS |

## Quality gates

| Check | Command or evidence | Status |
|---|---|---|
| Unit and integration tests | `pnpm test` | PASS — 111 tests in 12 files |
| Type safety | `pnpm check` | PASS |
| Production bundle | `pnpm build` | PASS |
| Bundle structure | Lazy panels and vendor chunks are emitted | PASS |
| Benchmark runner | `pnpm benchmark` | PASS |
| Plot generation | `pnpm benchmark:plot` | PASS |

## End-to-end workflow

The presenter must be able to create a synthetic case, acquire a generated artifact, inspect SHA-256 and SHA3-256 values, append a signed custody event, append a handover, verify the clean evidence, run artifact-copy and ledger-copy tamper demonstrations, reset the controlled state, run the benchmark, and export Markdown, JSON, and CSV audit materials. The original artifact and persisted custody history must remain unchanged by the tamper demonstration.

## Research integrity

The final paper must report the exact benchmark environment, package version, record counts, repetitions, payload assumptions, and limitations. It must describe ML-DSA as genuinely executed only when the adapter status and generated benchmark metadata confirm execution. It must not present capability detection as a benchmark, use fabricated timing values, or claim that hashing, signatures, or an append-only ledger alone establishes legal admissibility.

## Final sign-off

Before a future release, rerun all commands in `EXPERIMENTS.md`, refresh JSON/CSV/Markdown/PNG artifacts together, update `docs/FINAL_VALIDATION.md`, update the release pointer in `DOCS.md` and `DELIVERY.md`, and create a new release tag. If a gate fails, do not describe the repository as the final prototype until the failure is resolved or explicitly documented.
