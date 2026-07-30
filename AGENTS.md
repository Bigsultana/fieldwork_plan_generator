# AGENTS.md - Appendix Builder

> This file is read by Codex at the start of every execution session.
> It defines Codex's role, constraints, and behaviour for this tool.

---

## Codex Role For This Tool
Codex is the **implementation agent** for Appendix Builder.
Claude handles architecture, planning, and review.
Codex handles file creation, code writing, and execution.

## Workspace Constraints (Non-Negotiable)
- Root: `E:\Home Folder`
- Stay within `E:\Home Folder` at all times
- Python: `& "E:\Home Folder\_local\python-venv\Scripts\python.exe"`
- Pip: `& "E:\Home Folder\_local\python-venv\Scripts\pip.exe"`
- No system-wide installs
- Local Git only

## Tool Location
`E:\Home Folder\tools\appendix-builder\`

## Source Of Truth
Before modifying any file, read:
1. `tools/appendix-builder/CLAUDE.md` - design decisions and constraints
2. `tools/appendix-builder/tool-info.json` - current version and status
3. `tools/appendix-builder/CHANGELOG.md` - what has changed

## Quality Gates (Must Pass Before Reporting Complete)
```powershell
# Run these from E:\Home Folder
& "E:\Home Folder\_local\python-venv\Scripts\black.exe" tools/appendix-builder/source/
& "E:\Home Folder\_local\python-venv\Scripts\flake8.exe" tools/appendix-builder/source/ --max-line-length=120 --jobs 1
& "E:\Home Folder\_local\python-venv\Scripts\python.exe" _utilities/validate-tool-list.py
```

## Commit Convention
```text
git add tools/appendix-builder/
git commit -m "[type](appendix-builder): [short description]"
```

Commit types: `feat` `fix` `refactor` `chore` `migrate` `release`

## Files Codex Must Update After Every Session
- `tools/appendix-builder/tool-info.json` - bump version if code changed
- `tools/appendix-builder/CHANGELOG.md` - add entry for this session
- `tools/appendix-builder/docs/REVIEW.md` - add self-critique entry
- Run `_utilities/rebuild-tool-list.py` after any tool-info.json change

## Hard Constraints - Never Do These
- Never delete files - move to `_retired/` instead
- Never commit `.env.secrets` or `users.db`
- Never commit `.orig` files - they are legacy manual versioning
- Never install packages system-wide
- Never modify files outside `E:\Home Folder`
- Never proceed past a sign-off gate without explicit owner approval
