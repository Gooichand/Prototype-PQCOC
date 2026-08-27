# PQ-ForensicVault

**PQ-ForensicVault** is a presentation-quality research prototype for demonstrating a post-quantum-aware chain of custody for **synthetic digital evidence and permitted, non-sensitive copies**. It is designed to make technical integrity controls observable without overstating their legal meaning.

> This application is a technical research prototype. It does **not** establish legal admissibility, provide forensic certification, replace an organisation's evidence-handling procedure, or make a claim that a real quantum computer has broken current public-key cryptography.

## What the prototype implements

The application persists cases, evidence metadata, custody events, verification findings, benchmark runs, and export records in its database. Artifact bytes are kept in object storage; the database retains immutable object references, metadata, and cryptographic digests rather than binary evidence blobs.

| Area | Implemented behaviour |
|---|---|
| Evidence acquisition | Generates a training artifact or registers a permitted local TXT, PDF, JPEG, PNG, WebP, or GIF copy below 2 MB; it produces SHA-256 and SHA3-256 digests, writes a canonical manifest, and appends a signed acquisition event. |
| Image evidence view | Permitted JPEG, PNG, WebP, and GIF copies receive a local pre-registration preview and a stored preview from their immutable object-storage reference. The preview is visual identification only; hashes, signatures, and custody continuity remain the integrity controls. |
| Custody record | Persists the actor, action, UTC timestamp in milliseconds, location, reason, transfer status, prior-event hash, event-record hash, signature, and per-event public key. |
| Classical baseline | Uses real server-side ECDSA P-256 signing and verification over canonical event payloads. Historical verification uses the public key stored with each event, so it remains valid across service restarts. |
| Verification | Independently reads the referenced artifact, recalculates both hashes, and checks event-record hashes, linked continuity, and ECDSA signatures. |
| Tamper laboratory | Restricts controls to synthetic records or separately stored copies. It demonstrates an artifact-hash failure or in-memory ledger-record/signature failure without editing the original artifact or persisted ledger. |
| Benchmarking | Measures real ECDSA signing, verification, signature size, median, standard deviation, key sizes, storage overhead, Node version, and OS. Records ML-DSA output only if the server capability probe reports it as available. |
| Export | Provides audit-report, JSON, and CSV ledger exports containing the manifest, custody history, verification breakdown (artifact hashes, signatures, continuity, event hashes), algorithm disclosure, ML-DSA disclosure text, report checksum (SHA-256), and legal limitation. |

## Cryptographic scope and capability disclosure

The prototype separates controls intentionally. A **hash** indicates byte-level change detection; a **digital signature** provides integrity protection tied to the signing key; a **hash-linked ledger** makes breaks in recorded event continuity apparent; and encryption, when included in a broader deployment, protects confidentiality. None of those controls alone decides admissibility.

The ECDSA baseline is functional. ML-DSA is never emulated, fabricated, or silently replaced by ECDSA. The server exposes one of three explicit statuses: `available`, `unavailable`, or `error`. An unavailable state is a legitimate experimental outcome; the benchmark and interface do not present invented post-quantum timings or signature sizes. ML-DSA is the digital-signature standard specified in NIST FIPS 204. [1]

## Workflow

1. Select a clearly labelled synthetic case or create a new synthetic research case.
2. Generate a training artifact, or select a permitted local TXT, PDF, JPEG, PNG, WebP, or GIF copy below 2 MB. Image bytes are signature-checked against the declared type before registration.
3. Inspect the manifest, object-storage reference, SHA-256 digest, and SHA3-256 digest.
4. Append an investigator handover with a receiving investigator, location, and reason. The application signs and hash-links the new event.
5. Run independent verification to check the original artifact, all canonical event records, signatures, and chain continuity.
6. Use the Tamper Laboratory only to demonstrate expected failures against controlled copies. Select **Reset safe demo state** when the demonstration is complete.
7. Record the ECDSA baseline benchmark and export technical audit materials where appropriate.

## Architecture

The managed project uses React, TypeScript, Vite, Tailwind CSS, and a tRPC client interface. The Node/Express server provides tRPC procedures, cryptographic operations, and the data-access layer. Drizzle maps the persistent MySQL/TiDB schema. Synthetic artifact data is stored through the configured object-storage helper and accessed by immutable object-storage key/reference.

### Role-based access control

The server enforces three forensic roles through tRPC middleware. In demo mode (no authenticated user), all procedures are accessible. When authentication is configured, the role guard restricts operations:

| Role | Allowed operations |
|---|---|
| Investigator | Create cases, acquire evidence, register permitted copies, append handovers |
| Examiner | Run verification, execute benchmarks, view benchmark history, generate audit exports |
| Reviewer | Run tamper tests, reset tamper state, reset presentation demo, view dashboard and reports |

| Layer | Responsibility |
|---|---|
| `client/src/pages/Home.tsx` | Responsive forensic workspace, active-case selection, acquisition, transfer, verification, tamper, benchmark, and export controls. |
| `server/forensicCore.ts` | Stable canonical JSON, SHA-256/SHA3-256 hashing, ECDSA identity/sign/verify, hash-chain validation, PQ capability reporting, and audit rendering. |
| `server/routers/forensics.ts` | Typed tRPC procedures for the forensic workflows and explicit safeguards. |
| `server/db.ts` and `drizzle/schema.ts` | Persistent evidence, custody, verification, benchmark, export, case, and investigator records. |
| `server/storage.ts` | Object-storage interface used for permitted synthetic artifact bytes; it never stores artifact bytes in the database. |

## Safe-use boundaries

Only generated data, generated files, or authorised, non-sensitive copies belong in this prototype. Do **not** upload seized, personal, confidential, or otherwise unauthorised artifacts. The file chooser admits only TXT, PDF, JPEG, PNG, WebP, and GIF copies below 2 MB; SVG and unrestricted binary uploads are intentionally excluded. The demonstration's tamper procedures never mutate original artifacts or the persisted custody history; they work with a separate stored synthetic copy or an in-memory event copy. Retain and follow your institution's approved evidence-handling, privacy, authorisation, retention, and disclosure policies.

## Free local-development path

The source code uses free, locally runnable Node tooling. Install Node.js 22+ and pnpm, install dependencies, and use the scripts below.

```bash
pnpm install
pnpm dev
pnpm test
pnpm check
pnpm build
```

The managed local preview supplies database, storage, and OAuth configuration at runtime. A standalone deployment must supply its own compatible `DATABASE_URL`, storage credentials/configuration, and OAuth configuration without committing secrets. The supplied `server/storage.ts` adapter expects the managed storage proxy; a genuinely self-contained installation must replace it with an S3-compatible or MinIO adapter before using artifact upload and verification. Do not place credentials in source files or commit an `.env` file. Apply schema changes through the existing Drizzle migration workflow: update `drizzle/schema.ts`, generate the migration, review the generated SQL, and apply the reviewed SQL to the intended database.

The downloadable source archive intentionally contains no live credentials or evidence bytes. Read [the local-only package guide](docs/LOCAL_SETUP.md) before attempting a fully self-hosted installation; it distinguishes the managed local preview from a genuinely self-contained local deployment.

## Validation and readiness

See [the final readiness checklist](docs/READINESS.md) for the tested flows, including end-to-end registration and independent verification of a harmless PNG, known constraints, and maintenance expectations. In particular, repeat `pnpm test` and `pnpm check` after any change to the canonical payload, schema, signing code, or evidence workflow.

## Standards context

NIST FIPS 204 specifies Module-Lattice-Based Digital Signature Standard (ML-DSA). The related FIPS 203 and FIPS 205 standards address ML-KEM and SLH-DSA respectively. [1] [2] [3]

## References

[1]: https://csrc.nist.gov/pubs/fips/204/final "NIST FIPS 204: Module-Lattice-Based Digital Signature Standard"
[2]: https://csrc.nist.gov/pubs/fips/203/final "NIST FIPS 203: Module-Lattice-Based Key-Encapsulation Mechanism Standard"
[3]: https://csrc.nist.gov/pubs/fips/205/final "NIST FIPS 205: Stateless Hash-Based Digital Signature Standard"
