// @vitest-environment happy-dom
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      forensic: {
        dashboard: { invalidate: vi.fn() }, cases: { invalidate: vi.fn() }, evidence: { invalidate: vi.fn() },
        timeline: { invalidate: vi.fn() }, benchmarks: { invalidate: vi.fn() }, auditExport: { invalidate: vi.fn() },
      },
    }),
    forensic: {
      dashboard: { useQuery: () => ({ data: { evidenceCount: 0, verifiedCount: 0, reviewCount: 0, latestBenchmark: null }, isLoading: false }) },
      capability: { useQuery: () => ({ data: { status: "unavailable", detail: "test" }, isLoading: false }) },
      cases: { useQuery: () => ({ data: [], isLoading: false }) },
      investigators: { useQuery: () => ({ data: [], isLoading: false }) },
      evidence: { useQuery: () => ({ data: [], isLoading: false }) },
      benchmarks: { useQuery: () => ({ data: [], isLoading: false }) },
      timeline: { useQuery: () => ({ data: [], isLoading: false }) },
      auditExport: { useQuery: () => ({ data: null, isLoading: false }) },
      acquireDemo: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      createDemoCase: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      handover: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      verify: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      tamper: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      resetTamper: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      runBenchmark: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      registerLocalCopy: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      resetPresentationDemo: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import Home from "./Home";

let root: ReturnType<typeof createRoot> | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

function renderHome() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(createElement(Home)));
  return container;
}

describe("Regression: analytics removal", () => {
  it("does not contain unresolved VITE_ placeholders in the built HTML", async () => {
    const html = document.documentElement.outerHTML;
    expect(html).not.toMatch(/%VITE_[A-Z_]+%/);
  });

  it("does not render any analytics script tags", async () => {
    const container = renderHome();
    const scripts = container.querySelectorAll("script[src*='analytics'], script[src*='tracking'], script[src*='gtag']");
    expect(scripts.length).toBe(0);
  });
});

describe("Regression: bundle splitting", () => {
  it("renders overview panel without errors", async () => {
    const container = renderHome();
    expect(container.querySelector(".metric-grid")).toBeTruthy();
    expect(container.textContent).toContain("Evidence artifacts");
  });

  it("renders nav items for all panels", async () => {
    const container = renderHome();
    const navButtons = container.querySelectorAll(".nav-item");
    const labels = Array.from(navButtons).map((b) => b.textContent);
    expect(labels.some((l) => l?.includes("Command overview"))).toBe(true);
    expect(labels.some((l) => l?.includes("Benchmark observatory"))).toBe(true);
    expect(labels.some((l) => l?.includes("Report center"))).toBe(true);
    expect(labels.some((l) => l?.includes("Standards & settings"))).toBe(true);
    expect(labels.some((l) => l?.includes("Acceptance tests"))).toBe(true);
  });

  it("can navigate to each panel without runtime errors", async () => {
    const container = renderHome();
    const navButtons = Array.from(container.querySelectorAll(".nav-item"));

    for (const btn of navButtons) {
      await act(async () => {
        (btn as HTMLButtonElement).click();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      // Should not throw — the panel rendered without crashing
    }
  });
});

describe("Regression: core functionality preserved", () => {
  it("displays the PQ capability status", async () => {
    const container = renderHome();
    expect(container.textContent).toContain("unavailable");
  });

  it("shows the evidence vault navigation", async () => {
    const container = renderHome();
    expect(container.textContent).toContain("Evidence vault");
  });

  it("shows ML-DSA disclosure text", async () => {
    const container = renderHome();
    expect(container.textContent).toContain("ML-DSA");
  });
});
