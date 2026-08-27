# PQ-ForensicVault Benchmark Results

**Generated:** 2026-08-27T14:27:47.200Z
**Node:** v24.12.0 | **OS:** win32 x64
**ML-DSA-65 capability:** available
**ML-DSA-65 execution:** Active — real ML-DSA-65 signing and verification performed
**ML-DSA-65 package:** @noble/post-quantum@0.7.0 (Cure53 (2024))

## ECDSA-P256 Performance

| Records | Reps | Samples | ECDSA Sign Avg (ms) | ECDSA Sign Median | ECDSA Verify Avg (ms) | ECDSA Sig Bytes |
|---------|------|---------|---------------------|-------------------|-----------------------|-----------------|
| 10 | 3 | 30 | 0.1632 | 0.099 | 0.1831 | 71.1 |
| 25 | 3 | 75 | 0.101 | 0.0936 | 0.1777 | 70.9 |
| 50 | 3 | 150 | 0.0966 | 0.0905 | 0.2022 | 71 |
| 100 | 3 | 300 | 0.0954 | 0.0904 | 0.1887 | 71 |
| 200 | 2 | 400 | 0.0747 | 0.0619 | 0.149 | 71.1 |

## ML-DSA-65 Performance

| Records | Reps | Samples | ML-DSA Sign Avg (ms) | ML-DSA Sign Median | ML-DSA Verify Avg (ms) | ML-DSA Sig Bytes | Tamper Rejections |
|---------|------|---------|----------------------|--------------------|------------------------|------------------|-------------------|
| 10 | 3 | 30 | 15.3202 | 11.0032 | 4.5738 | 3309 | 100.0% (30/30 ML-DSA rejects modified canonical payloads) |
| 25 | 3 | 75 | 14.0844 | 12.6193 | 3.7182 | 3309 | 100.0% (75/75 ML-DSA rejects modified canonical payloads) |
| 50 | 3 | 150 | 19.0515 | 15.7013 | 4.5263 | 3309 | 100.0% (150/150 ML-DSA rejects modified canonical payloads) |
| 100 | 3 | 300 | 17.8804 | 13.6208 | 4.1149 | 3309 | 100.0% (300/300 ML-DSA rejects modified canonical payloads) |
| 200 | 2 | 400 | 15.38 | 12.1083 | 3.6391 | 3309 | 100.0% (400/400 ML-DSA rejects modified canonical payloads) |

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