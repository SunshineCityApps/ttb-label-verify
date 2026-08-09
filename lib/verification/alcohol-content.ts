import type { FieldResult } from "./types";

interface ParsedAlcohol {
  abv: number;
  proof: number | null;
}

/**
 * Pull the ABV percentage (and proof, if stated) out of free text like
 * "45% Alc./Vol. (90 Proof)", "Alc. 45% by Vol.", or a bare "45%".
 */
export function parseAlcoholContent(text: string): ParsedAlcohol | null {
  const abvMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!abvMatch) return null;

  const proofMatch = text.match(/(\d+(?:\.\d+)?)\s*proof/i);
  return {
    abv: parseFloat(abvMatch[1]),
    proof: proofMatch ? parseFloat(proofMatch[1]) : null,
  };
}

/**
 * Numeric comparison of alcohol content: the ABV on the label must equal the
 * ABV on the application. When the label also states proof, proof must equal
 * 2 × ABV (a wrong proof is a label defect even if the ABV matches).
 */
export function compareAlcoholContent(
  labelValue: string | null,
  applicationValue: string,
): FieldResult {
  const field = "alcoholContent";

  if (labelValue === null || labelValue.trim() === "") {
    return {
      field,
      status: "mismatch",
      labelValue: null,
      applicationValue,
      note: "Not found on the label.",
    };
  }

  const label = parseAlcoholContent(labelValue);
  const application = parseAlcoholContent(applicationValue);

  if (!application) {
    return {
      field,
      status: "mismatch",
      labelValue,
      applicationValue,
      note: `Could not read an ABV percentage from the application value "${applicationValue}".`,
    };
  }
  if (!label) {
    return {
      field,
      status: "mismatch",
      labelValue,
      applicationValue,
      note: `Could not read an ABV percentage from the label text "${labelValue}".`,
    };
  }

  if (Math.abs(label.abv - application.abv) > 0.001) {
    return {
      field,
      status: "mismatch",
      labelValue,
      applicationValue,
      note: `Label states ${label.abv}% ABV but the application states ${application.abv}%.`,
    };
  }

  if (label.proof !== null && Math.abs(label.proof - 2 * label.abv) > 0.001) {
    return {
      field,
      status: "mismatch",
      labelValue,
      applicationValue,
      note: `ABV matches, but the stated proof (${label.proof}) does not equal 2 × ${label.abv}% ABV (${2 * label.abv} proof expected).`,
    };
  }

  return { field, status: "match", labelValue, applicationValue };
}
