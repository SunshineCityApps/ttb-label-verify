import { compareAlcoholContent } from "./alcohol-content";
import { compareGovernmentWarning } from "./government-warning";
import { compareNetContents } from "./net-contents";
import { compareTextField } from "./text-fields";
import type {
  ApplicationData,
  ExtractedLabel,
  OverallVerdict,
  VerificationResult,
} from "./types";

export * from "./types";
export { CANONICAL_WARNING } from "./government-warning";

/**
 * Deterministic verification of an extracted label against application data.
 * The AI's only job is reading the label; every pass/fail decision happens
 * here, in plain testable code.
 */
export function verifyLabel(
  label: ExtractedLabel,
  application: ApplicationData,
): VerificationResult {
  const fields = [
    compareTextField("brandName", label.brandName, application.brandName),
    compareTextField("classType", label.classType, application.classType),
    compareAlcoholContent(label.alcoholContent, application.alcoholContent),
    compareNetContents(label.netContents, application.netContents),
    compareGovernmentWarning(label.governmentWarningText),
  ];

  return { fields, overall: overallVerdict(fields) };
}

function overallVerdict(fields: VerificationResult["fields"]): OverallVerdict {
  if (fields.some((f) => f.status === "mismatch")) return "fail";
  if (fields.some((f) => f.status === "match_with_note")) return "needs_review";
  return "pass";
}
