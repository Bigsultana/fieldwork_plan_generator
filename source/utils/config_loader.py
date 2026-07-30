"""Project configuration, sheet-list and image-discovery utilities."""

import csv
import json
import os
from datetime import date

SOURCE_DIR = os.path.dirname(os.path.abspath(__file__))
TOOL_ROOT = os.path.dirname(os.path.dirname(SOURCE_DIR))

STANDARD_SHEETS = [
    {
        "sheet_number": "001",
        "drawing_title_1": "Test Location Plan",
        "drawing_title_2": "",
        "drawing_title_3": "",
        "filename_pattern": "test_location_plan",
        "scale": "NTS",
    },
    {
        "sheet_number": "002",
        "drawing_title_1": "Cross Section",
        "drawing_title_2": "A - A'",
        "drawing_title_3": "",
        "filename_pattern": "cross_section_AA",
        "scale": "NTS",
    },
]

IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"]


def get_tool_path(*parts: str) -> str:
    return os.path.join(TOOL_ROOT, *parts)


def default_project_config() -> dict:
    return {
        "project_title": "PROJECT TITLE",
        "project_address": "",
        "project_number": "",
        "client_name": "",
        "drawn_by": "",
        "designed_by": "",
        "approved_by": "",
        "date": date.today().strftime("%d.%m.%y"),
        "drawing_status": "FOR INFORMATION",
        "sheet_prefix": "A",
        "logo_path": "",
        "template_path": "",
        "company_name": "COMPANY NAME",
        "company_address": "",
        "company_phone": "",
        "company_email": "",
        "company_website": "",
    }


def load_project_config(config_path: str) -> dict:
    config = default_project_config()
    if config_path and os.path.isfile(config_path):
        with open(config_path, "r", encoding="utf-8-sig") as handle:
            loaded = json.load(handle)
        if not isinstance(loaded, dict):
            raise ValueError("Project configuration must contain a JSON object.")
        config.update(loaded)
    return config


def resolve_optional_path(base_file_path: str, candidate_path: str) -> str:
    if not candidate_path:
        return ""
    if os.path.isabs(candidate_path):
        return os.path.normpath(candidate_path)
    if base_file_path:
        base_dir = os.path.dirname(os.path.abspath(base_file_path))
        return os.path.abspath(os.path.join(base_dir, candidate_path))
    return os.path.abspath(candidate_path)


def load_sheet_config(csv_path: str) -> list:
    if not csv_path:
        return [dict(sheet) for sheet in STANDARD_SHEETS]
    if not os.path.isfile(csv_path):
        raise FileNotFoundError(f"Sheet CSV not found: {csv_path}")

    sheets = []
    with open(csv_path, newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for index, row in enumerate(reader, 1):
            sheets.append(
                {
                    "sheet_number": (
                        row.get("sheet_number") or f"{index:03d}"
                    ).strip(),
                    "drawing_title_1": (
                        row.get("drawing_title_1") or ""
                    ).strip(),
                    "drawing_title_2": (
                        row.get("drawing_title_2") or ""
                    ).strip(),
                    "drawing_title_3": (
                        row.get("drawing_title_3") or ""
                    ).strip(),
                    "filename_pattern": (
                        row.get("filename_pattern") or ""
                    ).strip(),
                    "scale": (row.get("scale") or "NTS").strip(),
                }
            )
    return sheets


def list_images_in_order(exports_dir: str) -> list[str]:
    if not exports_dir or not os.path.isdir(exports_dir):
        return []
    images = []
    for filename in sorted(os.listdir(exports_dir), key=str.lower):
        path = os.path.join(exports_dir, filename)
        if (
            os.path.isfile(path)
            and os.path.splitext(filename)[1].lower() in IMAGE_EXTENSIONS
        ):
            images.append(path)
    return images


def _sheet_from_path(image_path: str, index: int) -> dict:
    stem = os.path.splitext(os.path.basename(image_path))[0]
    title = stem.replace("_", " ").replace("-", " ").strip().title()
    return {
        "sheet_number": f"{index:03d}",
        "drawing_title_1": title or f"Image {index:03d}",
        "drawing_title_2": "",
        "drawing_title_3": "",
        "filename_pattern": stem,
        "scale": "NTS",
        "source_path": image_path,
    }


def build_sheets_from_images(
    exports_dir: str, sheet_prefix: str = "A"
) -> list:
    del sheet_prefix
    return [
        _sheet_from_path(path, index)
        for index, path in enumerate(list_images_in_order(exports_dir), 1)
    ]


def build_sheets_from_image_paths(image_paths: list[str]) -> list:
    return [
        _sheet_from_path(path, index)
        for index, path in enumerate(image_paths, 1)
    ]


def validate_sheet_config(sheets: list) -> list[str]:
    errors = []
    numbers = set()
    patterns = set()
    for index, sheet in enumerate(sheets, 1):
        number = str(sheet.get("sheet_number", "")).strip()
        title = str(sheet.get("drawing_title_1", "")).strip()
        pattern = str(sheet.get("filename_pattern", "")).strip().lower()
        source_path = str(sheet.get("source_path", "")).strip()

        if not number:
            errors.append(f"Row {index}: sheet_number is required.")
        elif number in numbers:
            errors.append(
                f"Row {index}: duplicate sheet_number '{number}'."
            )
        else:
            numbers.add(number)

        if not title:
            errors.append(f"Row {index}: drawing_title_1 is required.")

        if pattern:
            if pattern in patterns:
                errors.append(
                    f"Row {index}: duplicate filename_pattern '{pattern}'."
                )
            patterns.add(pattern)
        elif not source_path:
            errors.append(
                f"Row {index}: filename_pattern or source_path is required."
            )
    return errors


def find_image(exports_dir: str, pattern: str) -> str | None:
    if not exports_dir or not pattern or not os.path.isdir(exports_dir):
        return None
    target = pattern.lower()
    for filename in os.listdir(exports_dir):
        stem, extension = os.path.splitext(filename)
        if extension.lower() in IMAGE_EXTENSIONS and stem.lower() == target:
            return os.path.join(exports_dir, filename)
    return None


def save_default_config(output_path: str):
    config = default_project_config()
    config["project_title"] = "Enter Project Title"
    config["project_address"] = "Enter Site Address"
    config["project_number"] = "PROJECT-YYYY-XXX"
    config["client_name"] = "Enter Client Name"
    config["drawn_by"] = "XX"
    config["designed_by"] = "XX"
    config["approved_by"] = "XX"
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(config, handle, indent=2)


def save_default_sheet_csv(output_path: str):
    fieldnames = [
        "sheet_number",
        "drawing_title_1",
        "drawing_title_2",
        "drawing_title_3",
        "filename_pattern",
        "scale",
    ]
    with open(output_path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for sheet in STANDARD_SHEETS:
            writer.writerow(sheet)
