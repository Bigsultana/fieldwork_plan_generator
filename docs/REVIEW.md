# Migration Review

## Root cause addressed

The previous repository was a FastAPI application, but Cloudflare was configured to deploy it as a normal Worker/static site. Dependency installation succeeded, then Wrangler failed because there was no static build directory or Worker entry point.

## Resolution

The application now builds to `dist/` and `wrangler.jsonc` declares that directory as the static asset collection. PowerPoint generation runs client-side, removing the need for Python, Docker or a paid container runtime.

## Validation targets

- model helper tests;
- CSV parsing and register mapping;
- duplicate sheet validation;
- real PptxGenJS generation producing a ZIP/PPTX payload;
- Vite production build; and
- Wrangler deployment dry run.
