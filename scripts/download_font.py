"""Pobiera font Almendra z Google Fonts do assets/fonts/."""
import urllib.request
from pathlib import Path


FONTS = {
    "Almendra-Regular.ttf": "https://github.com/google/fonts/raw/main/ofl/almendra/Almendra-Regular.ttf",
    "Almendra-Bold.ttf":    "https://github.com/google/fonts/raw/main/ofl/almendra/Almendra-Bold.ttf",
    "Almendra-Italic.ttf":  "https://github.com/google/fonts/raw/main/ofl/almendra/Almendra-Italic.ttf",
    "Almendra-BoldItalic.ttf": "https://github.com/google/fonts/raw/main/ofl/almendra/Almendra-BoldItalic.ttf",
}


def main():
    root = Path(__file__).resolve().parent.parent
    fonts_dir = root / "assets" / "fonts"
    fonts_dir.mkdir(parents=True, exist_ok=True)

    for name, url in FONTS.items():
        dest = fonts_dir / name
        if dest.exists() and dest.stat().st_size > 1000:
            print(f"⏭  {name} już istnieje")
            continue
        print(f"⬇  {name} ...", end=" ", flush=True)
        try:
            urllib.request.urlretrieve(url, dest)
            print(f"OK ({dest.stat().st_size // 1024} KB)")
        except Exception as e:
            print(f"BŁĄD: {e}")
            return 1
    print("\n✅ Fonty gotowe w:", fonts_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())