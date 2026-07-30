# Repository Baseline

**Baseline date:** 30 July 2026  
**Application:** Appendix Builder  
**Application version:** 2.1.0  
**Repository name:** `fieldwork_plan_generator`

## Current intent

Appendix Builder is a Windows desktop application that converts selected engineering images into an A1 landscape PowerPoint appendix. It collects project and title-block information, builds a sheet register and generates slides using a neutral title block.

## Neutrality requirements

The active application baseline contains no assumed company identity. In particular:

- company details are user inputs;
- default company contact fields are blank;
- the built-in title block is generic;
- no company logo is bundled;
- no corporate PowerPoint template or drawing file is bundled; and
- packaging and documentation use only the `Appendix Builder` name.

## Repository naming

The repository name does not currently match the contained application. The owner may later rename the repository or expand its scope, but that decision does not affect the neutral application baseline.

## Baseline acceptance criteria

- A clean clone can be set up using `scripts/setup.ps1`.
- The application launches using `scripts/run.ps1`.
- Tests use temporary files and leave no generated output in the repository.
- The application can generate a one-slide presentation without a bundled template.
- Company details and logos remain configurable rather than hard-coded.
