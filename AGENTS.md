# AGENTS.md

## Product

Fieldwork Plan Generator is a client-side browser application deployed as Cloudflare static assets.

## Architecture rules

- Keep engineering drawings in browser memory; do not add server uploads without explicit approval.
- Keep PowerPoint generation in `src/presentation.js`.
- Keep parsing, validation and geometry helpers in `src/model.js`.
- Preserve the A1 landscape dimensions and title-block geometry unless a design change is requested.
- New dependencies must be browser-compatible and pinned to an exact version.
- Do not commit `dist/`, `node_modules/`, credentials or Cloudflare account identifiers.

## Required checks

```bash
npm install
npm test
npm run build
npx wrangler deploy --dry-run
```

## Git workflow

Use `agent/<description>` branches and pull requests. Do not push feature work directly to `main`.
