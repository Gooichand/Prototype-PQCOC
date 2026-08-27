export const permittedImageContentTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export const permittedCopyContentTypes = [
  "text/plain",
  "application/pdf",
  ...permittedImageContentTypes,
] as const;

export function isPermittedCopyContentType(contentType: string) {
  return (permittedCopyContentTypes as readonly string[]).includes(contentType);
}

export function isPreviewableImageContentType(contentType?: string | null) {
  return Boolean(contentType && (permittedImageContentTypes as readonly string[]).includes(contentType));
}
