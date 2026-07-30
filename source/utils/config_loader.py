"""
Standard sheet definitions and project config loader.
"""

import csv
import json
import os
from datetime import date

SOURCE_DIR = os.path.dirname(os.path.abspath(__file__))
TOOL_ROOT = os.path.dirname(os.path.dirname(SOURCE_DIR))


# ── Standard appendix sheets ─────────────────────────────────────────────────
# Each entry defines a sheet that typically appears in a PTG geotechnical report.
# 'filename_pattern' is the expected image filename (no extension).
# The script will search /exports/ for files matching this pattern + any image ext.

STANDARD_SHEETS = [
    {
        "sheet_number": "001",
        "drawing_title_1": "Test Location Plan",
        "filename_pattern": "test_location_plan",
        "scale": "NTS",
    },
    {
        "sheet_number": "002",
        "drawing_title_1": "Cross Section",
        "drawing_title_2": "A - A'",
        "filename_pattern": "cross_section_AA",
        "scale": "NTS",
    },
    {
        "sheet_number": "003",
        "drawing_title_1": "Cross Section",
        "drawing_title_2": "B - B'",
        "filename_pattern": "cross_section_BB",
        "scale": "NTS",
    },
]

IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"]


def get_tool_path(*parts: str) -> str:
    """Return an absolute path inside the appendix-builder tool root."""
    return os.path.join(TOOL_ROOT, *parts)


def load_project_config(config_path: str) -> dict:
    """Load project-level fields from a JSON config file."""
    defaults = {
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
        "company_name": "PTG CONSULTING",
        "company_address": "Level 3, 159 Coronation Drive (CNR Cribb St), Milton QLD 4064",
        "company_phone": "(07) 3444 6666",
        "company_email": "admin@ptgconsulting.com.au",
        "company_website": "www.ptgconsulting.com.au",
    }
    if config_path and os.path.isfile(config_path):
        with open(config_path, "r", encoding="utf-8-sig") as f:
            loaded = json.load(f)
        defaults.update(loaded)
    return defaults


def resolve_optional_path(base_file_path: str, candidate_path: str) -> str:
    """
    Resolve a possibly relative path against the config file location.
    Returns the original empty value if no path was provided.
    """
    if not candidate_path:
        return ""
    if os.path.isabs(candidate_path):
        return candidate_path
    normalized = os.path.normpath(candidate_path)
    if normalized.startswith("assets" + os.sep) or normalized == "assets":
        return get_tool_path(*normalized.split(os.sep))
    if base_file_path:
        base_dir = os.path.dirname(os.path.abspath(base_file_path))
        return os.path.abspath(os.path.join(base_dir, candidate_path))
    return os.path.abspath(candidate_path)


def load_sheet_config(csv_path: str) -> list:
    """
    Load sheet list from a CSV file.
    Expected columns: sheet_number, drawing_title_1, drawing_title_2,
                      drawing_title_3, filename_pattern, scale
    Returns list of dicts. Falls back to STANDARD_SHEETS if file not found.
    """
    if not csv_path or not os.path.isfile(csv_path):
        return [dict(s) for s in STANDARD_SHEETS]

    sheets = []
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, 1):
            sheet = {
                "sheet_number": row.get("sheet_number", f"{i:03d}").strip(),
                "drawing_title_1": row.get("drawing_title_1", "").strip(),
                "drawing_title_2": row.get("drawing_title_2", "").strip(),
                "drawing_title_3": row.get("drawing_title_3", "").strip(),
                "filename_pattern": row.get("filename_pattern", "").strip(),
                "scale": row.get("scale", "NTS").strip(),
            }
            sheets.append(sheet)
    return sheets


def list_images_in_order(exports_dir: str) -> list:
    """Return supported image paths from a folder, sorted by filename."""
    if not exports_dir or not os.path.isdir(exports_dir):
        return []

    image_paths = []
    for fname in sorted(os.listdir(exports_dir), key=str.lower):
        full_path = os.path.join(exports_dir, fname)
        if not os.path.isfile(full_path):
            continue
        stem, ext = os.path.splitext(fname)
        if ext.lower() in IMAGE_EXTENSIONS:
            image_paths.append(full_path)
    return image_paths


def build_sheets_from_images(exports_dir: str, sheet_prefix: str = "A") -> list:
    """
    Build a simple sheet list from images found in folder order.
    Titles are derived from filenames.
    """
    sheets = []
    for index, image_path in enumerate(list_images_in_order(exports_dir), 1):
        stem = os.path.splitext(os.path.basename(image_path))[0]
        title = stem.replace("_", " ").replace("-", " ").strip().title()
        sheets.append(
            {
                "sheet_number": f"{index:03d}",
                "drawing_title_1": title or f"Image {index:03d}",
                "drawing_title_2": "",
                "drawing_title_3": "",
                "filename_pattern": stem,
                "scale": "NTS",
            }
        )
    return sheets


def build_sheets_from_image_paths(image_paths: list[str]) -> list:
    """
    Build a sheet list from explicit image paths.
    The source path is preserved so the builder can use the chosen file directly.
    """
    sheets = []
    for index, image_path in enumerate(image_paths, 1):
        stem = os.path.splitext(os.path.basename(image_path))[0]
        title = stem.replace("_", " ").replace("-", " ").strip().title()
        sheets.append(
            {
                "sheet_number": f"{index:03d}",
                "drawing_title_1": title or f"Image {index:03d}",
                "drawing_title_2": "",
                "drawing_title_3": "",
                "filename_pattern": stem,
                "scale": "NTS",
                "source_path": image_path,
            }
        )
    return sheets


def validate_sheet_config(sheets: list) -> list:
    """Return a list of validation error strings for sheet rows."""
    errors = []
    seen_numbers = set()
    seen_patterns = set()

    for index, sheet in enumerate(sheets, 1):
        number = sheet.get("sheet_number", "").strip()
        title = sheet.get("drawing_title_1", "").strip()
        pattern = sheet.get("filename_pattern", "").strip().lower()

        if not number:
            errors.append(f"Row {index}: sheet_number is required.")
        elif number in seen_numbers:
            errors.append(f"Row {index}: duplicate sheet_number '{number}'.")
        else:
            seen_numbers.add(number)

        if not title:
            errors.append(f"Row {index}: drawing_title_1 is required.")

        if pattern:
            if pattern in seen_patterns:
                errors.append(
                    f"Row {index}: duplicate filename_pattern '{sheet.get('filename_pattern', '').strip()}'."
                )
            else:
                seen_patterns.add(pattern)

    return errors


def find_image(exports_dir: str, pattern: str) -> str | None:
    """
    Search exports_dir for a file whose name (without extension) matches pattern.
    Case-insensitive. Returns full path or None.
    """
    if not pattern or not os.path.isdir(exports_dir):
        return None
    pattern_lower = pattern.lower()
    for fname in os.listdir(exports_dir):
        name, ext = os.path.splitext(fname)
        if ext.lower() in IMAGE_EXTENSIONS and name.lower() == pattern_lower:
            return os.path.join(exports_dir, fname)
    return None


def save_default_config(output_path: str):
    """Write a blank project_config.json template."""
    config = {
        "project_title": "Enter Project Title",
        "project_address": "Enter Site Address",
        "project_number": "PTG-YYYY-XXX",
        "client_name": "Enter Client Name",
        "drawn_by": "XX",
        "designed_by": "XX",
        "approved_by": "XX",
        "date": date.today().strftime("%d.%m.%y"),
        "drawing_status": "FOR INFORMATION",
        "sheet_prefix": "A",
        "logo_path": "assets/ptg_logo.png",
        "template_path": "assets/PTG_Appendix_Template.pptx",
        "company_name": "PTG CONSULTING",
        "company_address": "Level 3, 159 Coronation Drive (CNR Cribb St), Milton QLD 4064",
        "company_phone": "(07) 3444 6666",
        "company_email": "admin@ptgconsulting.com.au",
        "company_website": "www.ptgconsulting.com.au",
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)


def save_default_sheet_csv(output_path: str):
    """Write a default sheets.csv template."""
    rows = [
        [
            "sheet_number",
            "drawing_title_1",
            "drawing_title_2",
            "drawing_title_3",
            "filename_pattern",
            "scale",
        ],
        ["001", "Test Location Plan", "", "", "test_location_plan", "NTS"],
        ["002", "Cross Section", "A - A'", "", "cross_section_AA", "NTS"],
        ["003", "Cross Section", "B - B'", "", "cross_section_BB", "NTS"],
    ]
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(rows)
