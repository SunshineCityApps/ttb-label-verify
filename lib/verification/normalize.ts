/** Collapse runs of whitespace (including newlines from OCR) into single spaces. */
export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Replace curly quotes/apostrophes and unicode dashes with their ASCII forms. */
export function normalizePunctuation(s: string): string {
  return s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-");
}

/** Full normalization for case-insensitive comparison of names/designations. */
export function normalizeForComparison(s: string): string {
  return normalizePunctuation(collapseWhitespace(s)).toLowerCase();
}
