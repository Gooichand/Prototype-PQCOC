import { describe, expect, it } from "vitest";
import { isPermittedCopyContentType, isPreviewableImageContentType } from "./permittedFiles";

describe("permitted evidence file helpers", () => {
  it("recognises supported image formats as permitted, previewable evidence copies", () => {
    expect(isPermittedCopyContentType("image/png")).toBe(true);
    expect(isPermittedCopyContentType("image/jpeg")).toBe(true);
    expect(isPreviewableImageContentType("image/webp")).toBe(true);
    expect(isPreviewableImageContentType("image/gif")).toBe(true);
  });

  it("does not treat unsupported content as safe or previewable", () => {
    expect(isPermittedCopyContentType("image/svg+xml")).toBe(false);
    expect(isPermittedCopyContentType("application/octet-stream")).toBe(false);
    expect(isPreviewableImageContentType("text/plain")).toBe(false);
  });
});
