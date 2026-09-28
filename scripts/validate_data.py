"""Waliduje wszystkie pliki data/content/*.json względem schematu."""
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = ROOT / "data" / "schema" / "content.schema.json"
CONTENT_DIR = ROOT / "data" / "content"


def main() -> int:
    if not SCHEMA_PATH.exists():
        print(f"❌ Brak schematu: {SCHEMA_PATH}")
        return 1

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)

    total_errors = 0
    for fpath in sorted(CONTENT_DIR.glob("*.json")):
        try:
            data = json.loads(fpath.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"❌ {fpath.name}: błąd JSON — {e}")
            total_errors += 1
            continue

        errors = list(validator.iter_errors(data))
        if errors:
            total_errors += len(errors)
            print(f"❌ {fpath.name}: {len(errors)} błędów")
            for e in errors[:5]:  # max 5 na plik
                path = ".".join(str(p) for p in e.absolute_path) or "<root>"
                print(f"     - {path}: {e.message}")
        else:
            print(f"✅ {fpath.name}")

    if total_errors:
        print(f"\n🔴 Łącznie błędów: {total_errors}")
        return 1

    print("\n🟢 Wszystkie pliki poprawne.")
    return 0


if __name__ == "__main__":
    sys.exit(main())