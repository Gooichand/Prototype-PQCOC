# PQ-ForensicVault Delivery Record

## Delivered prototype

The delivered repository is `Gooichand/Prototype-PQCOC`, release `v2.2.1-reproducibility-docs`, commit `9fe1466` (code release at `9877bb0`). It contains the React/Vite forensic workspace, Node/Express/tRPC server, database and storage adapters, ECDSA-P256 baseline, ML-DSA-65 adapter, verification and tamper workflows, benchmark runner, headless plotting script, automated tests, frozen dependencies, and research documentation.

## Delivered research artifacts

| Artifact | Use |
|---|---|
| `benchmark-results.json` | Machine-readable results for analysis |
| `benchmark-results.csv` | Spreadsheet and paper appendix input |
| `BENCHMARK_RESULTS.md` | Human-readable result tables and environment metadata |
| `benchmark-comparison.png` | Visual comparison for a paper or presentation |
| `docs/FINAL_VALIDATION.md` | Final quality-gate and workflow record |
| `ARCHITECTURE.md` | System and threat-model description |
| `EXPERIMENTS.md` | Reproduction protocol and interpretation rules |
| `README.md` | New-user installation and usage guide |

## Recommended presentation path

Begin with the research problem: classical signatures are compact and familiar, while post-quantum signatures may impose larger signatures and different performance characteristics. Demonstrate the distinction between a digest, a signature, a hash-linked custody log, and confidentiality controls. Create a synthetic case, acquire a permitted artifact, show both digests, append a handover, verify the clean record, demonstrate failure against a controlled tamper copy, reset it, run the benchmark, and open the generated reports.

The conclusion should state a trade-off rather than declaring one algorithm superior. In the recorded runtime, ML-DSA-65 produced larger signatures and higher measured signing and verification times than ECDSA-P256, while providing a post-quantum signature option. These values are environment-specific observations.

## Reproduction path

A reviewer can reproduce the release with:

```bash
git clone https://github.com/Gooichand/Prototype-PQCOC.git
cd Prototype-PQCOC
git checkout v2.2.1-reproducibility-docs
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build
pnpm benchmark
pnpm benchmark:plot
pnpm dev
```

The browser application is then available at `http://localhost:3000/` unless the local operator selects another port through the project’s development configuration.

## Out-of-scope claims

The delivered prototype does not certify evidence, replace forensic acquisition tools, provide production key management, guarantee confidentiality, establish consensus, or determine legal admissibility. It must be used only with synthetic or authorised non-sensitive copies. Any future operational deployment requires security review, validated acquisition, encrypted storage, access control, retention policy, independent audit, key lifecycle management, and jurisdiction-specific legal review.

## Handover status

The repository is suitable for class presentation, research-method demonstration, and reproducible prototype evaluation. Future changes must update the code, benchmark artifacts, validation record, and documentation as one release unit.
