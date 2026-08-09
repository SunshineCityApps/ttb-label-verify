import type { ExtractedLabel, VerificationResult } from "./verification/types";

/** Success payload from POST /api/verify. */
export interface VerifyResponse {
  extracted: ExtractedLabel;
  result: VerificationResult;
}

/** Error payload from POST /api/verify. */
export interface VerifyError {
  error: string;
  errorType?: "unreadable" | "api_error";
}
