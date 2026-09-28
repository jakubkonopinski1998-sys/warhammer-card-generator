"""Punkt wejścia aplikacji desktopowej."""
from pathlib import Path

import webview

from src.api import Api


if __name__ == "__main__":
    root = Path(__file__).resolve().parent
    api = Api()
    webview.create_window(
        "Warhammer Card Generator",
        str(root / "web" / "index.html"),
        js_api=api,
        width=1400,
        height=900,
    )
    webview.start(debug=True)