// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { invalidate, mutation, mockTrpc } = vi.hoisted(() => {
  const invalidate = vi.fn(async () => undefined);
  const mutation = { mutate: vi.fn(), isPending: false };
  const query = (data: unknown) => ({ data, isLoading: false });
  const mockTrpc: any = {
    useUtils: () => ({
      forensic: {
        dashboard: { invalidate }, cases: { invalidate }, evidence: { invalidate }, timeline: { invalidate }, benchmarks: { invalidate }, auditExport: { invalidate },
      },
    }),
    forensic: {
      dashboard: { useQuery: () => query({ evidenceCount: 1, verifiedCount: 1, reviewCount: 0, latestBenchmark: null }) },
      capability: { useQuery: () => query({ status: "unavailable", detail: "Native ML-DSA is unavailable in this test runtime." }) },
      cases: { useQuery: () => query([{ id: "case-image", title: "SYN-IMAGE · Preview Case", description: "Synthetic image-preview validation case." }]) },
      investigators: { useQuery: () => query([]) },
      evidence: { useQuery: () => query([{
        id: "evi-image", originalName: "stored-checkpoint.png", contentType: "image/png", byteSize: 68,
        sha256: "a".repeat(64), sha3_256: "b".repeat(64), storageKey: "evidence/evi-image.png",
        storageUrl: "/manus-storage/evidence/evi-image.png", acquisitionLocation: "Test workstation", acquiredAt: 1_700_000_000_000, status: "verified",
      }]) },
      benchmarks: { useQuery: () => query([]) },
      timeline: { useQuery: () => query([]) },
      auditExport: { useQuery: () => query(null) },
      acquireDemo: { useMutation: () => mutation },
      createDemoCase: { useMutation: () => mutation },
      handover: { useMutation: () => mutation },
      verify: { useMutation: () => mutation },
      tamper: { useMutation: () => mutation },
      resetTamper: { useMutation: () => mutation },
      runBenchmark: { useMutation: () => mutation },
      registerLocalCopy: { useMutation: () => mutation },
      resetPresentationDemo: { useMutation: () => mutation },
    },
  };
  return { invalidate, mutation, mockTrpc };
});

vi.mock("@/lib/trpc", () => ({ trpc: mockTrpc }));

import Home from "./Home";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let originalCreateObjectUrl: typeof URL.createObjectURL | undefined;
let originalRevokeObjectUrl: typeof URL.revokeObjectURL | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  mutation.mutate.mockClear();
  if (originalCreateObjectUrl) Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectUrl });
  if (originalRevokeObjectUrl) Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectUrl });
});

describe("Evidence Vault permitted-image previews", () => {
  it("renders both the stored immutable image preview and the local pre-registration preview", async () => {
    originalCreateObjectUrl = URL.createObjectURL;
    originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:local-safe-preview") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => { root?.render(createElement(Home)); });

    const vaultButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Evidence vault"));
    expect(vaultButton).toBeTruthy();
    await act(async () => { vaultButton?.click(); });

    const storedPreview = container.querySelector('img[alt="Stored permitted evidence preview: stored-checkpoint.png"]');
    expect(storedPreview?.getAttribute("src")).toBe("/manus-storage/evidence/evi-image.png");
    expect(container.textContent).toContain("Visual review does not replace independent hash and signature verification.");

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const permittedImage = new File(["safe-image-bytes"], "local-checkpoint.png", { type: "image/png" });
    Object.defineProperty(fileInput, "files", { configurable: true, value: [permittedImage] });
    await act(async () => { fileInput.dispatchEvent(new Event("change", { bubbles: true })); });

    const localPreview = container.querySelector('img[alt="Local preview of local-checkpoint.png"]');
    expect(localPreview?.getAttribute("src")).toBe("blob:local-safe-preview");
    expect(container.textContent).toContain("Local preview only");
  });
});
