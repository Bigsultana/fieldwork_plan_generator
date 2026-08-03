# Fieldwork Plan Generator

Fieldwork Plan Generator is a privacy-first browser application for turning plans, maps, sections and marked-up images into a formatted A1 landscape PowerPoint fieldwork plan.

**Version:** 2.0.0  
**Runtime:** Cloudflare static assets / modern browser  
**Owner:** Matthew Raison

## What it does

- accepts multiple PNG, JPEG, WebP, BMP and TIFF files;
- creates an editable sheet register from the selected images;
- imports optional sheet metadata from CSV;
- collects project, client, approval and company information;
- accepts an optional company logo;
- preserves image aspect ratio inside an A1 drawing frame;
- creates a neutral, editable title block on every slide;
- adds a visible placeholder when an image cannot be decoded;
- generates and downloads the `.pptx` entirely in the browser; and
- imports and exports reusable title-block profiles as JSON.

The selected drawings are never uploaded to an application server. Image conversion and PowerPoint generation run locally in the user's browser.

## Cloudflare deployment

The repository is configured for Cloudflare Workers static assets. Cloudflare's GitHub integration can build and deploy the connected branch using:

```text
Deploy command: npx wrangler deploy
```

`wrangler.jsonc` runs `npm run build` before deployment and publishes the generated `dist/` directory.

## Local setup

Requirements:

- Node.js 22.12 or newer
- npm

```powershell
.\scripts\setup.ps1
.\scripts\run.ps1
```

Open the URL printed by Vite, normally `http://localhost:5173`.

## Tests and production build

```powershell
.\scripts\test.ps1
```

Or directly:

```bash
npm install
npm test
npm run build
npx wrangler deploy --dry-run
```

## CSV format

CSV rows are applied to selected images by register order.

```csv
sheet_number,drawing_title_1,drawing_title_2,drawing_title_3,scale,revision
001,Test Location Plan,Proposed investigation locations,,NTS,A
002,Site Access Plan,Access and exclusion zones,,1:500,A
```

## Template profiles

Version 2 replaces arbitrary `.pptx` template ingestion with explicit title-block profiles. A profile stores company information, project defaults, figure prefix and accent colour in a small JSON file. This keeps the presentation layout predictable and allows the app to remain fully client-side.

## Privacy and limits

- Up to 60 images can be held in one browser session.
- Large source images can use significant browser memory while the PowerPoint is generated.
- Project defaults saved in the browser use local storage on the current device.
- No application database or upload API is used.

## Licence

Proprietary and confidential. See [`LICENSE`](LICENSE). Third-party packages remain subject to their own licences.
