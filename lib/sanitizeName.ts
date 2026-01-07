// lib/sanitizeName.ts
export function sanitizeMediaName(filename: string) {
  return filename
    .replace(/\.[^/.]+$/, "")        // remove extension
    .replace(/[_\-]+/g, " ")          // underscores & dashes → spaces
    .replace(/[^\w\s]/g, "")          // remove special chars
    .replace(/\s+/g, " ")             // collapse spaces
    .trim()
    .toLowerCase();
}

export function toTitleCase(str: string) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

