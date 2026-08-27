# PQ-ForensicVault Benchmark Results

**Generated:** 2026-08-27T15:14:46.930Z
**Node:** v22.13.0 | **OS:** linux x64
**ML-DSA-65 capability:** available
**ML-DSA-65 execution:** Active — real ML-DSA-65 signing and verification performed
**ML-DSA-65 package:** @noble/post-quantum@0.7.0 (Cure53 (2024))

## ECDSA-P256 Performance

| Records | Reps | Samples | ECDSA Sign Avg (ms) | ECDSA Sign Median | ECDSA Verify Avg (ms) | ECDSA Sig Bytes |
|---------|------|---------|---------------------|-------------------|-----------------------|-----------------|
| 10 | 3 | 30 | 0.0696 | 0.0449 | 0.0954 | 71 |
| 25 | 3 | 75 | 0.0421 | 0.0385 | 0.0862 | 71.1 |
| 50 | 3 | 150 | 0.0396 | 0.0381 | 0.0841 | 71.1 |
| 100 | 3 | 300 | 0.0395 | 0.0382 | 0.0854 | 71 |
| 200 | 2 | 400 | 0.0393 | 0.0383 | 0.0854 | 71 |

## ML-DSA-65 Performance

| Records | Reps | Samples | ML-DSA Sign Avg (ms) | ML-DSA Sign Median | ML-DSA Verify Avg (ms) | ML-DSA Sig Bytes | Tamper Rejections |
|---------|------|---------|----------------------|--------------------|------------------------|------------------|-------------------|
| 10 | 3 | 30 | 9.5101 | 7.3696 | 2.4354 | 3309 | 100.0% (30/30 ML-DSA rejects modified canonical payloads) |
| 25 | 3 | 75 | 8.1508 | 6.1439 | 2.3487 | 3309 | 100.0% (75/75 ML-DSA rejects modified canonical payloads) |
| 50 | 3 | 150 | 8.5854 | 6.7526 | 2.3403 | 3309 | 100.0% (150/150 ML-DSA rejects modified canonical payloads) |
| 100 | 3 | 300 | 9.3049 | 7.5079 | 2.3707 | 3309 | 100.0% (300/300 ML-DSA rejects modified canonical payloads) |
| 200 | 2 | 400 | 9.1969 | 7.2945 | 2.36 | 3309 | 100.0% (400/400 ML-DSA rejects modified canonical payloads) |

## Notes

- All timings are real measurements in this server runtime.
- They are not production capacity or legal admissibility claims.
- ML-DSA benchmarks use the same records, repetitions, and timing method as ECDSA.
- ECDSA-P256 remains the active signing algorithm for existing custody events.

## ML-DSA-65 Parameter Metadata

- **Algorithm:** ML-DSA-65
- **Standard:** FIPS 204
- **Security level:** Category 3
- **Public key:** 1952 bytes
- **Secret key:** 4032 bytes
- **Signature:** 3309 bytes
- **Package:** @noble/post-quantum@0.7.0
- **Audit:** Cure53 (2024)