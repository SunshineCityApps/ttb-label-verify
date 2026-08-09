import { describe, expect, it } from "vitest";
import { compareAlcoholContent, parseAlcoholContent } from "../alcohol-content";
import { CANONICAL_WARNING, compareGovernmentWarning } from "../government-warning";
import { compareNetContents, parseNetContents } from "../net-contents";
import { compareTextField } from "../text-fields";
import { verifyLabel } from "../index";
import type { ApplicationData, ExtractedLabel } from "../types";

describe("compareTextField (brand name / class-type)", () => {
  it("exact match passes", () => {
    const r = compareTextField("brandName", "OLD TOM DISTILLERY", "OLD TOM DISTILLERY");
    expect(r.status).toBe("match");
  });

  it("Dave's STONE'S THROW case: same content, different capitalization → match with note", () => {
    const r = compareTextField("brandName", "STONE'S THROW", "Stone's Throw");
    expect(r.status).toBe("match_with_note");
    expect(r.note).toContain("capitalization");
  });

  it("curly vs straight apostrophes are a formatting note, not a mismatch", () => {
    const r = compareTextField("brandName", "STONE’S THROW", "STONE'S THROW");
    expect(r.status).toBe("match_with_note");
  });

  it("different brand names are a mismatch", () => {
    const r = compareTextField("brandName", "OLD TOM DISTILLERY", "OLD THOMAS DISTILLERY");
    expect(r.status).toBe("mismatch");
  });

  it("missing field is a mismatch with 'not found' note", () => {
    const r = compareTextField("classType", null, "Kentucky Straight Bourbon Whiskey");
    expect(r.status).toBe("mismatch");
    expect(r.note).toContain("Not found");
  });

  it("whitespace differences alone still count as an exact match", () => {
    const r = compareTextField("brandName", "  OLD TOM   DISTILLERY ", "OLD TOM DISTILLERY");
    expect(r.status).toBe("match");
  });
});

describe("parseAlcoholContent", () => {
  it("reads ABV and proof from the sample label format", () => {
    expect(parseAlcoholContent("45% Alc./Vol. (90 Proof)")).toEqual({ abv: 45, proof: 90 });
  });

  it("reads a bare percentage", () => {
    expect(parseAlcoholContent("45%")).toEqual({ abv: 45, proof: null });
  });

  it("reads decimal ABVs", () => {
    expect(parseAlcoholContent("13.5% Alc. by Vol.")).toEqual({ abv: 13.5, proof: null });
  });

  it("returns null when no percentage is present", () => {
    expect(parseAlcoholContent("ninety proof")).toBeNull();
  });
});

describe("compareAlcoholContent", () => {
  it("matches equal ABVs across formats", () => {
    expect(compareAlcoholContent("45% Alc./Vol. (90 Proof)", "45%").status).toBe("match");
  });

  it("flags an ABV mismatch (label 40% vs application 45%)", () => {
    const r = compareAlcoholContent("40% Alc./Vol.", "45%");
    expect(r.status).toBe("mismatch");
    expect(r.note).toContain("40");
    expect(r.note).toContain("45");
  });

  it("flags an internally inconsistent proof even when ABV matches", () => {
    const r = compareAlcoholContent("45% Alc./Vol. (80 Proof)", "45%");
    expect(r.status).toBe("mismatch");
    expect(r.note).toContain("proof");
  });

  it("missing alcohol content is a mismatch", () => {
    expect(compareAlcoholContent(null, "45%").status).toBe("mismatch");
  });
});

describe("parseNetContents", () => {
  it("parses metric volumes in any casing", () => {
    expect(parseNetContents("750 mL")).toEqual({ quantity: 750, system: "metric", unit: "mL" });
    expect(parseNetContents("750ml")).toEqual({ quantity: 750, system: "metric", unit: "mL" });
    expect(parseNetContents("750 ML")).toEqual({ quantity: 750, system: "metric", unit: "mL" });
  });

  it("converts liters to milliliters", () => {
    expect(parseNetContents("0.75 L")?.quantity).toBe(750);
  });

  it("parses US fluid ounces", () => {
    expect(parseNetContents("12 FL. OZ.")).toEqual({ quantity: 12, system: "us", unit: "fl oz" });
  });
});

describe("compareNetContents", () => {
  it("'750 mL' vs '750ml' vs '750 ML' all match", () => {
    expect(compareNetContents("750 mL", "750ml").status).toBe("match");
    expect(compareNetContents("750 ML", "750 mL").status).toBe("match");
  });

  it("same volume in different units matches with a note", () => {
    const r = compareNetContents("0.75 L", "750 mL");
    expect(r.status).toBe("match_with_note");
  });

  it("different volumes are a mismatch", () => {
    expect(compareNetContents("700 mL", "750 mL").status).toBe("mismatch");
  });

  it("cross-system units are flagged for manual verification, never converted", () => {
    const r = compareNetContents("25.4 FL OZ", "750 mL");
    expect(r.status).toBe("mismatch");
    expect(r.note).toContain("manually");
  });

  it("missing net contents is a mismatch with 'not found' note", () => {
    const r = compareNetContents(null, "750 mL");
    expect(r.status).toBe("mismatch");
    expect(r.note).toContain("Not found");
  });
});

describe("compareGovernmentWarning", () => {
  it("the exact statutory text matches, with a standing note about bold/size", () => {
    const r = compareGovernmentWarning(CANONICAL_WARNING);
    expect(r.status).toBe("match");
    expect(r.note).toContain("Bold");
  });

  it("forgives line breaks introduced by reading a wrapped paragraph", () => {
    const wrapped = CANONICAL_WARNING.replace("According to", "According\nto");
    expect(compareGovernmentWarning(wrapped).status).toBe("match");
  });

  it("Jenny's case: 'Government Warning' in title case is a violation", () => {
    const titleCase = CANONICAL_WARNING.replace("GOVERNMENT WARNING:", "Government Warning:");
    const r = compareGovernmentWarning(titleCase);
    expect(r.status).toBe("mismatch");
    expect(r.note).toContain("all caps");
  });

  it("reworded text is a violation, pinpointing the first deviation", () => {
    const reworded = CANONICAL_WARNING.replace("birth defects", "health issues");
    const r = compareGovernmentWarning(reworded);
    expect(r.status).toBe("mismatch");
    expect(r.note).toContain("First difference");
  });

  it("a truncated warning is a violation", () => {
    const truncated = CANONICAL_WARNING.slice(0, 120);
    expect(compareGovernmentWarning(truncated).status).toBe("mismatch");
  });

  it("a missing warning is a violation", () => {
    const r = compareGovernmentWarning(null);
    expect(r.status).toBe("mismatch");
    expect(r.note).toContain("mandatory");
  });
});

describe("verifyLabel (end-to-end verdicts)", () => {
  const application: ApplicationData = {
    brandName: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    alcoholContent: "45%",
    netContents: "750 mL",
  };

  const cleanLabel: ExtractedLabel = {
    brandName: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    alcoholContent: "45% Alc./Vol. (90 Proof)",
    netContents: "750 mL",
    governmentWarningText: CANONICAL_WARNING,
  };

  it("a clean label passes overall", () => {
    expect(verifyLabel(cleanLabel, application).overall).toBe("pass");
  });

  it("a formatting-only difference yields needs_review", () => {
    const label = { ...cleanLabel, brandName: "Old Tom Distillery" };
    expect(verifyLabel(label, application).overall).toBe("needs_review");
  });

  it("any hard mismatch yields fail", () => {
    const label = { ...cleanLabel, alcoholContent: "40% Alc./Vol." };
    expect(verifyLabel(label, application).overall).toBe("fail");
  });

  it("returns one result per field, warning included", () => {
    const result = verifyLabel(cleanLabel, application);
    expect(result.fields.map((f) => f.field)).toEqual([
      "brandName",
      "classType",
      "alcoholContent",
      "netContents",
      "governmentWarning",
    ]);
  });
});
