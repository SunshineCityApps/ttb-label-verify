/** Fields the producer submitted on the application (COLA form data). */
export interface ApplicationData {
  brandName: string;
  classType: string;
  /** As entered on the application, e.g. "45%" or "45% Alc./Vol." */
  alcoholContent: string;
  /** e.g. "750 mL" */
  netContents: string;
}

/**
 * What Claude vision extracted from the label image. Values are verbatim
 * text as printed on the label; null means the field was not visible.
 */
export interface ExtractedLabel {
  brandName: string | null;
  classType: string | null;
  alcoholContent: string | null;
  netContents: string | null;
  governmentWarningText: string | null;
}

export type MatchStatus = "match" | "match_with_note" | "mismatch";

export type FieldName =
  | "brandName"
  | "classType"
  | "alcoholContent"
  | "netContents"
  | "governmentWarning";

export interface FieldResult {
  field: FieldName;
  status: MatchStatus;
  /** Verbatim value read from the label, or null if not found. */
  labelValue: string | null;
  /** Value from the application (null for the warning — it is checked against statute, not the application). */
  applicationValue: string | null;
  /** Human-readable explanation shown to the agent. Always present for non-exact results. */
  note?: string;
}

export type OverallVerdict = "pass" | "needs_review" | "fail";

export interface VerificationResult {
  fields: FieldResult[];
  overall: OverallVerdict;
}
