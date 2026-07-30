"""Generate a reusable neutral appendix PowerPoint template."""

import os

from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE
from pptx.util import Mm, Pt

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


def _blank_layout(presentation):
    for layout in presentation.slide_layouts:
        if layout.name.lower() == "blank":
            return layout
    return presentation.slide_layouts[-1]


def create_appendix_template(base_pptx_path: str, output_path: str) -> str:
    presentation = (
        Presentation(base_pptx_path)
        if base_pptx_path and os.path.isfile(base_pptx_path)
        else Presentation()
    )
    presentation.slide_width = Mm(SLIDE_W_MM)
    presentation.slide_height = Mm(SLIDE_H_MM)
    slide = presentation.slides.add_slide(_blank_layout(presentation))
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = WHITE

    draw_titleblock(
        slide,
        {
            "company_name": "COMPANY NAME",
            "project_title": "PROJECT TITLE",
            "project_address": "PROJECT ADDRESS",
            "project_number": "PROJECT-YYYY-XXX",
            "client_name": "CLIENT NAME",
            "drawing_title_1": "DRAWING TITLE",
            "drawn_by": "XX",
            "designed_by": "XX",
            "approved_by": "XX",
            "date": "DD.MM.YY",
            "scale": "NTS",
            "sheet_number": "001",
            "sheet_prefix": "A",
            "revision": "-",
            "drawing_status": "FOR INFORMATION",
        },
    )

    frame = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE,
        Mm(CONTENT_L),
        Mm(CONTENT_T),
        Mm(CONTENT_W),
        Mm(CONTENT_H),
    )
    frame.fill.background()
    frame.line.width = Pt(1)
    frame.text_frame.text = "IMAGE CONTENT AREA"

    output_directory = os.path.dirname(os.path.abspath(output_path))
    os.makedirs(output_directory, exist_ok=True)
    presentation.save(output_path)
    return output_path
