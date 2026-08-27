# PQ-ForensicVault Architecture

## Purpose and system boundary

PQ-ForensicVault is a local-first web prototype for demonstrating signed chain-of-custody records over synthetic digital evidence. The system is intentionally bounded: it demonstrates integrity controls and measurable signature trade-offs, but it is not a validated forensic acquisition suite, a production evidence repository, or a legal-admissibility system.

## Component map

| Component | Responsibility |
|---|---|
| `client/src/App.tsx` | Application shell, routing, theme, and workspace composition |
| `client/src/pages/Home.tsx` | Primary forensic workspace, case selection, acquisition, vault, timeline, verification, tamper, dashboard, and navigation state |
| `client/src/panels/` | Lazy-loaded Benchmark, Reports, Standards, and Acceptance panels |
| `client/src/lib/trpc.ts` | Typed client binding for server procedures |
| `server/_core/index.ts` | Express server startup, Vite integration, and API hosting |
| `server/routers/forensics.ts` | Typed procedures for cases, evidence, handovers, verification, tamper scenarios, dashboards, benchmarks, and exports |
| `server/forensicCore.ts` | Canonical serialization, hashing, ECDSA operations, ML-DSA capability, custody validation, benchmark primitives, and report rendering |
| `server/crypto/mldsaAdapter.ts` | Genuine ML-DSA-65 key generation, signing, verification, parameter metadata, and adapter validation |
| `server/db.ts` and `drizzle/schema.ts` | Database abstraction and persistent metadata schema |
| `server/storage.ts` | Artifact-byte storage abstraction and local/managed storage fallback |
| `server/_core/context.ts` | Request context, user identity, role information, and request-origin handling |
| `benchmark-runner.ts` and `scripts/plot_benchmarks.py` | Reproducible measurement and headless plot generation |

## Data flow

```text
User action
   |
   v
React workspace and typed tRPC client
   |
   v
Express/tRPC procedure + role guard
   |
   +--> evidence bytes --> storage adapter --> immutable storage reference
   |
   +--> canonical metadata --> SHA-256 + SHA3-256 --> manifest
   |
   +--> canonical custody event --> ECDSA-P256 or ML-DSA-65 signer
   |                                  |
   |                                  v
   |                       signature + public key + event hash
   |
   +--> database metadata and hash-linked custody ledger
   |
   v
Independent verification
   |
   +--> recalculate artifact digests
   +--> recompute event hashes
   +--> verify linked previous-event hashes
   +--> verify signatures against stored public keys
   |
   v
PASS/FAIL findings and Markdown/JSON/CSV audit exports
```

## Core data model

A case groups evidence and investigators. An evidence record contains the artifact name, media type, size, SHA-256 digest, SHA3-256 digest, manifest metadata, and immutable storage reference. A custody event contains the case/evidence identifiers, actor, action, UTC timestamp in milliseconds, location, reason, transfer status, previous-event hash, event-record hash, signature algorithm, signature, and event public key. Benchmark records retain the parameters, measurements, environment metadata, and serialized result set. Verification records retain the overall status and findings breakdown.

The canonical event payload is serialized deterministically before hashing and signing. The event-record hash covers the canonical record fields, while the previous-event hash links the event to the preceding custody record. Verification independently reconstructs these values rather than trusting the display layer.

## Cryptographic roles

| Control | What it demonstrates | What it does not demonstrate |
|---|---|---|
| SHA-256/SHA3-256 | Whether checked bytes or canonical metadata changed | Who created the bytes or event |
| ECDSA-P256 | Classical signer association and signature verification | Protection from a future cryptographically relevant quantum computer |
| ML-DSA-65 | Post-quantum signature execution and measurable trade-offs | That every stored custody event was signed by ML-DSA |
| Hash-linked ledger | Breaks in recorded event sequence | Consensus, decentralisation, or legal admissibility |
| Storage reference | Retrieval of the associated artifact bytes | Confidentiality without encryption and access controls |

ML-DSA is reported from the runtime adapter status. The application must never substitute ECDSA output for ML-DSA output or display fabricated post-quantum timing measurements.

## Trust boundaries

The browser is an untrusted presentation and interaction layer. It submits typed requests but must not be treated as the source of cryptographic truth. The server is the application trust boundary for canonicalization, hashing, signing, verification, role checks, and export generation. The database is trusted for metadata persistence but should not be treated as immutable without operational controls. The artifact store is trusted to return the referenced bytes for this prototype; a production deployment requires authenticated storage, encryption, retention, and integrity monitoring. Private signing keys are generated and used within the server-side adapter and are not returned to the client.

## Threat model

| Threat | Prototype mitigation | Remaining limitation |
|---|---|---|
| Accidental artifact modification | Recomputed SHA-256/SHA3-256 comparison | Does not provide physical media protection |
| Altered custody event | Event hash and signature verification | Key compromise is outside the prototype |
| Removed or reordered event | Previous-event hash continuity | A privileged database operator could rewrite all metadata without external anchoring |
| Wrong signing key | Stored public-key verification and wrong-key tests | No hardware-backed key custody |
| Forged ML-DSA result | Adapter validation and no fallback policy | Runtime/library trust still requires independent review |
| Malicious upload | MIME, magic-byte, size, and permitted-type checks | Not a malware sandbox or content-disarm service |
| Unsafe tamper demo | Separate artifact/ledger copies and reset control | Demonstration database is not a production immutable ledger |
| Unauthorised operator | Role guards when authentication is configured | Local demo mode intentionally permits demonstration access |
| Confidentiality loss | Storage references avoid database BLOBs | Encryption, secrets management, and deployment hardening are separate responsibilities |

## Role model

The server defines Investigator, Examiner, and Reviewer capabilities. Investigators create cases, acquire evidence, register permitted copies, and append handovers. Examiners verify evidence, view benchmarks, and generate exports. Reviewers operate controlled tamper demonstrations, reset safe demo state, and view dashboard material. Demo mode can expose procedures for local presentation; authenticated deployments must configure identity and enforce the role guard.

## Failure and recovery behaviour

A failed verification returns findings rather than mutating the original evidence. Tamper scenarios operate against a controlled copy or an in-memory ledger copy and can be reset. An unavailable ML-DSA capability is surfaced as an explicit status; the system does not invent measurements. Storage failures, missing evidence, malformed files, wrong keys, and modified canonical payloads are represented as errors or failed findings and are covered by automated tests.

## Deployment assumptions

The repository is designed for local development using Node.js and pnpm. Managed previews provide database, storage, and authentication services through runtime configuration. A standalone installation must provide equivalent services, use secure secret injection, apply reviewed schema migrations, and replace any managed storage assumptions with an S3-compatible or MinIO implementation. No production claim should be made without independent security review and operational controls.

## References

[1]: https://csrc.nist.gov/pubs/fips/204/final "NIST FIPS 204: Module-Lattice-Based Digital Signature Standard"
[2]: https://csrc.nist.gov/pubs/fips/203/final "NIST FIPS 203: Module-Lattice-Based Key-Encapsulation Mechanism Standard"
[3]: https://csrc.nist.gov/pubs/fips/205/final "NIST FIPS 205: Stateless Hash-Based Digital Signature Standard"

The post-quantum algorithm context follows NIST FIPS 204 for ML-DSA [1], with ML-KEM and SLH-DSA specified separately in FIPS 203 [2] and FIPS 205 [3].
