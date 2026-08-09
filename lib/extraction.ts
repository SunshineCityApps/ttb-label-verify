import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ExtractedLabel } from "./verification/types";

/**
 * Fast model class per the <5s requirement — the previous vendor pilot died
 * at 30-40s per label. Haiku is the speed pick; override with CLAUDE_MODEL
 * (e.g. claude-sonnet-5) if extraction accuracy needs a bump.
 */
const MODEL = process.env.CLAUDE_MODEL ?? "claude-haiku-4-5";

const client = new Anthropic();

/** What Claude vision reads off the label. Structured output guarantees this shape. */
const ExtractionSchema = z.object({
  is_label: z
    .boolean()
    .describe(
      "false if the image is not an alcohol beverage label at all (e.g. a photo of something else, a blank image, an unrelated document)",
    ),
  readable: z
    .boolean()
    .describe(
      "false if the image is too blurry, dark, or obstructed to read the label text reliably",
    ),
  brand_name: z
    .union([z.string(), z.null()])
    .describe("Brand name exactly as printed, preserving capitalization; null if not visible"),
  class_type: z
    .union([z.string(), z.null()])
    .describe(
      'Class/type designation exactly as printed, e.g. "Kentucky Straight Bourbon Whiskey"; null if not visible',
    ),
  alcohol_content: z
    .union([z.string(), z.null()])
    .describe(
      'Alcohol content statement exactly as printed, e.g. "45% Alc./Vol. (90 Proof)"; null if not visible',
    ),
  net_contents: z
    .union([z.string(), z.null()])
    .describe('Net contents exactly as printed, e.g. "750 mL"; null if not visible'),
  government_warning_text: z
    .union([z.string(), z.null()])
    .describe(
      "The complete government warning statement transcribed verbatim, character for character, preserving the exact capitalization of every word (do NOT normalize case); null if not present",
    ),
});

export type ExtractionResult =
  | { ok: true; label: ExtractedLabel }
  | { ok: false; error: "not_label" | "unreadable" | "api_error"; message: string };

const SYSTEM_PROMPT = `You are a precise OCR system for alcohol beverage labels. Transcribe text exactly as printed on the label — exact capitalization, exact punctuation, exact wording. Never correct, normalize, or complete text; a compliance check depends on faithful transcription. If a field is not visible on the label, return null for it.`;

type SupportedMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export async function extractLabel(
  imageBase64: string,
  mediaType: SupportedMediaType,
): Promise<ExtractionResult> {
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
            {
              type: "text",
              text: "Extract the labeled fields from this alcohol beverage label.",
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(ExtractionSchema) },
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return {
        ok: false,
        error: "api_error",
        message: "The AI response could not be parsed. Please try again.",
      };
    }

    if (!parsed.is_label) {
      return {
        ok: false,
        error: "not_label",
        message:
          "This image doesn't appear to be an alcohol beverage label. Please upload a photo of the label itself.",
      };
    }

    if (!parsed.readable) {
      return {
        ok: false,
        error: "unreadable",
        message:
          "The label image is too unclear to read reliably. Request a better image from the applicant rather than guessing.",
      };
    }

    return {
      ok: true,
      label: {
        brandName: parsed.brand_name,
        classType: parsed.class_type,
        alcoholContent: parsed.alcohol_content,
        netContents: parsed.net_contents,
        governmentWarningText: parsed.government_warning_text,
      },
    };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return {
        ok: false,
        error: "api_error",
        message: "The AI service is busy. Please wait a few seconds and try again.",
      };
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return {
        ok: false,
        error: "api_error",
        message: "Could not reach the AI service. Check your connection and try again.",
      };
    }
    if (error instanceof Anthropic.APIError) {
      return {
        ok: false,
        error: "api_error",
        message: `The AI service returned an error (${error.status}). Please try again.`,
      };
    }
    throw error;
  }
}
