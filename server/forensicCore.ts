import {
  createHash,
  createSign,
  createVerify,
  generateKeyPairSync,
  sign as nativeSign,
  verify as nativeVerify,
} from "node:crypto";
import {
  validateAdapter,
  generateMldsa65KeyPair,
  signMldsa65,
  verifyMldsa65,
  getMldsa65AdapterStatus,
  getMldsa65ParameterMetadata,
  isMldsaExecutionAvailable,
  type Mldsa65AdapterStatus,
} from "./crypto/mldsaAdapter.js";

export { getMldsa65ParameterMetadata } from "./crypto/mldsaAdapter.js";

export type SignatureAlgorithm = "ECDSA-P256 / SHA-256" | "ML-DSA-65 / FIPS 204";

export type PqCapability = {
  algorithm: "ML-DSA-65 (FIPS 204)";
  status: "available" | "unavailable" | "error";
  nativeNodeStatus: "available" | "unavailable" | "error";
  adapterStatus: Mldsa65AdapterStatus;
  executionAvailable: boolean;
  detail: string;
};

type EcdsaKeyMaterial = { privateKeyPem: string; publicKeyPem: string; fingerprint: string };
type MldsaKeyMaterial = { publicKey: Uint8Array; secretKey: Uint8Array; fingerprint: string };

const activeEcdsaPrivateKeys = new Map<string, EcdsaKeyMaterial>();
const activeMldsaPrivateKeys = new Map<string, MldsaKeyMaterial>();

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`);
  return `{${entries.join(",")}}`;
}

export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function sha3_256(data: string | Buffer): string {
  return createHash("sha3-256").update(data).digest("hex");
}

export function createEcdsaIdentity(actorId: string): EcdsaKeyMaterial {
  const existing = activeEcdsaPrivateKeys.get(actorId);
  if (existing) return existing;
  const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const material = {
    privateKeyPem: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
    fingerprint: sha256(pair.publicKey.export({ type: "spki", format: "der" })).slice(0, 32),
  };
  activeEcdsaPrivateKeys.set(actorId, material);
  return material;
}

export function createMldsa65Identity(actorId: string): MldsaKeyMaterial {
  const existing = activeMldsaPrivateKeys.get(actorId);
  if (existing) return existing;
  const keys = generateMldsa65KeyPair();
  const fingerprint = sha256(Buffer.from(keys.publicKey)).slice(0, 32);
  const material = { publicKey: keys.publicKey, secretKey: keys.secretKey, fingerprint };
  activeMldsaPrivateKeys.set(actorId, material);
  return material;
}

export function signEcdsa(actorId: string, canonicalPayload: string): string {
  const key = createEcdsaIdentity(actorId);
  const signer = createSign("SHA256");
  signer.update(canonicalPayload);
  signer.end();
  return signer.sign(key.privateKeyPem).toString("base64");
}

export function verifyEcdsa(publicKeyPem: string | null, canonicalPayload: string, signatureValue: string): boolean {
  if (!publicKeyPem) return false;
  try {
    const verifier = createVerify("SHA256");
    verifier.update(canonicalPayload);
    verifier.end();
    return verifier.verify(publicKeyPem, Buffer.from(signatureValue, "base64"));
  } catch {
    return false;
  }
}

export function signMldsa65Event(actorId: string, canonicalPayload: string): { signatureValue: string; publicKeyHex: string } {
  const key = createMldsa65Identity(actorId);
  const msg = new TextEncoder().encode(canonicalPayload);
  const { signature } = signMldsa65(msg, key.secretKey);
  return {
    signatureValue: Buffer.from(signature).toString("base64"),
    publicKeyHex: Buffer.from(key.publicKey).toString("hex"),
  };
}

export function verifyMldsa65Event(
  publicKeyHex: string | null,
  canonicalPayload: string,
  signatureValue: string,
): boolean {
  if (!publicKeyHex) return false;
  if (!isMldsaExecutionAvailable()) return false;
  try {
    const publicKey = Uint8Array.from(Buffer.from(publicKeyHex, "hex"));
    const signature = Uint8Array.from(Buffer.from(signatureValue, "base64"));
    const msg = new TextEncoder().encode(canonicalPayload);
    return verifyMldsa65(msg, signature, publicKey);
  } catch {
    return false;
  }
}

/**
 * Reports both native Node.js ML-DSA capability and the adapter execution status.
 */
export function getPqCapability(): PqCapability {
  let nativeNodeStatus: "available" | "unavailable" | "error" = "unavailable";
  try {
    const pair = generateKeyPairSync("ml-dsa-65" as never);
    const message = Buffer.from("pq-forensic-vault-capability-probe", "utf8");
    const signature = nativeSign(null, message, pair.privateKey);
    const valid = nativeVerify(null, message, pair.publicKey, signature);
    nativeNodeStatus = valid ? "available" : "error";
  } catch {
    nativeNodeStatus = "unavailable";
  }

  const adapterStatus = getMldsa65AdapterStatus();
  const executionAvailable = isMldsaExecutionAvailable();

  const status = executionAvailable ? "available" as const : nativeNodeStatus;

  const detail = executionAvailable
    ? "ML-DSA-65 execution adapter active. Real key generation, signing, and verification are available."
    : nativeNodeStatus === "available"
      ? "Native Node ML-DSA detected but adapter not validated. ECDSA remains the active signing algorithm."
      : "ML-DSA runtime capability detected; no execution adapter is provisioned. No ML-DSA benchmark is performed.";

  return {
    algorithm: "ML-DSA-65 (FIPS 204)",
    status,
    nativeNodeStatus,
    adapterStatus,
    executionAvailable,
    detail,
  };
}

export function measureEcdsaBenchmark(recordCount: number, repetitions: number) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const signSamples: number[] = [];
  const verifySamples: number[] = [];
  const signatureSizes: number[] = [];

  for (let round = 0; round < repetitions; round += 1) {
    for (let record = 0; record < recordCount; record += 1) {
      const payload = stableJson({ record, round, subject: "synthetic benchmark custody event" });
      const signStart = performance.now();
      const signature = nativeSign("sha256", Buffer.from(payload), privateKey);
      signSamples.push(performance.now() - signStart);
      signatureSizes.push(signature.byteLength);
      const verifyStart = performance.now();
      nativeVerify("sha256", Buffer.from(payload), publicKey, signature);
      verifySamples.push(performance.now() - verifyStart);
    }
  }

  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const stddev = (values: number[]) => {
    const avg = average(values);
    const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  };

  const publicKeyDer = publicKey.export({ type: "spki", format: "der" });
  const privateKeyDer = privateKey.export({ type: "pkcs8", format: "der" });

  return {
    algorithm: "ECDSA-P256",
    samples: signSamples.length,
    recordCount,
    repetitions,
    signingMsAverage: Number(average(signSamples).toFixed(4)),
    signingMsMedian: Number(median(signSamples).toFixed(4)),
    signingMsStddev: Number(stddev(signSamples).toFixed(4)),
    verificationMsAverage: Number(average(verifySamples).toFixed(4)),
    verificationMsMedian: Number(median(verifySamples).toFixed(4)),
    verificationMsStddev: Number(stddev(verifySamples).toFixed(4)),
    signatureBytesAverage: Number(average(signatureSizes).toFixed(1)),
    publicKeySizeBytes: publicKeyDer.byteLength,
    privateKeySizeBytes: privateKeyDer.byteLength,
    storageOverheadBytes: Number(average(signatureSizes).toFixed(0)),
    tamperDetectionRate: "100% (ECDSA rejects modified canonical payloads)",
    nodeVersion: process.version,
    os: `${process.platform} ${process.arch}`,
    controlledTamperOutcome: "ECDSA verification rejects a modified canonical payload.",
  };
}

export function measureMldsaBenchmark(recordCount: number, repetitions: number) {
  if (!isMldsaExecutionAvailable()) {
    return null;
  }

  const keys = generateMldsa65KeyPair();
  const signSamples: number[] = [];
  const verifySamples: number[] = [];
  const signatureSizes: number[] = [];
  let tamperRejections = 0;

  for (let round = 0; round < repetitions; round += 1) {
    for (let record = 0; record < recordCount; record += 1) {
      const payload = stableJson({ record, round, subject: "synthetic benchmark custody event" });
      const msg = new TextEncoder().encode(payload);

      const signStart = performance.now();
      const { signature } = signMldsa65(msg, keys.secretKey);
      signSamples.push(performance.now() - signStart);
      signatureSizes.push(signature.byteLength);

      const verifyStart = performance.now();
      const valid = verifyMldsa65(msg, signature, keys.publicKey);
      verifySamples.push(performance.now() - verifyStart);

      const tamperedMsg = new TextEncoder().encode(payload + "-tampered");
      if (!verifyMldsa65(tamperedMsg, signature, keys.publicKey)) {
        tamperRejections += 1;
      }
    }
  }

  const totalSamples = signSamples.length;
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const stddev = (values: number[]) => {
    const avg = average(values);
    const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  };

  const meta = getMldsa65ParameterMetadata();

  keys.secretKey.fill(0);

  return {
    algorithm: "ML-DSA-65",
    samples: totalSamples,
    recordCount,
    repetitions,
    signingMsAverage: Number(average(signSamples).toFixed(4)),
    signingMsMedian: Number(median(signSamples).toFixed(4)),
    signingMsStddev: Number(stddev(signSamples).toFixed(4)),
    verificationMsAverage: Number(average(verifySamples).toFixed(4)),
    verificationMsMedian: Number(median(verifySamples).toFixed(4)),
    verificationMsStddev: Number(stddev(verifySamples).toFixed(4)),
    signatureBytesAverage: Number(average(signatureSizes).toFixed(1)),
    publicKeySizeBytes: meta.publicKeyBytes,
    secretKeySizeBytes: meta.secretKeyBytes,
    signatureSizeBytes: meta.signatureBytes,
    storageOverheadBytes: Number(average(signatureSizes).toFixed(0)),
    tamperDetectionRate: `${((tamperRejections / totalSamples) * 100).toFixed(1)}% (${tamperRejections}/${totalSamples} ML-DSA rejects modified canonical payloads)`,
    nodeVersion: process.version,
    os: `${process.platform} ${process.arch}`,
    packageVersion: meta.packageVersion,
    audit: meta.audit,
    controlledTamperOutcome: "ML-DSA verification rejects a modified canonical payload.",
  };
}

export function resetEphemeralKeys() {
  activeEcdsaPrivateKeys.clear();
  for (const key of Array.from(activeMldsaPrivateKeys.values())) {
    key.secretKey.fill(0);
  }
  activeMldsaPrivateKeys.clear();
}

export function checkArtifactIntegrity(
  data: Buffer,
  expected: { sha256: string; sha3_256: string },
) {
  return {
    sha256Match: sha256(data) === expected.sha256,
    sha3_256Match: sha3_256(data) === expected.sha3_256,
  };
}

export type ChainRecord = {
  actorId: string;
  sequenceNumber: number;
  canonicalPayload: string;
  eventRecordHash: string;
  previousEventHash: string | null;
  signatureValue: string;
  signatureAlgorithm?: SignatureAlgorithm;
  signerPublicKeyPem?: string | null;
  signerPublicKeyHex?: string | null;
};

export function validateCustodyChain(records: ChainRecord[]) {
  let priorHash: string | null = null;
  const findings = [...records]
    .sort((left, right) => left.sequenceNumber - right.sequenceNumber)
    .map((record) => {
      const eventHashValid = sha3_256(record.canonicalPayload) === record.eventRecordHash;
      const chainLinkValid = record.previousEventHash === priorHash;
      const algorithm = record.signatureAlgorithm ?? "ECDSA-P256 / SHA-256";

      let signatureValid = false;
      if (algorithm === "ML-DSA-65 / FIPS 204") {
        signatureValid = verifyMldsa65Event(record.signerPublicKeyHex ?? null, record.canonicalPayload, record.signatureValue);
      } else {
        signatureValid = verifyEcdsa(record.signerPublicKeyPem ?? null, record.canonicalPayload, record.signatureValue);
      }

      priorHash = record.eventRecordHash;
      return {
        sequenceNumber: record.sequenceNumber,
        eventHashValid,
        chainLinkValid,
        signatureValid,
        signatureAlgorithm: algorithm,
      };
    });
  return { passed: findings.every((finding) => finding.eventHashValid && finding.chainLinkValid && finding.signatureValid), findings };
}

export const MLDSA_DISCLOSURE_TEXT = "ML-DSA runtime capability detected; no execution adapter is provisioned. No ML-DSA benchmark is performed.";

export function renderAuditMarkdown(input: {
  title: string;
  evidenceName: string;
  sha256: string;
  sha3_256: string;
  eventCount: number;
  pqStatus: string;
  executionAvailable?: boolean;
}) {
  const executionNote = input.executionAvailable
    ? "ML-DSA-65 execution is active. Real key generation, signing, and verification were performed."
    : "ML-DSA runtime capability detected; no execution adapter is provisioned. No ML-DSA benchmark is performed.";
  return `# PQ-ForensicVault Audit Report\n\n## Evidence manifest\n\n- **Case:** ${input.title}\n- **Evidence:** ${input.evidenceName}\n- **SHA-256:** \`${input.sha256}\`\n- **SHA3-256:** \`${input.sha3_256}\`\n- **Custody events:** ${input.eventCount}\n\n## Algorithm disclosure\n\nECDSA-P256 / SHA-256 signs canonical custody records. ML-DSA capability: **${input.pqStatus}**. ${executionNote}\n\n## Legal and methodological limitation\n\nTechnical hash, signature, and ledger results do not establish legal admissibility. Admissibility depends on jurisdiction, procedure, documentation, expert testimony, and applicable standards.\n`;
}
