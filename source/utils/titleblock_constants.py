"""
PTG Consulting titleblock layout constants.
All measurements derived from DXF: A1_HORIZONTAL_-_PTG_CONSULTING_COMMERCIAL

DXF coordinate space (mm):
  Sheet outer border:  (5.86, 4.87) -> (834.86, 586.87)   = 829 x 582 mm  (A1 landscape)
  Inner border:        (11.86, 10.87) -> (828.86, 580.87)
  Titleblock bottom strip: y = 10.87 to 62.67  (height = 51.8mm)

PowerPoint slide size: A1 landscape = 841 x 594 mm
We map DXF coords -> PPT EMU (English Metric Units: 914400 per inch, 36000 per mm)
"""

from pptx.dml.color import RGBColor
from pptx.util import Pt

# ── Sheet size (A1 landscape) ────────────────────────────────────────────────
SLIDE_W_MM = 841.0
SLIDE_H_MM = 594.0

# ── Colours ──────────────────────────────────────────────────────────────────
BLACK = RGBColor(0x00, 0x00, 0x00)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
DARK_GREY = RGBColor(0x40, 0x40, 0x40)
MID_GREY = RGBColor(0x80, 0x80, 0x80)
PTG_BLUE = RGBColor(0x00, 0x4B, 0x8B)  # approximate PTG brand blue

# ── Titleblock geometry (mm, origin bottom-left of DXF = bottom-left of sheet)
# DXF y increases upward; PPT y increases downward.  Conversion: ppt_y = SLIDE_H - dxf_y
#
# Outer margin lines (the fold/crop marks)
MARGIN_L = 5.86
MARGIN_R = 834.86
MARGIN_B = 4.87
MARGIN_T = 586.87

# Inner border rectangle
INNER_L = 11.86
INNER_R = 828.86
INNER_B = 10.87
INNER_T = 580.87

# Titleblock strip: sits at the bottom inside the inner border
TB_TOP_DXF = 62.67  # top of titleblock strip in DXF coords
TB_BOT_DXF = 10.87  # bottom of titleblock strip

# In PPT coords (y from top):
TB_TOP_PPT = SLIDE_H_MM - TB_TOP_DXF  # ~531.33 mm from top
TB_H_MM = TB_TOP_DXF - TB_BOT_DXF  # ~51.8 mm tall

# Content area (everything above titleblock, inside inner border)
CONTENT_L = INNER_L  # 11.86 mm
CONTENT_T = SLIDE_H_MM - INNER_T  # ~13.13 mm from top
CONTENT_R = INNER_R  # 828.86 mm
CONTENT_B = TB_TOP_PPT  # ~531.33 mm from top
CONTENT_W = CONTENT_R - CONTENT_L  # ~817 mm
CONTENT_H = CONTENT_B - CONTENT_T  # ~518.2 mm

# ── Titleblock column dividers (DXF x coords) ────────────────────────────────
# From DXF lines on layer G-ANNO-TTLB:
# x = 234.86  (end of revision schedule, start of copyright block)
# x = 293.86  (end of copyright, start of address/contact)
# x = 378.86  (?)
# x = 451.36  (end of contact/north block)
# x = 520.73  (north point divider)
# x = 578.86  (start of project/drawing title block)
# x = 688.86  (start of drawn/date/proj no block)

COL_REV_END = 234.86
COL_COPY_END = 293.86
COL_ADDR_END = 451.36
COL_NORTH_END = 520.73
COL_PROJ_END = 578.86  # actually label says project
COL_TITLE_END = 688.86

# Sub-dividers in the right zone (drawn/date/projno/sheet):
# x = 708.86, 728.86, 743.86, 768.86, 808.86
COL_DRAWN_END = 708.86
COL_DATE_END = 728.86
COL_PROJNO_S = 728.86
COL_SCALE_END = 743.86
COL_DWGNO_S = 768.86
COL_REV_S = 808.86

# Sub-row dividers (DXF y) in right zone:
# y = 34.87, 22.87 (horizontal lines at x > 688.86)
ROW_TOP_DXF = 34.87
ROW_MID_DXF = 22.87

# ── Font sizes ───────────────────────────────────────────────────────────────
FS_LABEL = Pt(6.0)  # small grey field labels ("Drawn", "Date" etc.)
FS_VALUE = Pt(9.5)  # field values
FS_TITLE = Pt(15)  # drawing title lines
FS_PROJECT = Pt(15)  # project title
FS_SMALL = Pt(5.8)  # tiny copyright text
FS_STAMP = Pt(7)  # "NOT FOR CONSTRUCTION" etc.

# ── Revision schedule columns (left of titleblock) ───────────────────────────
# From SCHD lines: x dividers at 27.29, 50.60, 201.88, 216.78, 234.86
# Rows spaced 3.83mm from y=12.68 to 54.84
REV_COL_DATE = 27.29
REV_COL_DESC = 50.60
REV_COL_DRAWN = 201.88
REV_COL_CHK = 216.78
REV_COL_END = 234.86
REV_ROW_STEP = 3.83
REV_ROW_START = 12.68
REV_ROW_END = 54.84
