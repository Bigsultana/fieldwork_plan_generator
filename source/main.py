"""Development entry point for Fieldwork Plan Generator."""

from __future__ import annotations

import os

import uvicorn


if __name__ == "__main__":
    uvicorn.run(
        "web_app:app",
        app_dir=os.path.dirname(os.path.abspath(__file__)),
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("RELOAD", "0") == "1",
    )
