"""Configuration, sheet validation and image-discovery utilities."""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp"}

PROJECT_FIELDS = {
    "project_title",
    "project_address",
    "project_number",
    "client_name",
    "drawn_by",
    "designed_by",
    "approved_by",
    "date",
    "drawing_status",
    "sheet_prefix",
    "company_name",
    "company_address",
    "company_phone",
    "company_email",
    "company_website",
}


def default_project_config() -> dict[str, str]:
    return {
        "project_title": "FIELDWORK PLAN",
        "project_address": "",
        "project_number": "",
        "client_name": "",
        "drawn_by": "",
        "designed_by": "",
        "approved_by": "",
        "date": date.today().strftime("%d.%m.%y"),
        "drawing_status": "FOR INFORMATION",
        "sheet_prefix": "F",
        "company_name": "COMPANY NAME",
        "company_address": "",
        "company_phone": "",
        "company_email": "",
        "company_website": "",
    }


def clean_project_config(raw: dict | None) -> dict[str, str]:
    config = default_project_config()
    for key, value in (raw or {}).items():
        if key in PROJECT_FIELDS:
            config[key] = str(value or "").strip()[:500]
    return config


def validate_sheet_config(sheets: list[dict]) -> list[str]:
    errors: list[str] = []
    numbers: set[str] = set()
    for index, sheet in enumerate(sheets, 1):
        number = str(sheet.get("sheet_number", "")).strip()
        title = str(sheet.get("drawing_title_1", "")).strip()
        source_path = str(sheet.get("source_path", "")).strip()
        if not number:
            errors.append(f"Row {index}: sheet number is required.")
        elif number in numbers:
            errors.append(f"Row {index}: duplicate sheet number '{number}'.")
        else:
            numbers.add(number)
        if not title:
            errors.append(f"Row {index}: drawing title is required.")
        if not source_path:
            errors.append(f"Row {index}: an image is required.")
    return errors


def find_image(exports_dir: str, pattern: str) -> str | None:
    if not exports_dir or not pattern or not os.path.isdir(exports_dir):
        return None
    target = pattern.casefold()
    for path in Path(exports_dir).iterdir():
        if (
            path.is_file()
            and path.suffix.lower() in IMAGE_EXTENSIONS
            and path.stem.casefold() == target
        ):
            return str(path)
    return None
