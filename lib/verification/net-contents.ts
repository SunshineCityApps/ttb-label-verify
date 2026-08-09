import type { FieldResult } from "./types";

type UnitSystem = "metric" | "us";

interface ParsedVolume {
  /** Milliliters for metric, fluid ounces for US — comparable only within a system. */
  quantity: number;
  system: UnitSystem;
  /** Canonical display unit, e.g. "mL" or "fl oz". */
  unit: string;
}

const METRIC_FACTORS: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  millilitre: 1,
  millilitres: 1,
  cl: 10,
  centiliter: 10,
  centiliters: 10,
  centilitre: 10,
  centilitres: 10,
  l: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
};

/** Parse "750 mL", "750ml", "1 L", "25.4 FL. OZ." etc. Unit matching is case-insensitive. */
export function parseNetContents(text: string): ParsedVolume | null {
  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(fl\.?\s*oz\.?|oz\.?|[a-z]+\.?)/i,
  );
  if (!match) return null;

  const quantity = parseFloat(match[1]);
  const rawUnit = match[2].toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

  if (rawUnit === "fl oz" || rawUnit === "floz" || rawUnit === "oz") {
    return { quantity, system: "us", unit: "fl oz" };
  }

  const factor = METRIC_FACTORS[rawUnit];
  if (factor === undefined) return null;

  return { quantity: quantity * factor, system: "metric", unit: "mL" };
}

/**
 * Net contents match on volume, not formatting: "750 mL", "750ml", and
 * "750 ML" are all the same statement. Equal volume in different units
 * (e.g. "0.75 L") still matches but gets a note. Metric and US units are
 * never converted across systems — that gets flagged for the agent instead
 * of trusting a rounding-sensitive conversion.
 */
export function compareNetContents(
  labelValue: string | null,
  applicationValue: string,
): FieldResult {
  const field = "netContents";

  if (labelValue === null || labelValue.trim() === "") {
    return {
      field,
      status: "mismatch",
      labelValue: null,
      applicationValue,
      note: "Not found on the label.",
    };
  }

  const label = parseNetContents(labelValue);
  const application = parseNetContents(applicationValue);

  if (!application) {
    return {
      field,
      status: "mismatch",
      labelValue,
      applicationValue,
      note: `Could not read a volume from the application value "${applicationValue}".`,
    };
  }
  if (!label) {
    return {
      field,
      status: "mismatch",
      labelValue,
      applicationValue,
      note: `Could not read a volume from the label text "${labelValue}".`,
    };
  }

  if (label.system !== application.system) {
    return {
      field,
      status: "mismatch",
      labelValue,
      applicationValue,
      note: `Label uses ${label.system === "us" ? "US" : "metric"} units but the application uses ${application.system === "us" ? "US" : "metric"} units — verify the conversion manually.`,
    };
  }

  if (Math.abs(label.quantity - application.quantity) > 0.001) {
    return {
      field,
      status: "mismatch",
      labelValue,
      applicationValue,
      note: `Label states ${labelValue.trim()} but the application states ${applicationValue.trim()}.`,
    };
  }

  const sameUnitText = labelValue.replace(/\s+/g, "").toLowerCase() === applicationValue.replace(/\s+/g, "").toLowerCase();
  if (!sameUnitText && labelUnitDiffers(labelValue, applicationValue)) {
    return {
      field,
      status: "match_with_note",
      labelValue,
      applicationValue,
      note: `Same volume expressed differently (label: "${labelValue.trim()}", application: "${applicationValue.trim()}").`,
    };
  }

  return { field, status: "match", labelValue, applicationValue };
}

/** True when the two texts state the volume with different numbers/units (e.g. 0.75 L vs 750 mL). */
function labelUnitDiffers(a: string, b: string): boolean {
  const numA = a.match(/\d+(?:\.\d+)?/)?.[0];
  const numB = b.match(/\d+(?:\.\d+)?/)?.[0];
  return numA !== numB;
}
