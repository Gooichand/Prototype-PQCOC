# PQ-ForensicVault

PQ-ForensicVault is a presentation-ready research prototype for studying a post-quantum-aware chain of custody for synthetic digital evidence and permitted, non-sensitive copies. The implementation compares a classical ECDSA-P256 signing baseline with genuine ML-DSA-65 execution when the validated adapter is available. It is designed for academic demonstration and reproducible experimentation rather than operational forensic deployment.

> This is a technical proof of concept. It does not establish legal admissibility, replace validated acquisition procedures, provide forensic certification, or claim that a real quantum computer has broken current public-key cryptography.

## Research purpose

The prototype addresses the research question: **what integrity, storage, and performance trade-offs arise when ML-DSA-65 is compared with ECDSA-P256 for signed digital-evidence chain-of-custody records?** It separates five controls that should not be conflated: hashes detect byte changes; digital signatures associate canonical records with a signing key; a hash-linked custody ledger preserves event order; encryption protects confidentiality; and post-quantum signatures reduce exposure to future quantum attacks against classical public-key signatures.

## Implemented scope

| Area | Behaviour in the final prototype |
|---|---|
| Evidence | Synthetic artifact generation and permitted TXT, PDF, JPEG, PNG, WebP, and GIF copies below 2 MB |
| Integrity | Server-side SHA-256 and SHA3-256 digests and canonical manifests |
| Classical signature | Real ECDSA-P256 signing and verification for custody events |
| Post-quantum signature | Real ML-DSA-65 adapter path using `@noble/post-quantum@0.7.0`; no silent ECDSA fallback |
| Custody | Actor, action, UTC timestamp, location, reason, transfer status, prior-event hash, event hash, signature, and public-key metadata |
| Verification | Artifact hashes, event-record hashes, linked continuity, and signatures are checked independently |
| Tamper demonstration | Artifact-copy and ledger-copy scenarios; original evidence and persisted ledger are protected |
| Reports | Markdown audit report, JSON export, CSV custody export, report checksum, algorithm disclosure, and limitations |
| UI | React/Vite workspace with Evidence Vault, Timeline, Verification Center, Tamper Laboratory, Benchmark Observatory, Reports, Standards, and Acceptance panels |

## Requirements

Use **Node.js 22 or newer** and pnpm. The repository includes a frozen `pnpm-lock.yaml`. The managed local preview supplies its own database, object-storage, and authentication configuration. A genuinely self-hosted installation must provide compatible configuration and must not commit secrets or evidence bytes.

## Install and run

Clone the final repository and check out the release tag:

```bash
git clone https://github.com/Gooichand/Prototype-PQCOC.git
cd Prototype-PQCOC
git checkout v2.2.1-reproducibility-docs
pnpm install --frozen-lockfile
```

Start the local application:

```bash
pnpm dev
```

Open `http://localhost:3000/`. For a production build, run `pnpm build`; the compiled server is emitted under `dist/`.

## Validation commands

Run the same gates used for the final release:

```bash
pnpm test
pnpm check
pnpm build
```

The final validation baseline is **111 passing tests across 12 test files**. The test suite includes cryptographic adapter checks, custody-chain continuity, verification success and failure paths, image safeguards, tamper reset, export structure, accessibility, reduced motion, lazy-loaded panel navigation, and an end-to-end synthetic workflow.

## Reproduce the experiments

The benchmark compares ECDSA-P256 and ML-DSA-65 using the same canonical record design and measurement procedure. It covers 10, 25, 50, 100, and 200 records with the configured repetition counts. Run:

```bash
pnpm benchmark
pnpm benchmark:plot
```

The commands regenerate `benchmark-results.json`, `benchmark-results.csv`, `BENCHMARK_RESULTS.md`, and `benchmark-comparison.png`. The report records the runtime, operating system, package version, timings, signature sizes, key metadata, storage overhead, and ML-DSA tamper-rejection measurements. Results are runtime observations and should not be presented as universal capacity claims.

## Workflow demonstration

The recommended demonstration is to create a synthetic case, acquire or register a permitted self-created artifact, inspect both digests, append a signed handover, verify the clean record, run the two controlled tamper scenarios, reset the safe demo state, execute the benchmark, and export the audit materials. The Acceptance Test Center automates the synthetic version of this flow. It must not be used with seized, personal, confidential, or unauthorised evidence.

## Architecture overview

The React client communicates with typed tRPC procedures exposed by the Node/Express server. The server delegates cryptographic work to `server/forensicCore.ts` and the ML-DSA adapter, persists metadata through the database layer, and stores artifact bytes through the storage adapter. See [ARCHITECTURE.md](ARCHITECTURE.md) for module responsibilities, data flow, threat model, and trust boundaries. See [EXPERIMENTS.md](EXPERIMENTS.md) for the complete measurement protocol.

## Documentation map

| Document | Purpose |
|---|---|
| `ARCHITECTURE.md` | Modules, data flow, trust boundaries, threats, and security assumptions |
| `EXPERIMENTS.md` | Dataset generation, benchmark parameters, commands, outputs, and interpretation |
| `DOCS.md` | Documentation index and maintenance rules |
| `CHECKLIST.md` | Final acceptance and release checklist |
| `DELIVERY.md` | What is delivered, how to present it, and what is out of scope |
| `docs/FINAL_VALIDATION.md` | Exact final validation record |
| `docs/LOCAL_SETUP.md` | Local configuration and troubleshooting guidance |
| `BENCHMARK_RESULTS.md` | Human-readable measured results |

## Safety and legal boundaries

Use only generated data or authorised, non-sensitive copies. The prototype intentionally excludes unrestricted binary uploads and does not assert that a blockchain or append-only log alone makes evidence admissible. Production use would require validated acquisition, key custody, access control, encryption, retention, independent audit, institutional approval, legal review, and jurisdiction-specific compliance.

## Release

The finalized research prototype is tagged `v2.2.1-reproducibility-docs` at commit `9fe1466` (code release at `9877bb0`). The release artifacts include source code, frozen dependencies, the benchmark outputs, the comparison plot, and the final validation record.

## References

[1]: https://csrc.nist.gov/pubs/fips/204/final "NIST FIPS 204: Module-Lattice-Based Digital Signature Standard"
[2]: https://csrc.nist.gov/pubs/fips/203/final "NIST FIPS 203: Module-Lattice-Based Key-Encapsulation Mechanism Standard"
[3]: https://csrc.nist.gov/pubs/fips/205/final "NIST FIPS 205: Stateless Hash-Based Digital Signature Standard"

NIST standards context: ML-DSA is specified in [FIPS 204][1]; ML-KEM and SLH-DSA are specified in [FIPS 203][2] and [FIPS 205][3].
