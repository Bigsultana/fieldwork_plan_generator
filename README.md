# Fieldwork Plan Generator

Fieldwork Plan Generator is a browser-based engineering utility for turning uploaded plans, maps, cross-sections and marked-up images into a formatted A1 landscape PowerPoint fieldwork plan.

**Version:** 1.0.0  
**Status:** Browser-operational baseline  
**Owner:** Matthew Raison

## Current capability

The web application lets a user:

- enter project, client, approval and title-block information;
- upload multiple engineering images;
- automatically create and edit a sheet register;
- optionally import sheet metadata from CSV;
- optionally upload a company logo and PowerPoint template;
- generate a neutral A1 title block for every uploaded image; and
- download the completed `.pptx` directly in the browser.

Uploaded files are stored only in a temporary request directory and are deleted after the download response is sent.

## Run locally in a browser

### Windows

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup.ps1
.\scripts\run.ps1
```

Open:

```text
http://127.0.0.1:8000
```

### macOS or Linux

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
python source/main.py
```

## Run with Docker

```bash
docker build -t fieldwork-plan-generator .
docker run --rm -p 8000:8000 fieldwork-plan-generator
```

Open `http://127.0.0.1:8000`.

## Deploy to a hosted browser URL

The repository includes `render.yaml` and a production Dockerfile.

On Render:

1. Create a new Blueprint.
2. Connect this GitHub repository.
3. Render detects `render.yaml` and builds the Docker service.
4. Confirm the `/health` endpoint is healthy.

The application is also compatible with container hosts that accept a Dockerfile and provide a `PORT` environment variable.

## CSV format

CSV import is optional and is applied to selected images by row order. Supported headings are:

```csv
sheet_number,drawing_title_1,drawing_title_2,scale,revision
001,Test Location Plan,Proposed investigation locations,NTS,A
002,Site Access Plan,Access and exclusion zones,NTS,A
```

## API

- `GET /` — browser interface
- `GET /health` — deployment health check
- `POST /api/generate` — multipart PowerPoint generation endpoint
- `GET /docs` — automatically generated API documentation

## Development checks

```powershell
.\scripts\test.ps1
```

Or:

```bash
PYTHONPATH=source python -m compileall -q source tests
PYTHONPATH=source python -m unittest discover -s tests -p 'test_*.py'
```

GitHub Actions runs the automated tests and builds the Docker image for each pull request.

## Repository structure

```text
source/web_app.py             FastAPI application and upload pipeline
source/main.py                Local development server entry point
source/templates/index.html   Browser interface
source/static/                Browser JavaScript and styling
source/utils/                 PowerPoint generation and title-block engine
tests/                        Builder and browser/API tests
.github/workflows/quality.yml Continuous integration
Dockerfile                    Production container
render.yaml                   Render deployment blueprint
```

## Current limits

- Maximum 60 images per generation request.
- Maximum 35 MB per uploaded file.
- Generated output is PowerPoint only.
- Browser settings are stored in local browser storage; there is no user account or server-side project database yet.
- Hosted free-tier services may sleep between uses and may impose their own request-size or execution-time limits.

## Licence

Proprietary and confidential. See [`LICENSE`](LICENSE).
