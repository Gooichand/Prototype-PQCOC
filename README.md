# PQ-ForensicVault

> **Post-Quantum Chain of Custody for Digital Evidence**

PQ-ForensicVault is a local-first web prototype for evaluating how classical ECDSA-P256 and post-quantum ML-DSA-65 signatures affect the integrity, verification, storage, and performance of synthetic digital-evidence chain-of-custody records.

The project is designed for **academic research, classroom demonstration, and reproducible proof-of-concept evaluation**. It is not a certified forensic platform, a replacement for validated acquisition software, or a legal-admissibility system.

> **Important boundary:** Use only generated data or authorised, non-sensitive copies. Do not upload seized devices, personal data, confidential material, or unauthorised forensic images.

## Research question

The prototype investigates the following question:

**What integrity, storage, and performance trade-offs arise when ML-DSA-65 is compared with ECDSA-P256 for signed digital-evidence chain-of-custody records?**

The conclusion is intentionally a trade-off analysis. Hashing detects changes, signatures associate canonical records with a signing key, a hash-linked ledger preserves custody-event continuity, encryption protects confidentiality, and post-quantum signatures address future quantum threats to classical public-key signatures. No single mechanism establishes legal admissibility.

## What is included

| Capability | Implementation status |
|---|---|
| Synthetic evidence acquisition | Generated training artifact plus permitted TXT, PDF, JPEG, PNG, WebP, and GIF copies below 2 MB |
| Integrity hashing | Server-side SHA-256 and SHA3-256 digests with canonical manifest metadata |
| Classical signing | Real server-side ECDSA-P256 signing and verification |
| Post-quantum signing | Real ML-DSA-65 adapter through `@noble/post-quantum@0.7.0`; no silent ECDSA fallback |
| Custody history | Signed, hash-linked events with actor, action, timestamp, location, reason, status, event hash, signature, and public-key metadata |
| Verification | Independent artifact digest, event hash, signature, and continuity checks |
| Tamper laboratory | Safe artifact-copy and ledger-copy demonstrations that preserve the original evidence and persisted ledger |
| Reports | Markdown audit report plus JSON and CSV exports with verification findings, algorithm disclosure, checksums, and limitations |
| Benchmarking | ECDSA-P256 versus ML-DSA-65 timing, signature-size, metadata, and tamper-rejection measurements |
| Interface | Crimson-and-white blueprint workspace with Evidence Vault, Timeline, Verification, Tamper, Benchmark, Reports, Standards, and Acceptance panels |

## System workflow

```text
Acquire synthetic/permitted artifact
        ↓
Calculate SHA-256 and SHA3-256 digests
        ↓
Create canonical evidence manifest
        ↓
Sign acquisition custody event
        ↓
Append hash-linked custody and handover events
        ↓
Recalculate hashes and verify signatures/continuity
        ↓
Demonstrate controlled-copy tampering and reset
        ↓
Export Markdown, JSON, and CSV audit materials
```

ECDSA-P256 is the active signing algorithm for ordinary custody events. ML-DSA-65 is executed and benchmarked only when the validated server-side adapter is available. Capability detection is never presented as a substitute for actual ML-DSA execution.

## Requirements

Install **Node.js 22 or newer**, **pnpm 10 or newer**, and Python 3 with Matplotlib if you want to regenerate the benchmark plot. The repository contains a frozen `pnpm-lock.yaml` and a headless plotting script that does not require a graphical desktop environment.

## Quick start

Clone the documentation-inclusive reproducibility release:

```bash
git clone https://github.com/Gooichand/Prototype-PQCOC.git
cd Prototype-PQCOC
git checkout v2.2.2-readme-final
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://localhost:3000/** in a browser. The managed preview supplies runtime database, storage, and authentication configuration. A standalone deployment must supply compatible services and secrets through its environment; never commit an `.env` file or credentials.

## Validation and reproduction

Run the complete quality gate from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build
```

The final validated baseline contains **111 passing tests across 12 test files**. Coverage includes cryptographic adapter validation, canonical payloads, custody continuity, verification success and failure, permitted-image safeguards, tamper reset, report exports, role guards, accessibility, reduced-motion behaviour, lazy-panel navigation, and the end-to-end synthetic workflow.

To regenerate the paper’s experimental outputs:

```bash
pnpm benchmark
pnpm benchmark:plot
```

The benchmark command writes `benchmark-results.json`, `benchmark-results.csv`, and `BENCHMARK_RESULTS.md`. The plotting command reads the JSON results and writes `benchmark-comparison.png`. The benchmark uses 10, 25, 50, 100, and 200-record configurations with the repetition counts documented in [EXPERIMENTS.md](EXPERIMENTS.md).

## Demonstration sequence

For a class presentation, create a synthetic case, acquire a generated artifact or register a permitted self-created file, inspect both digests, append a custody handover, verify the clean evidence, run the two controlled tamper scenarios, reset the safe demo state, open the benchmark panel, and export the audit materials. The Acceptance Test Center automates a safe synthetic version of this sequence.

A successful clean verification should report **PASS**. A tampered artifact copy or ledger copy should report **FAIL**, while the original evidence remains unchanged. The demonstration must never be used as an operational evidence-handling procedure.

## Architecture and documentation

| Document | Purpose |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, data flow, cryptographic roles, trust boundaries, threat model, and deployment assumptions |
| [EXPERIMENTS.md](EXPERIMENTS.md) | Dataset policy, algorithms, parameters, commands, measured results, plotting, and interpretation |
| [DOCS.md](DOCS.md) | Documentation index and maintenance rules |
| [CHECKLIST.md](CHECKLIST.md) | Release, acceptance, and research-integrity checklist |
| [DELIVERY.md](DELIVERY.md) | Delivered artifacts, presentation flow, and out-of-scope claims |
| [docs/FINAL_VALIDATION.md](docs/FINAL_VALIDATION.md) | Exact validation evidence and environment record |
| [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) | Local configuration, managed-preview assumptions, and troubleshooting |
| [docs/MLDSA_VALIDATION.md](docs/MLDSA_VALIDATION.md) | ML-DSA adapter validation and security notes |
| [docs/FINAL_ACCEPTANCE_TEST.md](docs/FINAL_ACCEPTANCE_TEST.md) | Detailed synthetic acceptance walkthrough |

## Project structure

```text
client/src/pages/Home.tsx          Main forensic workspace
client/src/panels/                 Lazy-loaded Benchmark, Reports, Standards, Acceptance panels
server/forensicCore.ts             Canonicalization, hashes, signatures, verification, reports
server/crypto/mldsaAdapter.ts      Real ML-DSA-65 adapter and validation
server/routers/forensics.ts        Typed forensic tRPC procedures
server/db.ts                       Metadata persistence abstraction
server/storage.ts                  Artifact storage abstraction
server/benchmark-runner.ts         Reproducible ECDSA/ML-DSA measurements
scripts/plot_benchmarks.py         Headless benchmark visualisation
benchmark-results.*                Machine-readable and tabular measurements
benchmark-comparison.png           Generated comparison plot
```

## Security and legal limitations

The prototype demonstrates technical integrity controls, not a complete chain-of-custody operating environment. It does not provide hardware-backed key custody, production access governance, encryption policy, validated forensic acquisition, independent audit anchoring, retention management, malware analysis, or jurisdiction-specific legal compliance. A database or append-only log alone does not make evidence admissible.

Production use would require institutional approval, validated acquisition procedures, secure key lifecycle management, authenticated access, encrypted storage and transport, retention controls, independent audit, incident response, and legal review. Benchmark values are observations from a specific runtime and must not be presented as universal performance guarantees.

## Release information

The documentation-inclusive release is **`v2.2.2-readme-final`**. The code and experiment baseline was previously validated at commit `9877bb0`; subsequent commits contain documentation and checklist alignment. Consult [docs/FINAL_VALIDATION.md](docs/FINAL_VALIDATION.md) for the exact test, build, benchmark, and environment record.

## References

[1]: https://csrc.nist.gov/pubs/fips/204/final "NIST FIPS 204: Module-Lattice-Based Digital Signature Standard"
[2]: https://csrc.nist.gov/pubs/fips/203/final "NIST FIPS 203: Module-Lattice-Based Key-Encapsulation Mechanism Standard"
[3]: https://csrc.nist.gov/pubs/fips/205/final "NIST FIPS 205: Stateless Hash-Based Digital Signature Standard"

ML-DSA is specified by NIST FIPS 204 [1]. Related post-quantum standards include ML-KEM in FIPS 203 [2] and SLH-DSA in FIPS 205 [3].
