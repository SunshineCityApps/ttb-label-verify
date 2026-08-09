# Test Label Manifest

Deterministic test set rendered by `generate.py` (Pillow). Each scenario maps to the
spec's "Test labels" list. Unless noted, enter the OLD TOM sample application data
(the "Fill with sample data" button): brand `OLD TOM DISTILLERY`, class/type
`Kentucky Straight Bourbon Whiskey`, alcohol `45%`, net contents `750 mL`.

| File | Scenario | Application data | Expected outcome |
|---|---|---|---|
| `01-clean-pass.png` | Everything correct | Sample | ✅ **PASS** — all five fields match (warning carries a standing note that bold/type size must be confirmed visually) |
| `02-brand-case.png` | Dave's case: label shouts `STONE'S THROW` | brand `Stone's Throw`, class `Straight Rye Whiskey`, alcohol `50%`, net `750 mL` | ⚠️ **NEEDS REVIEW** — brand matches with a capitalization note; agent makes the call |
| `03-warning-titlecase.png` | Jenny's case: `Government Warning:` in title case | Sample | ❌ **FAIL** — warning flagged: lead-in must be all caps |
| `04-abv-mismatch.png` | Label states 40% / 80 proof | Sample (45%) | ❌ **FAIL** — alcohol content mismatch (40% vs 45%) |
| `05-missing-net-contents.png` | No net contents printed | Sample | ❌ **FAIL** — net contents "not found on the label" |
| `06-skewed.png` | Clean label photographed at an angle | Sample | ✅ **PASS**, or ⚠️ **NEEDS REVIEW** with a "confirm punctuation visually" note if OCR drops punctuation on the angled photo — never a false FAIL |

Regenerate with:

```bash
pip install pillow && python3 generate.py
```
