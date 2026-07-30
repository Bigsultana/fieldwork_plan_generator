# Tool Review — Appendix Builder 2.1.0

**Date:** 30 July 2026  
**Scope:** Neutral baseline hardening

## What changed

The application was converted from a company-specific internal presentation tool into a neutral Appendix Builder. Corporate defaults and bundled assets were removed. The title-block renderer was replaced with a generic layout, and setup, testing and packaging instructions were made repository-relative.

## What works well

- Presentation generation is separated from the GUI.
- Company identity is provided through configuration rather than source defaults.
- Missing images produce visible placeholders.
- Images retain their aspect ratio.
- Output is written through a temporary file before replacement.
- Tests use isolated temporary directories.

## Remaining risks

- The presentation builder still uses a private python-pptx slide-list interface when clearing template slides.
- The GUI does not yet have automated interaction tests.
- The packaged executable has not yet been verified on a clean Windows workstation.
- The repository name remains inconsistent with the application name.

## Validation completed

- Python source compilation passed.
- Two automated tests passed, including presentation generation and duplicate sheet-number validation.
- Formatting and lint tools were unavailable in the execution environment and must be run through `scripts/test.ps1` on Windows before release.
