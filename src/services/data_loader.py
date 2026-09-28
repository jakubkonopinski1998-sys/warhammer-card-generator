"""Scala data/content/*.json w jeden rejestr DANE."""
import json
from functools import lru_cache
from pathlib import Path


CONTENT_FILES = [
    "names.json",
    "appearance.json",
    "races.json",
    "professions.json",
    "talents.json",
    "weapons.json",
    "prayers.json",
    "equipment.json",
]


class DataRegistry:
    def __init__(self, data_dir: Path):
        self._data_dir = data_dir
        self._registry: dict = {}
        self._load()

    def _load(self):
        content = self._data_dir / "content"
        if not content.exists():
            raise FileNotFoundError(f"Brak katalogu danych: {content}")
        for fname in CONTENT_FILES:
            fpath = content / fname
            if not fpath.exists():
                raise FileNotFoundError(f"Brak pliku danych: {fpath}")
            part = json.loads(fpath.read_text(encoding="utf-8"))
            self._registry.update(part)

    def __getitem__(self, key):
        return self._registry[key]

    def get(self, key, default=None):
        return self._registry.get(key, default)

    def keys(self):
        return self._registry.keys()

@lru_cache(maxsize=1)
def get_registry() -> DataRegistry:
    """Singleton — wczytuje raz na proces."""
    root = Path(__file__).resolve().parent.parent.parent / "data"
    return DataRegistry(root)

    