import { describe, expect, it } from "vitest";
import { parseCsv } from "../csv";

describe("parseCsv", () => {
  it("parses a simple header + rows", () => {
    expect(parseCsv("a,b\n1,2\n3,4")).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("handles quoted fields with commas and doubled quotes", () => {
    expect(parseCsv('name,note\n"Stone\'s Throw","says ""hi"", twice"')).toEqual([
      { name: "Stone's Throw", note: 'says "hi", twice' },
    ]);
  });

  it("handles CRLF line endings and trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([{ a: "1", b: "2" }]);
  });

  it("skips blank lines and trims cells", () => {
    expect(parseCsv("a,b\n 1 , 2 \n\n")).toEqual([{ a: "1", b: "2" }]);
  });

  it("returns empty for header-only input", () => {
    expect(parseCsv("a,b\n")).toEqual([]);
  });
});
