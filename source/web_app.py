"""FastAPI browser application for Fieldwork Plan Generator."""

from __future__ import annotations

import json
import re
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.background import BackgroundTask
from starlette.datastructures import UploadFile

from utils.builder import build_fieldwork_plan
from utils.config_loader import IMAGE_EXTENSIONS, clean_project_config, validate_sheet_config

APP_ROOT = Path(__file__).resolve().parent
MAX_IMAGE_COUNT = 60
MAX_UPLOAD_BYTES = 35 * 1024 * 1024
ALLOWED_LOGO_EXTENSIONS = IMAGE_EXTENSIONS

app = FastAPI(
    title="Fieldwork Plan Generator",
    version="1.0.0",
    description="Create A1 landscape fieldwork-plan PowerPoint files from uploaded engineering images.",
)
app.mount("/static", StaticFiles(directory=APP_ROOT / "static"), name="static")
templates = Jinja2Templates(directory=APP_ROOT / "templates")


def _safe_filename(value: str, fallback: str) -> str:
    stem = Path(value or fallback).stem
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-._")
    return cleaned[:80] or fallback


async def _save_upload(
    upload: UploadFile,
    directory: Path,
    *,
    allowed_extensions: set[str],
    prefix: str,
) -> Path:
    extension = Path(upload.filename or "").suffix.lower()
    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {extension or 'unknown'}",
        )
    target = directory / f"{prefix}-{uuid.uuid4().hex}{extension}"
    size = 0
    with target.open("wb") as handle:
        while chunk := await upload.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                target.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=413,
                    detail=f"{upload.filename} exceeds the 35 MB upload limit.",
                )
            handle.write(chunk)
    await upload.close()
    return target


def _parse_json_field(raw: object, name: str, expected_type):
    try:
        value = json.loads(str(raw or ""))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {name} JSON.") from exc
    if not isinstance(value, expected_type):
        raise HTTPException(status_code=400, detail=f"{name} has the wrong data type.")
    return value


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"version": app.version},
    )


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "fieldwork-plan-generator",
        "version": app.version,
    }


@app.post("/api/generate")
async def generate(request: Request):
    form = await request.form()
    project_config = clean_project_config(
        _parse_json_field(form.get("project_config"), "project_config", dict)
    )
    sheet_rows = _parse_json_field(form.get("sheets"), "sheets", list)
    image_uploads = [
        item
        for item in form.getlist("images")
        if isinstance(item, UploadFile) and item.filename
    ]

    if not image_uploads:
        raise HTTPException(status_code=400, detail="Select at least one image.")
    if len(image_uploads) > MAX_IMAGE_COUNT:
        for upload in image_uploads:
            await upload.close()
        raise HTTPException(
            status_code=400,
            detail=f"A maximum of {MAX_IMAGE_COUNT} images can be generated at once.",
        )
    if len(sheet_rows) != len(image_uploads):
        for upload in image_uploads:
            await upload.close()
        raise HTTPException(
            status_code=400,
            detail="The sheet register does not match the uploaded image count.",
        )

    working_directory = Path(tempfile.mkdtemp(prefix="fieldwork-plan-web-"))
    try:
        saved_images: list[Path] = []
        for index, upload in enumerate(image_uploads):
            saved_images.append(
                await _save_upload(
                    upload,
                    working_directory,
                    allowed_extensions=IMAGE_EXTENSIONS,
                    prefix=f"image-{index:03d}",
                )
            )

        sheets: list[dict] = []
        for index, raw_sheet in enumerate(sheet_rows):
            if not isinstance(raw_sheet, dict):
                raise HTTPException(
                    status_code=400,
                    detail=f"Sheet row {index + 1} is invalid.",
                )
            sheet = {
                "sheet_number": str(
                    raw_sheet.get("sheet_number", f"{index + 1:03d}")
                ).strip()[:20],
                "drawing_title_1": str(
                    raw_sheet.get("drawing_title_1", "")
                ).strip()[:200],
                "drawing_title_2": str(
                    raw_sheet.get("drawing_title_2", "")
                ).strip()[:200],
                "drawing_title_3": str(
                    raw_sheet.get("drawing_title_3", "")
                ).strip()[:200],
                "scale": str(raw_sheet.get("scale", "NTS")).strip()[:40] or "NTS",
                "revision": str(raw_sheet.get("revision", "-")).strip()[:20] or "-",
                "source_path": str(saved_images[index]),
            }
            sheets.append(sheet)

        errors = validate_sheet_config(sheets)
        if errors:
            raise HTTPException(status_code=400, detail=errors)

        logo_path = None
        logo_upload = form.get("logo")
        if isinstance(logo_upload, UploadFile) and logo_upload.filename:
            logo_path = str(
                await _save_upload(
                    logo_upload,
                    working_directory,
                    allowed_extensions=ALLOWED_LOGO_EXTENSIONS,
                    prefix="logo",
                )
            )

        template_path = None
        template_upload = form.get("template")
        if isinstance(template_upload, UploadFile) and template_upload.filename:
            template_path = str(
                await _save_upload(
                    template_upload,
                    working_directory,
                    allowed_extensions={".pptx"},
                    prefix="template",
                )
            )

        output_name = (
            _safe_filename(
                project_config.get("project_title", "fieldwork-plan"),
                "fieldwork-plan",
            )
            + ".pptx"
        )
        output_path = working_directory / output_name
        result = build_fieldwork_plan(
            exports_dir=str(working_directory),
            output_path=str(output_path),
            project_config=project_config,
            sheets=sheets,
            logo_path=logo_path,
            template_path=template_path,
        )
        headers = {
            "X-Fieldwork-Slides": str(result["slides_built"]),
            "X-Fieldwork-Missing": str(len(result["missing"])),
        }
        return FileResponse(
            output_path,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            filename=output_name,
            headers=headers,
            background=BackgroundTask(
                shutil.rmtree,
                working_directory,
                ignore_errors=True,
            ),
        )
    except HTTPException:
        shutil.rmtree(working_directory, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(working_directory, ignore_errors=True)
        raise HTTPException(
            status_code=500,
            detail=f"The fieldwork plan could not be generated: {exc}",
        ) from exc


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
