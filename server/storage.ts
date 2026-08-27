import { ENV } from "./_core/env";

// =============================================================================
// In-memory storage (used when BUILT_IN_FORGE_API_URL is not set)
// =============================================================================

const memStorage = new Map<string, { data: Uint8Array; contentType: string }>();

function useMemStorage(): boolean {
  return !ENV.forgeApiUrl || !ENV.forgeApiKey;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

// =============================================================================
// In-memory implementation
// =============================================================================

async function memStoragePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  memStorage.set(key, { data: bytes, contentType });
  console.log(`[Storage] In-memory PUT: ${key} (${bytes.byteLength} bytes)`);
  return { key, url: `/manus-storage/${key}` };
}

async function memStorageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  if (!memStorage.has(key)) {
    throw new Error(`[Storage] Key not found: ${key}`);
  }
  return `/manus-storage/${key}`;
}

// =============================================================================
// Forge/S3 implementation (when configured)
// =============================================================================

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error("Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY");
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

async function forgeStoragePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));

  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }

  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");

  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }

  return { key, url: `/manus-storage/${key}` };
}

async function forgeStorageGetSignedUrl(relKey: string): Promise<string> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeKey(relKey);

  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);

  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }

  const { url } = (await resp.json()) as { url: string };
  return url;
}

// =============================================================================
// Unified API
// =============================================================================

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  if (useMemStorage()) {
    return memStoragePut(relKey, data, contentType);
  }
  return forgeStoragePut(relKey, data, contentType);
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  if (useMemStorage()) {
    return memStorageGetSignedUrl(relKey);
  }
  return forgeStorageGetSignedUrl(relKey);
}

/**
 * Resolves a storage URL or path to an absolute URL suitable for server-side fetch().
 *
 * - Absolute URLs (http://, https://) are returned unchanged.
 * - Relative paths (/manus-storage/...) are resolved against the provided app origin.
 * - Falls back to http://localhost when no origin is available.
 *
 * This prevents Node.js fetch() from failing on relative URLs.
 */
export function resolveStorageReadUrl(urlOrKey: string, appOrigin?: string): string {
  if (urlOrKey.startsWith("http://") || urlOrKey.startsWith("https://")) {
    return urlOrKey;
  }
  const origin = appOrigin || "http://localhost";
  return `${origin}${urlOrKey.startsWith("/") ? "" : "/"}${urlOrKey}`;
}

/**
 * Reads artifact bytes directly from in-memory storage, bypassing any URL
 * resolution. Returns null if the key is not found or storage is not in-memory.
 */
export async function storageReadBuffer(storageKey: string): Promise<Buffer | null> {
  if (!useMemStorage()) return null;
  const key = normalizeKey(storageKey);
  const entry = memStorage.get(key);
  if (!entry) return null;
  return Buffer.from(entry.data);
}

/** Serve in-memory stored artifacts (called from Express middleware). */
export function serveInMemoryArtifact(key: string, res: any) {
  const entry = memStorage.get(key);
  if (!entry) {
    res.status(404).send("Artifact not found");
    return;
  }
  res.set("Content-Type", entry.contentType);
  res.set("Cache-Control", "no-store");
  res.send(Buffer.from(entry.data));
}
