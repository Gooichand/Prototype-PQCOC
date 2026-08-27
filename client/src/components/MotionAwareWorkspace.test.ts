// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MotionAwareWorkspace } from "./MotionAwareWorkspace";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface TestMediaQuery {
  matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
  emit(): void;
  listenerCount(): number;
}

function createTestMediaQuery(initialValue: boolean): TestMediaQuery {
  const listeners = new Set<() => void>();
  return {
    matches: initialValue,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    emit: () => listeners.forEach((listener) => listener()),
    listenerCount: () => listeners.size,
  };
}

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("MotionAwareWorkspace", () => {
  it("renders the reduced workspace profile after a reduced-motion media-query update while keeping controls enabled", () => {
    const mediaQuery = createTestMediaQuery(false);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(createElement(
        MotionAwareWorkspace,
        { mediaQuery },
        createElement("button", { type: "button" }, "Run independent verification"),
      ));
    });

    const workspace = container?.querySelector("main");
    expect(workspace?.getAttribute("data-motion-profile")).toBe("standard");
    expect(container?.querySelector("button")?.disabled).toBe(false);

    mediaQuery.matches = true;
    act(() => mediaQuery.emit());

    expect(workspace?.getAttribute("data-motion-profile")).toBe("reduced");
    expect(container?.querySelector("button")?.disabled).toBe(false);
  });

  it("removes its media-query listener when the workspace unmounts", () => {
    const mediaQuery = createTestMediaQuery(true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(createElement(MotionAwareWorkspace, { mediaQuery }, "workspace")));
    expect(mediaQuery.listenerCount()).toBe(1);
    act(() => root?.unmount());
    expect(mediaQuery.listenerCount()).toBe(0);
    root = undefined;
  });
});
