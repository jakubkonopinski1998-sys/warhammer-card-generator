"""Jednorazowa migracja: config_generator.json -> data/content/*.json"""
import json
from pathlib import Path

SOURCE = Path("config_generator.json")       # stary plik obok skryptu
TARGET = Path("data/content")

MAPPING = {
    "names.json":       ["imiona_m", "imiona_k"],
    "appearance.json":  ["wlosy", "oczy"],
    "races.json":       ["rasy"],
    "professions.json": ["profesje"],
    "talents.json":     ["talenty", "talenty_profesji"],
    "weapons.json":     ["bronie", "cechy_oreza"],
    "prayers.json":     ["modlitwy", "blogoslawienstwa_kultow", "modlitwy_szczegolowe"],
    "equipment.json":   ["ekwipunek_podstawowy"],
}

def main():
    if not SOURCE.exists():
        print(f"❌ Brak {SOURCE}")
        return

    src = json.loads(SOURCE.read_text(encoding="utf-8"))
    TARGET.mkdir(parents=True, exist_ok=True)

    used_keys = set()
    for filename, keys in MAPPING.items():
        subset = {k: src[k] for k in keys if k in src}
        used_keys.update(subset.keys())
        out = TARGET / filename
        out.write_text(
            json.dumps(subset, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"✅ {filename:20s} <- {list(subset.keys())}")

    orphan = set(src.keys()) - used_keys
    if orphan:
        print(f"⚠️  Pominięte klucze: {orphan}")

if __name__ == "__main__":
    main()