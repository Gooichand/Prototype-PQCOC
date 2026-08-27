export type MotionProfile = "standard" | "reduced";

export interface MotionMediaQuery {
  matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

export function motionProfileFor(prefersReducedMotion: boolean): MotionProfile {
  return prefersReducedMotion ? "reduced" : "standard";
}

export function supportsFullWorkflow(profile: MotionProfile): boolean {
  return profile === "standard" || profile === "reduced";
}

export function observeMotionPreference(query: MotionMediaQuery, updateProfile: (profile: MotionProfile) => void) {
  const syncProfile = () => updateProfile(motionProfileFor(query.matches));
  syncProfile();
  query.addEventListener("change", syncProfile);
  return () => query.removeEventListener("change", syncProfile);
}
