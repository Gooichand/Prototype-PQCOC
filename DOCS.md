# PQ-ForensicVault Documentation Index

This repository contains the finalized academic prototype and the documentation needed to reproduce, present, and evaluate it.

| Document | Audience | Purpose |
|---|---|---|
| `README.md` | New users and presenters | Scope, installation, commands, workflow, release, and safety boundaries |
| `ARCHITECTURE.md` | Researchers and developers | Components, data flow, cryptographic roles, trust boundaries, threats, and deployment assumptions |
| `EXPERIMENTS.md` | Paper authors and evaluators | Data policy, algorithms, parameters, commands, measured results, plot generation, and limitations |
| `CHECKLIST.md` | Release maintainer | Acceptance and reproducibility checks that must pass before publication |
| `DELIVERY.md` | Class presentation and repository reviewers | Delivered artifacts, presentation path, and explicit out-of-scope claims |
| `docs/FINAL_VALIDATION.md` | Research record | Exact final validation evidence and benchmark environment |
| `docs/LOCAL_SETUP.md` | Local operators | Managed preview, self-hosting assumptions, configuration, and troubleshooting |
| `docs/MLDSA_VALIDATION.md` | Cryptography reviewers | Adapter validation and ML-DSA-specific security notes |
| `docs/FINAL_ACCEPTANCE_TEST.md` | Demonstrators | Twenty-step synthetic acceptance walkthrough |
| `BENCHMARK_RESULTS.md` | Results reviewers | Human-readable benchmark tables and runtime metadata |
| `benchmark-results.json` | Analysis scripts | Machine-readable benchmark results |
| `benchmark-results.csv` | Spreadsheets and appendices | Tabular benchmark results |
| `benchmark-comparison.png` | Paper and presentation | Generated visual comparison of time and signature size |

## Maintenance rules

The README, architecture, experiment protocol, and validation record must be updated together whenever canonical payloads, signature algorithms, record counts, storage behaviour, or package versions change. Benchmark JSON is the machine-readable source; CSV, Markdown, and PNG are derived outputs and must be regenerated from the same run.

Documentation must distinguish measured facts from design goals and must not claim legal admissibility, production readiness, or quantum security beyond the tested implementation. New benchmark values must include the execution environment and must never be hand-entered as invented measurements.

## Final release pointer

The documented release is `v2.2.1-reproducibility-docs` at commit `9fe1466` (code release at `9877bb0`) in [Gooichand/Prototype-PQCOC](https://github.com/Gooichand/Prototype-PQCOC). If source changes after this release, update the revision and validation date in every document that records exact release metadata.
