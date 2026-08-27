# ML-DSA-65 Validation Report

## Environment

| Property | Value |
|----------|-------|
| **Date** | 2026-08-27 |
| **Node.js** | v24.12.0 |
| **pnpm** | 10.4.1 |
| **OS** | Windows 10.0.26200 (AMD64) |
| **CPU** | AMD64 |

## ML-DSA-65 Package

| Property | Value |
|----------|-------|
| **Package** | `@noble/post-quantum` |
| **Version** | 0.7.0 |
| **License** | MIT |
| **Audit** | Cure53 (2024) |
| **Implementation** | Pure JavaScript, no native dependencies |
| **Module** | ESM-only |
| **Required Node** | 20+ |
| **Repository** | https://github.com/paulmillr/noble-post-quantum |

## ML-DSA-65 Parameters (FIPS 204)

| Parameter | Value |
|-----------|-------|
| **Security level** | Category 3 (192-bit) |
| **Public key** | 1,952 bytes |
| **Secret key** | 4,032 bytes |
| **Signature** | 3,309 bytes |
| **Seed** | 32 bytes |

## Adapter Validation

| Check | Result |
|-------|--------|
| **Key generation** | PASSED — 1,952-byte public key, 4,032-byte secret key |
| **Signing** | PASSED — 3,309-byte signature produced |
| **Verification** | PASSED — valid signature accepted |
| **Tamper rejection** | PASSED — modified message rejected |
| **Wrong key rejection** | PASSED — wrong public key rejected |
| **Key size verification** | PASSED — matches FIPS 204 Table 1 |

## Test Results

| Test # | Description | Result |
|--------|-------------|--------|
| 1 | Capability vs execution-adapter distinction | PASS |
| 2 | Real ML-DSA-65 key generation | PASS |
| 3 | Key and signature size recording | PASS |
| 4 | Canonical custody-event signing | PASS |
| 5 | Signature verification | PASS |
| 6 | Modified message rejection | PASS |
| 7 | Modified signature rejection | PASS |
| 8 | Wrong public key rejection | PASS |
| 9 | Empty/malformed signature safety | PASS |
| 10 | No silent ECDSA fallback | PASS |
| 11 | Existing ECDSA records remain verifiable | PASS |
| 12 | Mixed ECDSA/ML-DSA chain handling | PASS |
| 13 | Honest adapter status reporting | PASS |
| 14 | No fake timing values in fallback | PASS |
| 15 | No private keys in logs/values | PASS |
| 16 | Image evidence SHA-256/SHA3-256 unchanged | PASS |
| 17 | Artifact/ledger tamper tests work | PASS |
| 18 | Exported metadata matches execution status | PASS |

**All 18 ML-DSA tests: PASS**

## Benchmark Results

### ECDSA-P256 vs ML-DSA-65 (50 records, 3 repetitions)

| Metric | ECDSA-P256 | ML-DSA-65 | Ratio |
|--------|-----------|-----------|-------|
| **Signing avg** | ~0.09 ms | ~16 ms | 178x slower |
| **Verification avg** | ~0.17 ms | ~3.8 ms | 22x slower |
| **Signature size** | 71 bytes | 3,309 bytes | 47x larger |
| **Public key size** | 91 bytes | 1,952 bytes | 21x larger |

### Interpretation

- ECDSA-P256 is significantly faster for signing and verification.
- ML-DSA-65 signatures are 47x larger, impacting storage and bandwidth.
- ML-DSA-65 provides post-quantum security (resistant to Shor's algorithm).
- ECDSA remains the practical choice for high-throughput custody logging.
- ML-DSA is the forward-looking choice for long-term evidence preservation.

## Fallback Behavior

When the ML-DSA adapter is not available:

```
"ML-DSA runtime capability detected; no execution adapter is provisioned. No ML-DSA benchmark is performed."
```

The application:
- Continues to use ECDSA-P256 for all custody events
- Reports the honest capability status in UI and exports
- Does not simulate or fabricate ML-DSA results
- All 85+ existing tests continue to pass

## Security Notes

- Private keys are ephemeral per demo run and cleared on reset
- No private keys are stored in source control, database, logs, or exports
- The adapter uses secure randomness from `@noble/post-quantum/utils.js`
- All cryptographic operations use constant-time implementations (Cure53-audited)
