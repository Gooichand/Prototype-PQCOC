import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("forensic workspace accessibility safeguards", () => {
  it("keeps a reduced-motion override and a visible focus treatment", () => {
    const css = projectFile("client/src/index.css");

    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: .01ms !important");
    expect(css).toContain("transition-duration: .01ms !important");
  });

  it("exposes a keyboard-reachable control for permitted local-copy registration", () => {
    const workspace = projectFile("client/src/pages/Home.tsx");

    expect(workspace).toContain('type="button" className="file-button"');
    expect(workspace).toContain("ref={permittedFileInput}");
    expect(workspace).toContain('aria-label="Choose a permitted local file or image copy"');
    expect(workspace).toContain('aria-describedby="permitted-copy-safety-note"');
  });
});
