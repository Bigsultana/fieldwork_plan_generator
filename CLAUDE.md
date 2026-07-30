# CLAUDE.md - Appendix Builder

> This file is read by Claude at the start of every session for this tool.
> Keep it current. Update after every significant change.

---

## Tool Identity
- **ID:** appendix-builder
- **Name:** Appendix Builder
- **Version:** 2.0.3
- **Status:** active
- **Category:** document

## What This Tool Does
This tool generates formatted PowerPoint appendix documents from engineering
data using PTG-branded templates and title-block assets. It combines Python
application logic with template-building and rendering utilities.

## Stack
- Language: Python 3.13
- Key libraries: python-pptx, PyInstaller-oriented build workflow
- Database: none obvious from migrated source
- UI: Python application entry points

## Folder Structure
```text
tools/appendix-builder/
|-- source/         # Active source files and utilities
|-- assets/         # PTG template assets used by the builder
|-- docs/           # Tool-specific docs and review history
|   `-- REVIEW.md   # Build session review log
|-- dist/           # Build spec and future packaged outputs
|-- tool-info.json  # Tool manifest
|-- README.md       # User-facing documentation
|-- CHANGELOG.md    # Version history
`-- CLAUDE.md       # This file
```

## Entry Point
```text
python source/main.py
```

## Key Design Decisions
1. Version 2 was treated as canonical and Version 1 was archived in full.
2. The PTG PowerPoint template and the title-block DXF were preserved as active assets.
3. Trial and preview image outputs were archived rather than treated as active assets.
4. The build spec was preserved in `dist/` instead of active source.

## Known Issues / Limitations
- The source root contains extra non-migrated files that may need later review.
- Path and dependency audits are still pending.
- No deeper runtime verification has been performed yet in this migration phase.
- Runtime build smoke test now passes from the migrated workspace after fixing default bundled asset path resolution.
- A lightweight automated smoke test now covers the core PowerPoint build path.
- The current `source/` tree now passes the harness flake8 gate.

## Current Backlog
- Confirm the PowerPoint generation workflow runs from the new harness location
- Audit any hardcoded asset/template paths
- Review the odd brace-named folder pattern during cleanup

## Session History Summary
- [2026-04-14] v2.0.0: Migrated Version 2 into the harness and archived Version 1 plus test assets.
- [2026-04-29] v2.0.1: Verified migrated runtime with a smoke test and fixed bundled asset path resolution for relocated launches.
- [2026-04-29] v2.0.2: Added an automated smoke test for the migrated build pipeline.
- [2026-04-29] v2.0.3: Fixed inherited flake8 failures in the active source tree.

## Integration Points
- `_infrastructure/access/check-access.py` - no, owner-only currently
- `_infrastructure/logs/activity-logger.py` - no, not yet integrated
- Other tools: may share themes with other map/document-generation tools

## DO NOT
- Do not mix archived preview/test images back into active assets without a clear need
- Do not remove the PTG template assets from `assets/`
- Do not change source logic during migration-only sessions
