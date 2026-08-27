# PQ-ForensicVault final readiness checklist

This checklist records the current implementation and validation boundary for the PQ-ForensicVault research prototype. It is not an assurance of legal admissibility, security certification, or production suitability.

## Functional readiness

| Requirement | Status | Evidence of implementation |
|---|---|---|
| Persistent forensic data model | Complete | Cases, investigators, evidence references/metadata, custody events, verification findings, benchmark runs, and export records are modelled in Drizzle and migrated to the project database. |
| UTC time and custody content | Complete | Custody events retain UTC milliseconds, actor, action, location, reason, transfer status, event-record hash, prior-event hash, signature, and signing public key. |
| Artifact-byte storage outside the database | Complete | Synthetic artifact bytes are stored through the configured object-storage helper; the database stores immutable references and metadata only. |
| Permitted-image attachment and preview | Complete | JPEG, PNG, WebP, and GIF copies below 2 MB are allowlisted, signature-checked before storage, hash-manifested, and shown through a local pre-registration preview and stored immutable-reference preview. |
| SHA-256 and SHA3-256 integrity checks | Complete | Acquisition and independent verification use both digests. |
| ECDSA P-256 baseline | Complete | Canonical event payloads are actually signed and verified server-side. |
| Historical key verification | Complete | The event signing public key is persisted with each event, preventing a service restart from invalidating historical ECDSA checks. |
| ML-DSA disclosure | Complete | The application reports `available`, `unavailable`, or `error`; it does not generate pseudo-ML-DSA results or relabel ECDSA as PQC. |
| Signed handover | Complete | The timeline workflow accepts a receiving investigator, location, and reason, then appends a hash-linked signed transfer event. |
| Controlled tamper demonstration | Complete | Artifact-copy and ledger-copy scenarios produce visible expected failures without mutating the original object or persistent ledger. Reset restores the selected reference for ordinary verification. |
| ECDSA benchmark | Complete | The application records real ECDSA sign/verify timing and signature-size measurements. ML-DSA measurements appear only when the server reports availability. |
| Portable audit outputs | Complete | Audit report, JSON, and CSV ledger downloads include the evidence/custody context and legal limitation. |
| Responsive presentation | Complete | The responsive workspace provides an accessible desktop navigation rail and a mobile menu-oriented layout. |

## Automated validation

The project verification run completed successfully on 27 August 2026.

| Command | Result | Coverage |
|---|---|---|
| `pnpm test` | Passed: 9 test files, 23 tests | Real ECDSA signature success/failure, independent hash checking, two-event continuity and altered-ledger rejection, permitted-copy storage handling, image allowlist and byte-signature rejection, image-manifest preservation, rendered local and stored image previews, reset behaviour, required export language, non-simulated ML-DSA status, keyboard-accessible copy registration, and rendered media-query transitions that update the workspace motion profile while retaining an operable control. |
| `pnpm check` | Passed | TypeScript compilation with no emitted output. |
| `pnpm build` | Passed | Production Vite and server bundle completed. The bundler reported a non-blocking main-client chunk-size advisory; functional validation remains green. |

The browser console and network logs were inspected after exercising the acquisition, handover, verification, controlled tamper, reset, benchmark, and export controls. No browser-console errors or 4xx/5xx network failures were present in the inspected recent log entries.

## Browser workflow validation

The following manual flows were exercised against the live development preview.

| Workflow | Result |
|---|---|
| Create/select synthetic case and add a training artifact | A persisted synthetic case workflow and case-scoped artifact acquisition completed. |
| Verify an acquired artifact | SHA-256, SHA3-256, event record, ECDSA signature, and chain-continuity results passed. |
| Append custody handover | A second signed event appended with the previous event hash; subsequent full-chain verification passed. |
| Alter artifact copy | The separately stored copy reported SHA-256 mismatch while event hash and signature remained valid. |
| Alter ledger copy | The in-memory custody copy reported altered event hash and invalid signature while the artifact hashes remained matched. |
| Reset tamper state | The selected original synthetic reference was restored for ordinary verification. |
| Run benchmark | An ECDSA baseline measurement persisted, and ML-DSA was disclosed as unavailable without fabricated values. |
| Export materials | Audit report, JSON, and CSV ledger controls initiated the download flow. |
| Responsive layout | Desktop and 375 px mobile captures displayed the intended Crimson, cream-paper, and blueprint visual system without overflow in the reviewed views. |
| Permitted PNG registration and independent verification | A harmless 1×1 PNG was registered through the live local tRPC endpoint. The persistent evidence record retained `image/png` content type, both hashes, storage key/reference, and preview-manifest metadata. A separate live verification request passed SHA-256, SHA3-256, ECDSA signature, event-record hash, and custody-continuity checks. |
| Permitted image/file control | The final live workspace review showed the visible **Register permitted file / image** control on the command overview and the visible **Add permitted image / file** control in the Evidence Vault. Both describe the JPEG, PNG, WebP, GIF, 2 MB, and non-sensitive-copy restrictions. |
| Image chooser across panels | The shared chooser input is mounted within the workspace shell rather than only inside the command-overview conditional. A rendered Evidence Vault test selected a permitted PNG, asserted the local `blob:` preview, and asserted the persisted preview sourced from the immutable object-storage reference. |
| Final responsive review | Fresh desktop (1280×720) and mobile (375×812) captures of the updated build retained the Crimson-and-cream blueprint layout without reviewed viewport overflow. The local copy’s end-to-end registration and verification remain recorded in the preceding PNG validation entry; an additional post-fix browser upload walkthrough remains a manual follow-up because the browser interaction channel was intermittently unavailable. |
| Keyboard-only navigation | The primary workspace destinations were reached and activated with `Tab`, `Enter`, and `Space`; visible focus treatment was present throughout the reviewed navigation path. |
| Keyboard activation of in-panel controls | The Evidence Vault active-case selector was changed with arrow-key input, and the independent-verification, demo-only altered-ledger, ECDSA baseline benchmark, and JSON audit-export controls were focused and activated with `Enter`. The safe tamper scenario reported its expected failure and was then reset, leaving the original synthetic reference intact. |
| Reduced-motion preference | The workspace observes the system `prefers-reduced-motion` media query, exposes a `data-motion-profile` state, and suppresses non-essential animation and transitions while retaining workflow controls. An automated behavioural test simulates the media-query transition from standard to reduced mode and confirms the workspace subscription updates accordingly. |

## Controls that must remain in place

| Control | Maintenance expectation |
|---|---|
| Canonical payload definition | Treat field order/content as a verification contract. If changed, version the payload before signing new events and keep historical verification compatible. |
| Public-key retention | Do not remove a stored event public key while its signature must remain verifiable. |
| Tamper safety | Keep tampering limited to generated data, authorised copies, separately stored copies, or in-memory fixtures. Never expose an operation that modifies original evidence. |
| Capability language | Keep ML-DSA status truthful. Do not report a benchmark, signature, key, or verification as ML-DSA unless the server-side implementation actually produced it. |
| Object storage | Retain immutable references and avoid database BLOB storage for artifacts. Ensure storage lifecycle, access controls, and deletion policies are defined before any real deployment. |
| Legal wording | Preserve the export and interface caution: technical integrity indicators do not independently decide legal admissibility. |

## Known research limitations

The managed Node runtime currently exposes a functional ECDSA P-256 baseline but no usable ML-DSA implementation, so PQ signature tests must remain visibly unavailable until a compatible, validated server-side implementation is configured and tested. This is deliberate capability disclosure rather than a downgrade masked as PQC. Any later integration should add algorithm-specific known-answer tests, interoperability checks, dependency provenance review, performance testing under the target runtime limits, and a renewed security review.

Benchmark values are environmental observations, not universal performance claims. The current benchmark is suitable for demonstration and comparison within the measured runtime; repeat it after changes in hardware, runtime version, payload design, or cryptographic implementation.

## Handoff recommendation

Before presenting the prototype, select a synthetic case, create one clean artifact or permitted image copy, append one handover, run verification, show one controlled tamper failure, reset it, and export the audit materials. The image workflow was exercised through direct live tRPC registration and verification, rendered local/stored preview coverage, and fresh cross-viewport interface review. Perform one additional post-fix browser upload walkthrough when the interaction channel is stable. Review [the local-only package guide](LOCAL_SETUP.md) before attempting a self-hosted deployment. For publication or deployment, use the project management interface to create a reviewed checkpoint before publishing, and complete the institution's separate governance, privacy, security, and legal review.
