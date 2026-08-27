import { ml_dsa65, type DSA } from "@noble/post-quantum/ml-dsa.js";
import { randomBytes } from "@noble/post-quantum/utils.js";

export type Mldsa65AdapterStatus = {
  algorithm: "ML-DSA-65 (FIPS 204)";
  adapterAvailable: boolean;
  keygenOk: boolean;
  signOk: boolean;
  verifyOk: boolean;
  tamperRejected: boolean;
  publicKeyBytes: number;
  secretKeyBytes: number;
  signatureBytes: number;
  packageVersion: string;
  detail: string;
};

export type Mldsa65KeyPair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};

export type Mldsa65SignatureResult = {
  signature: Uint8Array;
  algorithm: "ML-DSA-65 / FIPS 204";
};

let adapterValidated = false;
let adapterStatus: Mldsa65AdapterStatus | null = null;

const VERSION = "0.7.0";

function signer(): DSA {
  return ml_dsa65;
}

export function isMldsaExecutionAvailable(): boolean {
  return adapterValidated && adapterStatus?.adapterAvailable === true;
}

export function getMldsa65AdapterStatus(): Mldsa65AdapterStatus {
  if (adapterStatus) return adapterStatus;
  return {
    algorithm: "ML-DSA-65 (FIPS 204)",
    adapterAvailable: false,
    keygenOk: false,
    signOk: false,
    verifyOk: false,
    tamperRejected: false,
    publicKeyBytes: 0,
    secretKeyBytes: 0,
    signatureBytes: 0,
    packageVersion: VERSION,
    detail: "Adapter not yet validated.",
  };
}

export function validateAdapter(): Mldsa65AdapterStatus {
  if (adapterValidated && adapterStatus) return adapterStatus;

  try {
    const s = signer();
    const keys = s.keygen();
    const publicKeyBytes = keys.publicKey.byteLength;
    const secretKeyBytes = keys.secretKey.byteLength;

    const msg = new TextEncoder().encode("pq-forensic-vault-mldsa-validation-probe");
    const sig = s.sign(msg, keys.secretKey);
    const signatureBytes = sig.byteLength;

    const verifyOk = s.verify(sig, msg, keys.publicKey);

    const tampered = new TextEncoder().encode("pq-forensic-vault-mldsa-validation-probe-tampered");
    const tamperRejected = !s.verify(sig, tampered, keys.publicKey);

    const wrongKeys = s.keygen();
    const wrongKeyRejected = !s.verify(sig, msg, wrongKeys.publicKey);

    const allPassed = verifyOk && tamperRejected && wrongKeyRejected &&
      publicKeyBytes === 1952 && secretKeyBytes === 4032 && signatureBytes === 3309;

    adapterStatus = {
      algorithm: "ML-DSA-65 (FIPS 204)",
      adapterAvailable: allPassed,
      keygenOk: true,
      signOk: true,
      verifyOk,
      tamperRejected,
      publicKeyBytes,
      secretKeyBytes,
      signatureBytes,
      packageVersion: VERSION,
      detail: allPassed
        ? "ML-DSA-65 execution adapter validated successfully. Key generation, signing, verification, and tamper rejection all passed."
        : "ML-DSA-65 adapter validation failed: unexpected key sizes or verification result.",
    };
    adapterValidated = true;

    keys.secretKey.fill(0);
    wrongKeys.secretKey.fill(0);

    return adapterStatus;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    adapterStatus = {
      algorithm: "ML-DSA-65 (FIPS 204)",
      adapterAvailable: false,
      keygenOk: false,
      signOk: false,
      verifyOk: false,
      tamperRejected: false,
      publicKeyBytes: 0,
      secretKeyBytes: 0,
      signatureBytes: 0,
      packageVersion: VERSION,
      detail: `ML-DSA-65 adapter initialization failed: ${detail}`,
    };
    adapterValidated = true;
    return adapterStatus;
  }
}

export function generateMldsa65KeyPair(): Mldsa65KeyPair {
  if (!isMldsaExecutionAvailable()) {
    throw new Error("ML-DSA-65 execution adapter is not available. No key pair generated.");
  }
  const s = signer();
  const keys = s.keygen();
  return { publicKey: keys.publicKey, secretKey: keys.secretKey };
}

export function signMldsa65(
  message: Uint8Array,
  secretKey: Uint8Array,
): Mldsa65SignatureResult {
  if (!isMldsaExecutionAvailable()) {
    throw new Error("ML-DSA-65 execution adapter is not available. No signature produced.");
  }
  const s = signer();
  const signature = s.sign(message, secretKey);
  return { signature, algorithm: "ML-DSA-65 / FIPS 204" };
}

export function verifyMldsa65(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  if (!isMldsaExecutionAvailable()) {
    return false;
  }
  try {
    const s = signer();
    return s.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

export function getMldsa65ParameterMetadata() {
  return {
    algorithm: "ML-DSA-65",
    standard: "FIPS 204",
    securityLevel: 3,
    publicKeyBytes: 1952,
    secretKeyBytes: 4032,
    signatureBytes: 3309,
    package: "@noble/post-quantum",
    packageVersion: VERSION,
    audit: "Cure53 (2024)",
    seedBytes: 32,
  } as const;
}

export function resetAdapterState() {
  adapterValidated = false;
  adapterStatus = null;
}
