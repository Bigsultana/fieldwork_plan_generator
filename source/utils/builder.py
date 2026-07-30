"""Build an A1 landscape appendix presentation from engineering images."""

import os
import tempfile

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Mm, Pt

from utils.config_loader import find_image
from utils.titleblock_constants import (
    CONTENT_H,
    CONTENT_L,
    CONTENT_T,
    CONTENT_W,
    SLIDE_H_MM,
    SLIDE_W_MM,
    WHITE,
)
from utils.titleblock_renderer import draw_titleblock


def _remove_all_slides(presentation):
    slide_ids = list(presentation.slides._sldIdLst)
    for slide_id in slide_ids:
        presentation.part.drop_rel(slide_id.rId)
        presentation.slides._sldIdLst.remove(slide_id)


def _blank_layout(presentation):
    for layout in presentation.slide_layouts:
        if layout.name.lower() == "blank":
            return layout
    return presentation.slide_layouts[-1]


def _fit_image(width_px, height_px, box_width_mm, box_height_mm):
    if width_px <= 0 or height_px <= 0:
        raise ValueError("Image dimensions must be positive.")
    image_ratio = width_px / height_px
    box_ratio = box_width_mm / box_height_mm
    if image_ratio > box_ratio:
        width = box_width_mm
        height = width / image_ratio
    else:
        height = box_height_mm
        width = height * image_ratio
    left = CONTENT_L + (box_width_mm - width) / 2
    top = CONTENT_T + (box_height_mm - height) / 2
    return left, top, width, height


def _missing_placeholder(slide, sheet, reason):
    shape = slide.shapes.add_shape(
        1,
        Mm(CONTENT_L),
        Mm(CONTENT_T),
        Mm(CONTENT_W),
        Mm(CONTENT_H),
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = RGBColor(0xF3, 0xF3, 0xF3)
    shape.line.color.rgb = RGBColor(0xC8, 0xC8, 0xC8)
    frame = shape.text_frame
    frame.clear()
    frame.word_wrap = True
    title = frame.paragraphs[0]
    title.alignment = PP_ALIGN.CENTER
    title_run = title.add_run()
    title_run.text = f"[ {sheet.get('drawing_title_1', 'Image')} ]"
    title_run.font.name = "Arial"
    title_run.font.size = Pt(18)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(0x88, 0x88, 0x88)
    detail = frame.add_paragraph()
    detail.alignment = PP_ALIGN.CENTER
    detail_run = detail.add_run()
    detail_run.text = reason
    detail_run.font.name = "Arial"
    detail_run.font.size = Pt(10)
    detail_run.font.color.rgb = RGBColor(0x88, 0x88, 0x88)


def build_appendix(
    exports_dir: str,
    output_path: str,
    project_config: dict,
    sheets: list,
    logo_path: str | None = None,
    template_path: str | None = None,
    on_progress=None,
) -> dict:
    if not output_path:
        raise ValueError("An output path is required.")
    if not sheets:
        raise ValueError("At least one sheet is required.")

    presentation = (
        Presentation(template_path)
        if template_path and os.path.isfile(template_path)
        else Presentation()
    )
    presentation.slide_width = Mm(SLIDE_W_MM)
    presentation.slide_height = Mm(SLIDE_H_MM)
    _remove_all_slides(presentation)
    layout = _blank_layout(presentation)

    missing = []
    total = len(sheets)

    for index, sheet in enumerate(sheets, 1):
        if on_progress:
            on_progress(
                index,
                total,
                f"Building sheet {sheet.get('sheet_number', '?')}",
            )
        slide = presentation.slides.add_slide(layout)
        slide.background.fill.solid()
        slide.background.fill.fore_color.rgb = WHITE

        fields = dict(project_config)
        fields.update(
            {
                key: value
                for key, value in sheet.items()
                if key != "filename_pattern"
            }
        )
        draw_titleblock(slide, fields, logo_path=logo_path)

        source_path = str(sheet.get("source_path", "")).strip()
        pattern = str(sheet.get("filename_pattern", "")).strip()
        image_path = (
            source_path
            if source_path and os.path.isfile(source_path)
            else None
        )
        if image_path is None and pattern:
            image_path = find_image(exports_dir, pattern)

        if image_path and os.path.isfile(image_path):
            try:
                with Image.open(image_path) as image:
                    width_px, height_px = image.size
                left, top, width, height = _fit_image(
                    width_px,
                    height_px,
                    CONTENT_W,
                    CONTENT_H,
                )
                slide.shapes.add_picture(
                    image_path,
                    Mm(left),
                    Mm(top),
                    Mm(width),
                    Mm(height),
                )
            except Exception as exc:
                _missing_placeholder(
                    slide,
                    sheet,
                    f"Unable to read image: {exc}",
                )
                missing.append(
                    (
                        sheet.get("sheet_number"),
                        sheet.get("drawing_title_1"),
                        image_path,
                    )
                )
        else:
            reason = (
                f"No file found matching '{pattern}'"
                if pattern
                else "No source image selected"
            )
            _missing_placeholder(slide, sheet, reason)
            missing.append(
                (
                    sheet.get("sheet_number"),
                    sheet.get("drawing_title_1"),
                    pattern or source_path,
                )
            )

    if on_progress:
        on_progress(total, total, "Saving presentation")

    absolute_output = os.path.abspath(output_path)
    output_directory = os.path.dirname(absolute_output)
    os.makedirs(output_directory, exist_ok=True)
    file_descriptor, temporary_path = tempfile.mkstemp(
        prefix="appendix-",
        suffix=".pptx",
        dir=output_directory,
    )
    os.close(file_descriptor)
    try:
        presentation.save(temporary_path)
        os.replace(temporary_path, absolute_output)
    finally:
        if os.path.exists(temporary_path):
            os.remove(temporary_path)

    return {
        "slides_built": total,
        "missing": missing,
        "output_path": absolute_output,
    }
