import {
  collapseWhitespace,
  normalizeForComparison,
  normalizePunctuation,
} from "./normalize";
import type { FieldName, FieldResult } from "./types";

/**
 * Three-state comparison for free-text fields (brand name, class/type).
 *
 * - Identical after trimming/whitespace collapse → MATCH
 * - Same content but formatting differs (case, quote style) → MATCH WITH NOTE,
 *   e.g. label "STONE'S THROW" vs application "Stone's Throw". The agent makes
 *   the final call instead of the tool auto-rejecting.
 * - Different content, or missing from the label → MISMATCH
 */
export function compareTextField(
  field: FieldName,
  labelValue: string | null,
  applicationValue: string,
): FieldResult {
  if (labelValue === null || collapseWhitespace(labelValue) === "") {
    return {
      field,
      status: "mismatch",
      labelValue: null,
      applicationValue,
      note: "Not found on the label.",
    };
  }

  const label = collapseWhitespace(labelValue);
  const application = collapseWhitespace(applicationValue);

  if (label === application) {
    return { field, status: "match", labelValue: label, applicationValue };
  }

  if (normalizeForComparison(label) === normalizeForComparison(application)) {
    return {
      field,
      status: "match_with_note",
      labelValue: label,
      applicationValue,
      note: describeFormattingDifference(label, application),
    };
  }

  return {
    field,
    status: "mismatch",
    labelValue: label,
    applicationValue,
    note: `Label says "${label}" but the application says "${application}".`,
  };
}

function describeFormattingDifference(label: string, application: string): string {
  const differences: string[] = [];
  if (label.toLowerCase() === application.toLowerCase()) {
    differences.push("capitalization differs");
  }
  if (normalizePunctuation(label) !== label || normalizePunctuation(application) !== application) {
    differences.push("quote/punctuation style differs");
  }
  const detail = differences.length > 0 ? differences.join("; ") : "formatting differs";
  return `Same content, but ${detail} (label: "${label}", application: "${application}").`;
}
