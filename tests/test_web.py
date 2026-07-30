import io
import json
import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image
from pptx import Presentation

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source"
if str(SOURCE) not in sys.path:
    sys.path.insert(0, str(SOURCE))

from web_app import app


def png_bytes():
    buffer = io.BytesIO()
    Image.new("RGB", (1200, 700), "white").save(buffer, format="PNG")
    return buffer.getvalue()


class FieldworkPlanWebTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_endpoint(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["service"], "fieldwork-plan-generator")

    def test_home_page(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Fieldwork Plan Generator", response.text)

    def test_browser_generation_returns_powerpoint(self):
        response = self.client.post(
            "/api/generate",
            data={
                "project_config": json.dumps(
                    {
                        "project_title": "Browser Test",
                        "project_number": "WEB-001",
                        "company_name": "Example Company",
                    }
                ),
                "sheets": json.dumps(
                    [
                        {
                            "sheet_number": "001",
                            "drawing_title_1": "Location Plan",
                            "drawing_title_2": "Proposed fieldwork",
                            "scale": "NTS",
                            "revision": "A",
                        }
                    ]
                ),
            },
            files=[("images", ("location-plan.png", png_bytes(), "image/png"))],
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            response.headers["content-type"],
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )
        presentation = Presentation(io.BytesIO(response.content))
        self.assertEqual(len(presentation.slides), 1)

    def test_rejects_sheet_count_mismatch(self):
        response = self.client.post(
            "/api/generate",
            data={"project_config": "{}", "sheets": "[]"},
            files=[("images", ("location-plan.png", png_bytes(), "image/png"))],
        )
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
