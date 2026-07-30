"""Render a neutral A1 landscape title block onto a PowerPoint slide."""

import os

from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Mm, Pt

from utils import titleblock_constants as tc


def _mm(value):
    return Mm(float(value))


def _add_rect(
    slide,
    left,
    top,
    width,
    height,
    fill=None,
    line_color=tc.BLACK,
    line_pt=0.5,
):
    shape = slide.shapes.add_shape(
        1, _mm(left), _mm(top), _mm(width), _mm(height)
    )
    if fill is None:
        shape.fill.background()
    else:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill
    shape.line.color.rgb = line_color
    shape.line.width = Pt(line_pt)
    return shape


def _add_text(
    slide,
    left,
    top,
    width,
    height,
    text,
    font_size,
    *,
    bold=False,
    color=tc.BLACK,
    align=PP_ALIGN.LEFT,
    vertical=MSO_ANCHOR.MIDDLE,
    word_wrap=True,
):
    box = slide.shapes.add_textbox(
        _mm(left), _mm(top), _mm(width), _mm(height)
    )
    frame = box.text_frame
    frame.clear()
    frame.word_wrap = word_wrap
    frame.vertical_anchor = vertical
    frame.margin_left = Mm(0.8)
    frame.margin_right = Mm(0.8)
    frame.margin_top = Mm(0.2)
    frame.margin_bottom = Mm(0.2)
    paragraph = frame.paragraphs[0]
    paragraph.alignment = align
    run = paragraph.add_run()
    run.text = str(text or "")
    run.font.name = "Arial"
    run.font.size = font_size
    run.font.bold = bold
    run.font.color.rgb = color
    return box


def _fit_size(text, base_pt, min_pt, width_mm, height_mm):
    text = str(text or "")
    size = float(base_pt)
    while size > min_pt:
        chars_per_line = max(
            int((width_mm * 2.83) / max(size * 0.52, 1)), 1
        )
        line_count = max(
            1, (len(text) + chars_per_line - 1) // chars_per_line
        )
        if line_count * size * 1.15 <= height_mm * 2.83:
            break
        size -= 0.5
    return Pt(max(size, min_pt))


def _fitted_text(
    slide,
    left,
    top,
    width,
    height,
    text,
    base_pt,
    min_pt=6.0,
    **kwargs,
):
    return _add_text(
        slide,
        left,
        top,
        width,
        height,
        text,
        _fit_size(text, base_pt, min_pt, width - 1.6, height - 0.4),
        **kwargs,
    )


def _field(
    slide,
    left,
    top,
    width,
    height,
    label,
    value,
    *,
    align=PP_ALIGN.CENTER,
):
    label_h = min(4.5, height * 0.34)
    _add_text(
        slide,
        left,
        top,
        width,
        label_h,
        label,
        tc.FS_LABEL,
        color=tc.MID_GREY,
        vertical=MSO_ANCHOR.TOP,
    )
    _fitted_text(
        slide,
        left,
        top + label_h,
        width,
        height - label_h,
        value,
        tc.FS_VALUE.pt,
        min_pt=6.0,
        bold=True,
        align=align,
    )


def draw_titleblock(slide, fields: dict, logo_path: str | None = None):
    """Draw a generic title block using values supplied in ``fields``."""

    def value(key, default=""):
        return str(fields.get(key, default) or default)

    _add_rect(
        slide,
        tc.MARGIN_L,
        tc.MARGIN_T,
        tc.MARGIN_R - tc.MARGIN_L,
        tc.SLIDE_H_MM - tc.MARGIN_T - tc.MARGIN_B,
        line_pt=0.25,
    )
    _add_rect(
        slide,
        tc.INNER_L,
        tc.INNER_T,
        tc.INNER_R - tc.INNER_L,
        tc.SLIDE_H_MM - tc.INNER_T - tc.INNER_B,
        line_pt=0.75,
    )

    top = tc.TITLEBLOCK_TOP
    height = tc.TITLEBLOCK_H
    _add_rect(
        slide,
        tc.INNER_L,
        top,
        tc.CONTENT_W,
        height,
        fill=tc.WHITE,
        line_pt=0.6,
    )

    company_l = tc.INNER_L
    company_w = 158.0
    project_l = company_l + company_w
    project_w = 240.0
    drawing_l = project_l + project_w
    drawing_w = 230.0
    meta_l = drawing_l + drawing_w
    meta_w = tc.INNER_R - meta_l

    for x in (project_l, drawing_l, meta_l):
        _add_rect(slide, x, top, 0.01, height, fill=tc.BLACK, line_pt=0.4)

    company_name = value("company_name", "COMPANY NAME")
    company_address = value("company_address")
    contact = "  |  ".join(
        part
        for part in (
            value("company_phone"),
            value("company_email"),
            value("company_website"),
        )
        if part
    )

    logo_w = 46.0
    logo_used = False
    if logo_path and os.path.isfile(logo_path):
        try:
            slide.shapes.add_picture(
                logo_path,
                _mm(company_l + 3),
                _mm(top + 4),
                _mm(logo_w - 6),
                _mm(height - 8),
            )
            logo_used = True
        except Exception:
            logo_used = False

    company_text_l = company_l + (logo_w if logo_used else 2.0)
    company_text_w = company_w - (company_text_l - company_l) - 2.0
    _fitted_text(
        slide,
        company_text_l,
        top + 3,
        company_text_w,
        13,
        company_name,
        13,
        min_pt=8,
        bold=True,
        color=tc.ACCENT_BLUE,
    )
    _fitted_text(
        slide,
        company_text_l,
        top + 17,
        company_text_w,
        15,
        company_address,
        7.2,
        min_pt=5.5,
    )
    _fitted_text(
        slide,
        company_text_l,
        top + 33,
        company_text_w,
        12,
        contact,
        6.5,
        min_pt=5.0,
    )

    _add_text(
        slide,
        project_l + 1,
        top + 1,
        project_w - 2,
        4,
        "PROJECT",
        tc.FS_LABEL,
        color=tc.MID_GREY,
    )
    _fitted_text(
        slide,
        project_l + 1,
        top + 5,
        project_w - 2,
        15,
        value("project_title", "PROJECT TITLE"),
        tc.FS_PROJECT.pt,
        min_pt=7.0,
        bold=True,
        color=tc.ACCENT_BLUE,
    )
    _field(
        slide,
        project_l,
        top + 21,
        project_w * 0.56,
        15,
        "Client",
        value("client_name"),
        align=PP_ALIGN.LEFT,
    )
    _field(
        slide,
        project_l + project_w * 0.56,
        top + 21,
        project_w * 0.44,
        15,
        "Project No.",
        value("project_number"),
    )
    _field(
        slide,
        project_l,
        top + 36,
        project_w,
        16,
        "Address",
        value("project_address"),
        align=PP_ALIGN.LEFT,
    )

    _add_text(
        slide,
        drawing_l + 1,
        top + 1,
        drawing_w - 2,
        4,
        "DRAWING TITLE",
        tc.FS_LABEL,
        color=tc.MID_GREY,
    )
    _fitted_text(
        slide,
        drawing_l + 1,
        top + 5,
        drawing_w - 2,
        18,
        value("drawing_title_1", "DRAWING TITLE"),
        tc.FS_TITLE.pt,
        min_pt=7.5,
        bold=True,
    )
    _fitted_text(
        slide,
        drawing_l + 1,
        top + 23,
        drawing_w - 2,
        12,
        value("drawing_title_2"),
        9.5,
        min_pt=6.5,
        bold=True,
    )
    _fitted_text(
        slide,
        drawing_l + 1,
        top + 35,
        drawing_w - 2,
        10,
        value("drawing_title_3"),
        8.0,
        min_pt=6.0,
    )
    _field(
        slide,
        drawing_l,
        top + 45,
        drawing_w,
        7,
        "Drawing Status",
        value("drawing_status", "FOR INFORMATION"),
    )

    row_h = height / 3
    col_w = meta_w / 3
    meta_fields = [
        ("Drawn", value("drawn_by")),
        ("Designed", value("designed_by")),
        ("Approved", value("approved_by")),
        ("Date", value("date")),
        ("Scale @ A1", value("scale", "NTS")),
        (
            "Figure No.",
            value("sheet_prefix", "A") + value("sheet_number", "001"),
        ),
        ("Revision", value("revision", "-")),
        ("Status", value("drawing_status", "FOR INFORMATION")),
        ("Sheet", value("sheet_number", "001")),
    ]
    for index, (label, field_value) in enumerate(meta_fields):
        row, col = divmod(index, 3)
        left = meta_l + col * col_w
        field_top = top + row * row_h
        _add_rect(
            slide,
            left,
            field_top,
            col_w,
            row_h,
            fill=None,
            line_pt=0.35,
        )
        _field(
            slide,
            left,
            field_top,
            col_w,
            row_h,
            label,
            field_value,
        )

    status = value("drawing_status", "FOR INFORMATION").upper()
    if "DRAFT" in status or "NOT FOR CONSTRUCTION" in status:
        _add_text(
            slide,
            tc.CONTENT_L + tc.CONTENT_W * 0.30,
            tc.CONTENT_T + tc.CONTENT_H * 0.40,
            tc.CONTENT_W * 0.40,
            35,
            "DRAFT",
            Pt(64),
            bold=True,
            color=tc.LIGHT_GREY,
            align=PP_ALIGN.CENTER,
        )
