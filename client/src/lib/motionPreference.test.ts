import { describe, expect, it } from "vitest";
import { motionProfileFor, observeMotionPreference, supportsFullWorkflow } from "./motionPreference";

describe("motion preference behaviour", () => {
  it("reports a reduced profile when the operating system requests reduced motion", () => {
    expect(motionProfileFor(true)).toBe("reduced");
    expect(motionProfileFor(false)).toBe("standard");
  });

  it("keeps all forensic workflow controls available in either motion profile", () => {
    expect(supportsFullWorkflow("standard")).toBe(true);
    expect(supportsFullWorkflow("reduced")).toBe(true);
  });

  it("updates the rendered-workspace profile when a media-query preference changes", () => {
    let listener: (() => void) | undefined;
    const query = {
      matches: false,
      addEventListener: (_type: "change", callback: () => void) => { listener = callback; },
      removeEventListener: (_type: "change", callback: () => void) => { if (listener === callback) listener = undefined; },
    };
    const updates: string[] = [];
    const stop = observeMotionPreference(query, (profile) => updates.push(profile));
    query.matches = true;
    listener?.();
    stop();

    expect(updates).toEqual(["standard", "reduced"]);
    expect(listener).toBeUndefined();
  });
});
