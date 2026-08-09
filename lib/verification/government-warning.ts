import { collapseWhitespace, normalizePunctuation } from "./normalize";
import type { FieldResult } from "./types";

/** Statutory text, 27 CFR 16.21. Must appear word-for-word. */
export const CANONICAL_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not " +
  "drink alcoholic beverages during pregnancy because of the risk of birth " +
  "defects. (2) Consumption of alcoholic beverages impairs your ability to " +
  "drive a car or operate machinery, and may cause health problems.";

const FORMATTING_LIMITATION =
  "Bold weight and type size cannot be verified from an image — confirm visually.";

/**
 * The government warning is the one field with no fuzzy matching: the text
 * must match the statutory wording exactly, and the "GOVERNMENT WARNING:"
 * lead-in must be in ALL CAPS. Whitespace/line breaks are the only thing
 * forgiven, since OCR of a wrapped paragraph introduces them.
 *
 * Even a perfect match carries a note: bold weight and type size are also
 * required by regulation but cannot be reliably judged from an image, so the
 * agent is always told to confirm those visually.
 */
export function compareGovernmentWarning(labelValue: string | null): FieldResult {
  const field = "governmentWarning";

  if (labelValue === null || collapseWhitespace(labelValue) === "") {
    return {
      field,
      status: "mismatch",
      labelValue: null,
      applicationValue: null,
      note: "Government warning statement not found on the label. It is mandatory on all alcohol beverages.",
    };
  }

  const label = normalizePunctuation(collapseWhitespace(labelValue));

  if (label === CANONICAL_WARNING) {
    return {
      field,
      status: "match",
      labelValue: label,
      applicationValue: null,
      note: FORMATTING_LIMITATION,
    };
  }

  // Same words with identical casing, only punctuation differs. OCR cannot
  // reliably read punctuation on imperfect photos (a dropped period on an
  // angled shot is noise, not a violation), so this goes to the agent as a
  // review item instead of a false rejection.
  if (stripPunctuation(label) === stripPunctuation(CANONICAL_WARNING)) {
    return {
      field,
      status: "match_with_note",
      labelValue: label,
      applicationValue: null,
      note:
        "Wording and capitalization match the statutory text, but punctuation could not be verified exactly from the image — confirm it visually. " +
        FORMATTING_LIMITATION,
    };
  }

  // Same words, wrong casing — the classic "Government Warning" in title case.
  if (stripPunctuation(label).toLowerCase() === stripPunctuation(CANONICAL_WARNING).toLowerCase()) {
    const leadIn = label.slice(0, "GOVERNMENT WARNING:".length);
    const capsProblem = leadIn !== "GOVERNMENT WARNING:";
    return {
      field,
      status: "mismatch",
      labelValue: label,
      applicationValue: null,
      note: capsProblem
        ? `"${leadIn}" must be in all caps: "GOVERNMENT WARNING:".`
        : "Wording matches but capitalization deviates from the statutory text.",
    };
  }

  return {
    field,
    status: "mismatch",
    labelValue: label,
    applicationValue: null,
    note: `Warning text deviates from the statutory wording. ${describeFirstDeviation(label)}`,
  };
}

/** Remove punctuation, keeping letters/digits/spaces, and re-collapse whitespace. */
function stripPunctuation(s: string): string {
  return collapseWhitespace(s.replace(/[^\p{L}\p{N}\s]/gu, ""));
}

function describeFirstDeviation(label: string): string {
  const labelWords = label.split(" ");
  const canonicalWords = CANONICAL_WARNING.split(" ");
  const limit = Math.min(labelWords.length, canonicalWords.length);
  for (let i = 0; i < limit; i++) {
    if (labelWords[i] !== canonicalWords[i]) {
      return `First difference at word ${i + 1}: label says "${labelWords[i]}", statute says "${canonicalWords[i]}".`;
    }
  }
  return labelWords.length < canonicalWords.length
    ? "The label text is truncated."
    : "The label adds extra text beyond the statutory wording.";
}
