#!/usr/bin/env python3
"""Render the deterministic test-label set from the project spec.

Usage: python3 generate.py  (requires Pillow)

Each label maps to a scenario in AGENTS.md -> "Test labels". Labels are drawn
programmatically so expected values are exact and the suite is reproducible
without AI image generation.
"""

from PIL import Image, ImageDraw, ImageFont
import textwrap

WIDTH, HEIGHT = 900, 1200
CREAM = (244, 238, 224)
INK = (40, 30, 20)
GOLD = (150, 110, 40)

CANONICAL_WARNING = (
    "GOVERNMENT WARNING: (1) According to the Surgeon General, women should "
    "not drink alcoholic beverages during pregnancy because of the risk of "
    "birth defects. (2) Consumption of alcoholic beverages impairs your "
    "ability to drive a car or operate machinery, and may cause health "
    "problems."
)


def font(size, bold=False):
    names = (
        ["/System/Library/Fonts/Supplemental/Georgia Bold.ttf", "/System/Library/Fonts/Helvetica.ttc"]
        if bold
        else ["/System/Library/Fonts/Supplemental/Georgia.ttf", "/System/Library/Fonts/Helvetica.ttc"]
    )
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default(size)


def draw_label(brand, class_type, abv, net_contents, warning, out_path):
    img = Image.new("RGB", (WIDTH, HEIGHT), CREAM)
    d = ImageDraw.Draw(img)

    d.rectangle([30, 30, WIDTH - 30, HEIGHT - 30], outline=GOLD, width=6)
    d.rectangle([45, 45, WIDTH - 45, HEIGHT - 45], outline=GOLD, width=2)

    def centered(text, y, f, fill=INK):
        w = d.textlength(text, font=f)
        d.text(((WIDTH - w) / 2, y), text, font=f, fill=fill)

    y = 130
    for line in textwrap.wrap(brand, 16):
        centered(line, y, font(72, bold=True))
        y += 90

    d.line([200, y + 20, WIDTH - 200, y + 20], fill=GOLD, width=3)
    y += 60

    for line in textwrap.wrap(class_type, 26):
        centered(line, y, font(44))
        y += 58

    y += 40
    if abv:
        centered(abv, y, font(40))
        y += 70
    if net_contents:
        centered(net_contents, y, font(40))
        y += 70

    if warning:
        warning_font = font(24, bold=True)
        max_width = WIDTH - 160
        lines, current = [], ""
        for word in warning.split():
            candidate = f"{current} {word}".strip()
            if d.textlength(candidate, font=warning_font) <= max_width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)

        wy = HEIGHT - 90 - 34 * len(lines)
        d.line([80, wy - 20, WIDTH - 80, wy - 20], fill=INK, width=2)
        for line in lines:
            d.text((80, wy), line, font=warning_font, fill=INK)
            wy += 34

    img.save(out_path)
    print(f"wrote {out_path}")


# 1. Clean pass — the OLD TOM DISTILLERY sample, everything correct
draw_label(
    "OLD TOM DISTILLERY",
    "Kentucky Straight Bourbon Whiskey",
    "45% Alc./Vol. (90 Proof)",
    "750 mL",
    CANONICAL_WARNING,
    "01-clean-pass.png",
)

# 2. Case mismatch — label shouts, application says "Stone's Throw" -> expect amber note
draw_label(
    "STONE'S THROW",
    "Straight Rye Whiskey",
    "50% Alc./Vol. (100 Proof)",
    "750 mL",
    CANONICAL_WARNING,
    "02-brand-case.png",
)

# 3. Warning violation — "Government Warning:" in title case -> expect fail on warning
draw_label(
    "OLD TOM DISTILLERY",
    "Kentucky Straight Bourbon Whiskey",
    "45% Alc./Vol. (90 Proof)",
    "750 mL",
    CANONICAL_WARNING.replace("GOVERNMENT WARNING:", "Government Warning:"),
    "03-warning-titlecase.png",
)

# 4. ABV mismatch — label says 40%, application says 45% -> expect fail on alcohol content
draw_label(
    "OLD TOM DISTILLERY",
    "Kentucky Straight Bourbon Whiskey",
    "40% Alc./Vol. (80 Proof)",
    "750 mL",
    CANONICAL_WARNING,
    "04-abv-mismatch.png",
)

# 5. Missing field — no net contents on the label -> expect fail "not found"
draw_label(
    "OLD TOM DISTILLERY",
    "Kentucky Straight Bourbon Whiskey",
    "45% Alc./Vol. (90 Proof)",
    None,
    CANONICAL_WARNING,
    "05-missing-net-contents.png",
)

# 6. Skewed photo of the clean label -> expect pass (imperfect-image handling)
clean = Image.open("01-clean-pass.png").convert("RGBA")
rotated = clean.rotate(12, expand=True, fillcolor=(90, 85, 80, 255))
background = Image.new("RGB", rotated.size, (90, 85, 80))
background.paste(rotated, mask=rotated)
background.save("06-skewed.png")
print("wrote 06-skewed.png")
