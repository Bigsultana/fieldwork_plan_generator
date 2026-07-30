import sys
import unittest
from pathlib import Path

from PIL import Image
from pptx import Presentation

TOOL_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = TOOL_ROOT / "source"

if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from utils.builder import build_appendix
from utils.config_loader import resolve_optional_path


class BuildAppendixSmokeTest(unittest.TestCase):
    def test_build_appendix_generates_pptx_from_tool_root_assets(self):
        temp_path = TOOL_ROOT / "tests" / "_runtime-smoke-auto"
        temp_path.mkdir(exist_ok=True)
        image_path = temp_path / "sample_plan.png"
        output_path = temp_path / "appendix-smoke-test.pptx"

        Image.new("RGB", (1600, 900), "#f8f8f8").save(image_path)

        result = build_appendix(
            exports_dir=str(temp_path),
            output_path=str(output_path),
            project_config={
                "project_title": "Smoke Test Project",
                "project_address": "123 Test Street",
                "project_number": "PTG-TEST-001",
                "client_name": "Codex",
                "drawn_by": "CD",
                "designed_by": "CD",
                "approved_by": "MR",
                "date": "29.04.26",
                "drawing_status": "FOR INFORMATION",
                "sheet_prefix": "A",
                "company_name": "PTG CONSULTING",
                "company_address": "Level 3, 159 Coronation Drive (CNR Cribb St), Milton QLD 4064",
                "company_phone": "(07) 3444 6666",
                "company_email": "admin@ptgconsulting.com.au",
                "company_website": "www.ptgconsulting.com.au",
            },
            sheets=[
                {
                    "sheet_number": "001",
                    "drawing_title_1": "Sample Plan",
                    "drawing_title_2": "",
                    "drawing_title_3": "",
                    "filename_pattern": "sample_plan",
                    "scale": "NTS",
                }
            ],
            template_path=resolve_optional_path(
                "", "assets/PTG_Appendix_Template.pptx"
            ),
        )

        self.assertEqual(result["slides_built"], 1)
        self.assertEqual(result["missing"], [])
        self.assertTrue(output_path.is_file())
        self.assertGreater(output_path.stat().st_size, 0)

        presentation = Presentation(str(output_path))
        self.assertEqual(len(presentation.slides), 1)


if __name__ == "__main__":
    unittest.main()
