"""API wystawiane do JS przez window.pywebview.api.*."""
import base64
import io
import json
import re
from functools import lru_cache
from pathlib import Path

import webview

from src.domain.character import Character
from src.rendering.renderer import CardRenderer
from src.services.data_loader import get_registry


ROOT = Path(__file__).resolve().parent.parent


@lru_cache(maxsize=1)
def _renderer() -> CardRenderer:
    return CardRenderer(get_registry(), ROOT / "assets")


def _talent_descs(d: dict) -> dict:
    out = {}
    for k, v in d.items():
        if isinstance(v, dict):
            out[k] = v.get("pelny", "") or v.get("skrot", "")
        else:
            out[k] = str(v)
    return out


# Indeksy cech zgodne z kolejnością WW, US, S, Wt, I, Zw, Zr, Int, SW, Ogd
_STAT_INDEX = {
    "Walka Wręcz": 0,
    "Umiejętności Strzeleckie": 1,
    "Siła": 2,
    "Wytrzymałość": 3,
    "Inicjatywa": 4,
    "Zwinność": 5,
    "Zręczność": 6,
    "Inteligencja": 7,
    "Siła Woli": 8,
    "Ogłada": 9,
}

_TALENT_BONUS_RE = re.compile(
    r"początkowa cecha\s+(.+?)\s+zostaje zwiększona o\s+\+(\d+)\s+punkt"
)


def _talent_stat_bonuses(d: dict) -> dict:
    """Mapa: nazwa talentu -> {stat: idx, value: int} dla talentów typu '+X do cechy'."""
    out = {}
    for name, v in d.items():
        desc = v.get("pelny", "") if isinstance(v, dict) else str(v)
        m = _TALENT_BONUS_RE.search(desc)
        if not m:
            continue
        stat_name = m.group(1).strip()
        idx = _STAT_INDEX.get(stat_name)
        if idx is None:
            continue
        out[name] = {"stat": idx, "value": int(m.group(2))}
    return out


# Profesje, które mogą wybrać bóstwo (dokładne ścieżki bez numeru strony)
RELIGION_PROFESSIONS = [
    "Kleryk / Kapłan / Arcykapłan",
    "Nowicjusz / Mnich / Przeor",
    "Gorliwiec / Biczownik / Pokutnik",
    "Szeptucha / Czarownica / Wiedźma",
    "Uczeń Guślarza / Guślarz / Starszy Guślarzy",
    "Nowicjusz Wojowników / Kapłan Bitewny / Kapłan-Sierżant",
]


class Api:
    def ping(self) -> str:
        return "pong"

    def get_all_data(self) -> dict:
        reg = get_registry()
        return {
            "races":            list(reg.get("rasy", {}).keys()),
            "classes":          list(reg.get("profesje", {}).keys()),
            "professions":      reg.get("profesje", {}),
            "hair":             reg.get("wlosy", []),
            "eyes":             reg.get("oczy", []),
            "gods":             list(reg.get("blogoslawienstwa_kultow", {}).keys()),
            "blessings_by_god": reg.get("blogoslawienstwa_kultow", {}),
            "talents":          sorted(reg.get("talenty", {}).keys()),
            "talents_prof":     sorted(reg.get("talenty_profesji", {}).keys()),
            "weapons":          reg.get("bronie", []),
            "weapon_features":  [k for k in reg.get("cechy_oreza", {}).keys() if k.strip() != "-"],
            "equipment":        reg.get("ekwipunek_podstawowy", {}),
            "names_m":          reg.get("imiona_m", []),
            "names_k":          reg.get("imiona_k", []),

            # Opisy do UI
            "talent_descriptions":         _talent_descs(reg.get("talenty", {})),
            "talent_prof_descriptions":    _talent_descs(reg.get("talenty_profesji", {})),
            "weapon_feature_descriptions": reg.get("cechy_oreza", {}),
            "blessing_descriptions":       reg.get("modlitwy_szczegolowe", {}),

            # Bonusy z talentów
            "talent_bonuses":      _talent_stat_bonuses(reg.get("talenty", {})),
            "talent_prof_bonuses": _talent_stat_bonuses(reg.get("talenty_profesji", {})),

            # Profesje uprawnione do wyboru bóstwa
            "religion_professions": RELIGION_PROFESSIONS,
        }

    def render_from_form(self, data: dict, page: int) -> str | None:
        char = Character.from_dict(data)
        img = _renderer().render_page(char, page)
        if img is None:
            return None
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()

    def render_profession(self, data: dict) -> str | None:
        char = Character.from_dict(data)
        img = _renderer().render_page(char, 4)
        if img is None:
            return None
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()

    def save_pdf(self, data: dict) -> str:
        char = Character.from_dict(data)
        pages: list = []
        for p in (1, 2, 3):
            img = _renderer().render_page(char, p)
            if img is not None:
                pages.append(img.convert("RGB"))
        prof = _renderer().render_page(char, 4)
        if prof is not None:
            pages.append(prof.convert("RGB"))

        if not pages:
            return "Brak stron do zapisania."

        name = (char.imie or "postac").replace(" ", "_")
        window = webview.windows[0]
        result = window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=f"{name}_karta.pdf",
            file_types=("PDF (*.pdf)",),
        )
        if not result:
            return "Anulowano."

        path = result if isinstance(result, str) else result[0]
        pages[0].save(path, format="PDF", save_all=True, append_images=pages[1:])
        return f"Zapisano: {path}"

    def save_png(self, data: dict, page: int) -> str:
        char = Character.from_dict(data)
        img = _renderer().render_page(char, page)
        if img is None:
            return "Nie udało się wyrenderować strony."

        name = (char.imie or "postac").replace(" ", "_")
        window = webview.windows[0]
        result = window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=f"{name}_P{page}.png",
            file_types=("PNG (*.png)",),
        )
        if not result:
            return "Anulowano."

        path = result if isinstance(result, str) else result[0]
        img.convert("RGB").save(path, format="PNG")
        return f"Zapisano: {path}"

    def save_character(self, data: dict) -> str:
        name = (data.get("imie") or "postac").replace(" ", "_")
        window = webview.windows[0]
        result = window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=f"{name}.json",
            file_types=("JSON (*.json)",),
        )
        if not result:
            return "Anulowano."

        path = result if isinstance(result, str) else result[0]
        Path(path).write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return f"Zapisano: {path}"

    def load_character(self) -> dict | None:
        window = webview.windows[0]
        result = window.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=("JSON (*.json)",),
        )
        if not result:
            return None

        path = result[0] if isinstance(result, (list, tuple)) else result
        try:
            return json.loads(Path(path).read_text(encoding="utf-8"))
        except Exception as e:
            return {"__error__": str(e)}