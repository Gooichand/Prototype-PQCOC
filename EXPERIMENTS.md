# PQ-ForensicVault Experiments

## Research objective

The experiment evaluates the practical trade-offs between a classical ECDSA-P256 signature and a post-quantum ML-DSA-65 signature when signing canonical synthetic chain-of-custody records. The dependent measures are signing time, verification time, signature size, key metadata, storage overhead, and modified-payload rejection. The experiment is not a claim that one algorithm is universally better; it is a controlled comparison under one documented runtime and implementation.

## Data policy and record generation

No seized devices, personal data, confidential records, or unauthorised forensic images are required. The benchmark creates synthetic custody-record payloads containing stable identifiers, investigator metadata, timestamps, actions, locations, transfer status, and evidence-hash fields. The same canonical record design is passed to both algorithm paths. The application’s demonstration workflow also supports permitted TXT, PDF, JPEG, PNG, WebP, and GIF copies below 2 MB; these are for controlled registration and verification, not for the benchmark’s security claims.

The canonicalization step produces deterministic JSON before hashing and signing. A record is considered tampered when a signed canonical field is modified after signing. A successful tamper check is therefore a rejected verification, not a successful signature verification.

## Algorithms and implementation

| Method | Role | Implementation |
|---|---|---|
| ECDSA-P256 | Classical baseline | Node.js server-side signing and verification over canonical custody payloads |
| ML-DSA-65 | Post-quantum comparison | `@noble/post-quantum@0.7.0` adapter with real key generation, signing, verification, and tamper rejection |
| SHA-256 | Artifact and record digest | Node.js cryptographic hash |
| SHA3-256 | Independent second digest | Node.js cryptographic hash |

ML-DSA results are included only after the adapter’s capability validation succeeds. If the adapter is unavailable in another environment, the correct outcome is an explicit unavailable status and no fabricated ML-DSA timing data.

## Parameters

The final run uses five record-count configurations. The configured repetitions are three for 10, 25, 50, and 100 records, and two for 200 records. The effective sample count is the product of records and repetitions. Both algorithms use the same record configurations and measurement structure.

| Records | Repetitions | Effective samples |
|---:|---:|---:|
| 10 | 3 | 30 |
| 25 | 3 | 75 |
| 50 | 3 | 150 |
| 100 | 3 | 300 |
| 200 | 2 | 400 |

For every sample, the runner measures signing and verification using a high-resolution timer and records signature size. It also performs modified-payload rejection for ML-DSA. The report stores median and standard-deviation fields where supported, as well as runtime and operating-system metadata.

## Reproduction commands

From a clean checkout of the final tag:

```bash
git clone https://github.com/Gooichand/Prototype-PQCOC.git
cd Prototype-PQCOC
git checkout v2.2.0-final-prototype
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build
pnpm benchmark
pnpm benchmark:plot
```

`pnpm benchmark` runs the TypeScript benchmark runner and writes `benchmark-results.json`, `benchmark-results.csv`, and `BENCHMARK_RESULTS.md`. `pnpm benchmark:plot` runs `scripts/plot_benchmarks.py` with a headless Matplotlib backend and writes `benchmark-comparison.png`. A graphical desktop environment is not required for plot generation.

Start the application separately with:

```bash
pnpm dev
```

Then open `http://localhost:3000/` and use the Acceptance Test Center for a safe synthetic workflow. The automated server workflow is covered by `server/workflow.e2e.test.ts` and the broader suite is run through `pnpm test`.

## Final measured results

The recorded run used Node.js `v22.13.0`, Linux `x64`, and `@noble/post-quantum@0.7.0`. At 50 records, ECDSA-P256 averaged 0.0396 ms for signing, 0.0841 ms for verification, and 71.1 bytes per signature. ML-DSA-65 averaged 8.5854 ms for signing, 2.3403 ms for verification, and 3,309 bytes per signature. The generated results files contain all configured record counts and should be treated as the authoritative machine-readable source.

| Records | ECDSA sign avg. (ms) | ML-DSA sign avg. (ms) | ECDSA verify avg. (ms) | ML-DSA verify avg. (ms) | ECDSA signature (bytes) | ML-DSA signature (bytes) |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 0.0696 | 9.5101 | 0.0954 | 2.4354 | 71 | 3309 |
| 25 | 0.0421 | 8.1508 | 0.0862 | 2.3487 | 71.1 | 3309 |
| 50 | 0.0396 | 8.5854 | 0.0841 | 2.3403 | 71.1 | 3309 |
| 100 | 0.0395 | 9.3049 | 0.0854 | 2.3707 | 71 | 3309 |
| 200 | 0.0393 | 9.1969 | 0.0854 | 2.36 | 71 | 3309 |

The visual comparison is available in [benchmark-comparison.png](benchmark-comparison.png), and the complete table is in [BENCHMARK_RESULTS.md](BENCHMARK_RESULTS.md).

## Interpretation

The measured result illustrates the expected trade-off in this prototype: ML-DSA-65 uses substantially larger signatures and takes longer in this runtime, while providing a post-quantum signature option. ECDSA-P256 remains compact and fast for the baseline. The experiment supports a nuanced conclusion about migration cost and long-term security posture; it does not support the conclusion that post-quantum cryptography is simply “better.”

The measurements are not capacity guarantees. Results can change with CPU, operating system, Node.js version, package implementation, compiler/runtime behaviour, payload size, timer resolution, background load, and repetition design. A paper should report this environment and avoid comparing these values directly with unrelated experiments that use different payloads or hardware.

## Reproducibility checklist

| Check | Expected evidence |
|---|---|
| Clean install | Frozen lockfile completes without dependency resolution changes |
| Tests | 111 tests pass across 12 files in the finalized revision |
| Type check | `pnpm check` exits successfully |
| Build | `pnpm build` completes and creates split browser chunks |
| Benchmark | JSON, CSV, and Markdown outputs are refreshed together |
| Plot | PNG timestamp and content correspond to the refreshed JSON |
| Environment | Node, OS, package, record counts, repetitions, and adapter status are recorded |
| Integrity | Modified canonical payloads are rejected by both relevant verification paths |

## References

[1]: https://csrc.nist.gov/pubs/fips/204/final "NIST FIPS 204: Module-Lattice-Based Digital Signature Standard"
[2]: https://nodejs.org/api/crypto.html "Node.js Crypto API"

The ML-DSA algorithm designation follows NIST FIPS 204 [1]. The classical cryptographic operations use the Node.js Crypto API [2].
