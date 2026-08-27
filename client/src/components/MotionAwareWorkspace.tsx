import React, { type ReactNode, useEffect, useState } from "react";
import { motionProfileFor, observeMotionPreference, type MotionMediaQuery } from "@/lib/motionPreference";

interface MotionAwareWorkspaceProps {
  children: ReactNode;
  mediaQuery?: MotionMediaQuery;
}

export function MotionAwareWorkspace({ children, mediaQuery }: MotionAwareWorkspaceProps) {
  const [motionProfile, setMotionProfile] = useState(() => motionProfileFor(mediaQuery?.matches ?? false));

  useEffect(() => {
    const query = mediaQuery ?? window.matchMedia("(prefers-reduced-motion: reduce)");
    return observeMotionPreference(query, setMotionProfile);
  }, [mediaQuery]);

  return <main className="paper-shell" data-motion-profile={motionProfile}>{children}</main>;
}
