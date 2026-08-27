from __future__ import annotations

import json
import os
from pathlib import Path

os.environ.setdefault("MPLBACKEND", "Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
with (ROOT / "benchmark-results.json").open(encoding="utf-8") as handle:
    data = json.load(handle)

runs = data["runs"]
records = [run["config"]["recordCount"] for run in runs]
ecdsa = [run["ecdsa"] for run in runs]
mldsa = [run["mldsa"] for run in runs]

plt.style.use("seaborn-v0_8-whitegrid")
fig, axes = plt.subplots(1, 3, figsize=(16, 5), constrained_layout=True)
fig.suptitle("PQ-ForensicVault: ECDSA-P256 vs ML-DSA-65", fontsize=16, fontweight="bold")

axes[0].plot(records, [item["signingMsAverage"] for item in ecdsa], marker="o", color="#b4233c", label="ECDSA-P256")
axes[0].plot(records, [item["signingMsAverage"] for item in mldsa], marker="o", color="#29251f", label="ML-DSA-65")
axes[0].set_title("Signing time")
axes[0].set_xlabel("Records")
axes[0].set_ylabel("Average milliseconds")
axes[0].legend(frameon=True)

axes[1].plot(records, [item["verificationMsAverage"] for item in ecdsa], marker="o", color="#b4233c", label="ECDSA-P256")
axes[1].plot(records, [item["verificationMsAverage"] for item in mldsa], marker="o", color="#29251f", label="ML-DSA-65")
axes[1].set_title("Verification time")
axes[1].set_xlabel("Records")
axes[1].set_ylabel("Average milliseconds")

axes[2].bar([x - 0.18 for x in range(len(records))], [item["signatureBytesAverage"] for item in ecdsa], width=0.36, color="#b4233c", label="ECDSA-P256")
axes[2].bar([x + 0.18 for x in range(len(records))], [item["signatureBytesAverage"] for item in mldsa], width=0.36, color="#29251f", label="ML-DSA-65")
axes[2].set_title("Signature size")
axes[2].set_xlabel("Record-count configuration")
axes[2].set_ylabel("Bytes")
axes[2].set_xticks(range(len(records)), [str(value) for value in records])

for axis in axes:
    axis.spines["top"].set_visible(False)
    axis.spines["right"].set_visible(False)

output = ROOT / "benchmark-comparison.png"
fig.savefig(output, dpi=180, facecolor="white")
print(f"Saved {output}")
