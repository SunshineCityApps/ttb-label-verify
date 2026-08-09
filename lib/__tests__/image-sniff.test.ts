import { describe, expect, it } from "vitest";
import { sniffImageType } from "../image-sniff";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])),
  );

describe("sniffImageType", () => {
  it("identifies JPEG magic bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
  });

  it("identifies PNG magic bytes", () => {
    expect(sniffImageType(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
  });

  it("identifies WebP (RIFF....WEBP)", () => {
    expect(sniffImageType(bytes("RIFF", 0, 0, 0, 0, "WEBP"))).toBe("image/webp");
  });

  it("rejects a PDF renamed to .jpg", () => {
    expect(sniffImageType(bytes("%PDF-1.4"))).toBeNull();
  });

  it("rejects GIF (unsupported format)", () => {
    expect(sniffImageType(bytes("GIF89a"))).toBeNull();
  });

  it("rejects plain text and empty input", () => {
    expect(sniffImageType(bytes("not an image"))).toBeNull();
    expect(sniffImageType(new Uint8Array(0))).toBeNull();
  });
});
