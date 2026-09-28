"""Renderowanie kart na obraz PNG."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from src.domain.character import Character
from src.rendering.markdown import MarkdownParser
from src.services.data_loader import DataRegistry


class CardRenderer:
    def __init__(self, registry: DataRegistry, assets_dir: Path):
        self._reg = registry
        self._assets = assets_dir
        self._templates = assets_dir / "images" / "templates"
        self._professions = assets_dir / "images" / "professions"
        self._fonts_dir = assets_dir / "fonts"
        self._fonts: dict[int, ImageFont.FreeTypeFont] = {}

    def _font(self, size: int):
        """Zawsze używa Regular — pogrubienie symulujemy przez stroke_width."""
        if size not in self._fonts:
            path = self._fonts_dir / "Almendra-Regular.ttf"
            if not path.exists():
                raise FileNotFoundError(
                    f"Brak fontu: {path}\n"
                    f"Uruchom: python scripts/download_font.py"
                )
            self._fonts[size] = ImageFont.truetype(str(path), size)
        return self._fonts[size]

    def _draw_styled(self, draw, x, y, text, size, bold=False, italic=False, color="black"):
        """Rysuje tekst z pogrubieniem (stroke) i ewentualnie kursywą (przechylenie)."""
        font = self._font(size)
        stroke = 1 if bold else 0

        if italic:
            w = font.getlength(text) + 20
            h = size + 20
            layer = Image.new("RGBA", (int(w), int(h)), (0, 0, 0, 0))
            ld = ImageDraw.Draw(layer)
            ld.text((0, 0), text, fill=color, font=font,
                    stroke_width=stroke, stroke_fill=color)
            layer = layer.transform(
                (int(w), int(h)),
                Image.AFFINE,
                (1, 0.2, -0.2 * h, 0, 1, 0),
                resample=Image.BILINEAR,
            )
            draw._image.paste(layer, (int(x), int(y)), layer)
        else:
            draw.text((x, y), text, fill=color, font=font,
                      stroke_width=stroke, stroke_fill=color)

    @staticmethod
    def wrap_text(text: str, font, max_width: int) -> list[str]:
        lines, words = [], text.split()
        while words:
            line = ""
            while words and font.getlength(line + words[0]) <= max_width:
                line += words.pop(0) + " "
            lines.append(line.strip())
        return lines

    @staticmethod
    def wrap_by_chars(text: str, max_chars: int) -> list[str]:
        if not text:
            return []
        lines, curr = [], ""
        for w in text.split():
            if len(curr) + len(w) + 1 <= max_chars:
                curr += w + " "
            else:
                if curr: lines.append(curr.strip())
                curr = w + " "
        if curr: lines.append(curr.strip())
        return lines

    @staticmethod
    def _profession_number(c: Character) -> str | None:
        if "s." not in c.sciezka_profesji:
            return None
        return c.sciezka_profesji.split("s.")[-1].strip()

    def render_page(self, c: Character, page: int) -> Image.Image | None:
        if page == 4:
            num = self._profession_number(c)
            if not num:
                return None
            path = self._professions / f"{num}.png"
            if not path.exists():
                return None
            return Image.open(path).convert("RGBA")

        template = self._templates / f"WW{page - 1}.png"
        img = Image.open(template).convert("RGBA")
        draw = ImageDraw.Draw(img)

        font = self._font(33)
        font_b = self._font(40)
        font_hp = self._font(36)
        font_small = self._font(31)

        if page == 1:
            self._draw_ww0(draw, c, font, font_b, font_hp)
        elif page == 2:
            self._draw_ww1(draw, c, font, font_b, font_hp, font_small)
        elif page == 3:
            self._draw_ww2(draw, c, font, font_b, font_hp)
        return img

    # ---------- WW0 ----------
    def _draw_ww0(self, draw, c, font, font_b, font_hp):
        prof_name = c.sciezka_profesji.split(" / ")[1] if " / " in c.sciezka_profesji else c.sciezka_profesji
        p = {
            "imie": [c.imie, (600, 400)], "rasa": [c.rasa, (1400, 400)],
            "klasa": [c.klasa, (1950, 400)], "profesja": [prof_name, (600, 460)],
            "poziom_profesji": ["I", (1550, 460)], "sciezka": [c.sciezka_profesji, (600, 520)],
            "status": [c.status, (1950, 520)], "wiek": [c.wiek, (350, 580)],
            "wzrost": [c.wzrost, (900, 580)], "wlosy": [c.wlosy, (1400, 580)],
            "oczy": [c.oczy, (1950, 580)],
            "WW": [c.stats[0], (409, 830)], "US": [c.stats[1], (487, 830)],
            "S": [c.stats[2], (565, 830)], "Wt": [c.stats[3], (643, 830)],
            "I": [c.stats[4], (721, 830)], "Zw": [c.stats[5], (799, 830)],
            "Zr": [c.stats[6], (877, 830)], "Int": [c.stats[7], (955, 830)],
            "SW": [c.stats[8], (1033, 830)], "Ogd": [c.stats[9], (1111, 830)],
            "szybkosc": [c.szybkosc, (1980, 1015)],
            "szybkosc1": [c.szybkosc * 2, (2140, 1015)],
            "szybkosc2": [c.szybkosc * 4, (2290, 1015)],
            "atletyka": [c.stats[5], (640, 1260)], "bron_b_p": [c.stats[0], (640, 1320)],
            "bron_b": [c.stats[0], (640, 1380)], "charyzma": [c.stats[9], (640, 1440)],
            "dowodzenie": [c.stats[9], (640, 1500)], "hazard": [c.stats[7], (640, 1560)],
            "intuicja": [c.stats[4], (640, 1620)], "jezdziectwo": [c.stats[5], (640, 1680)],
            "mocna_glowa": [c.stats[3], (640, 1740)], "nawigacja": [c.stats[4], (640, 1800)],
            "odpornosc": [c.stats[3], (640, 1860)], "opanowanie": [c.stats[8], (640, 1920)],
            "oswajanie": [c.stats[8], (640, 1980)], "percepcja": [c.stats[4], (1360, 1260)],
            "plotkowanie": [c.stats[9], (1360, 1320)], "powozenie": [c.stats[5], (1360, 1380)],
            "przekupstwo": [c.stats[9], (1360, 1440)], "skradanie": [c.stats[5], (1360, 1500)],
            "sztuka": [c.stats[6], (1360, 1560)], "sztuka_p": [c.stats[7], (1360, 1620)],
            "targowanie": [c.stats[9], (1360, 1680)], "unik": [c.stats[5], (1360, 1740)],
            "wioslarstwo": [c.stats[2], (1360, 1800)], "wspinaczka": [c.stats[2], (1360, 1860)],
            "wystepy": [c.stats[9], (1360, 1920)], "zastraszanie": [c.stats[2], (1360, 1980)],
        }
        for k, v in p.items():
            draw.text(v[1], str(v[0]), fill="black", font=font)

        for i in range(min(len(c.talenty), 8)):
            y = 2270 + i * 90
            name_lines = self.wrap_by_chars(c.talenty[i].split("\n")[0], 20)
            for idx, line in enumerate(name_lines[:2]):
                draw.text((210, y + (idx * 35 if len(name_lines) > 1 else 0)), line, fill="black", font=font)
            draw.text((610, y), "I", fill="black", font=font)
            desc_lines = self.wrap_by_chars(
                c.opisy_talentow[i] if i < len(c.opisy_talentow) else "", 35
            )
            for idx, line in enumerate(desc_lines[:2]):
                draw.text((700, y + idx * 35), line, fill="black", font=font)

    # ---------- WW1 ----------
    def _draw_ww1(self, draw, c, font, font_b, font_hp, font_small):
        bs, wt, sw = c.stats[2] // 10, c.stats[3], c.stats[8] // 10
        tw_b = wt // 10 if any("Twardziel" in t for t in c.talenty) else 0
        zyw = bs + (wt * 2) // 10 + sw + tw_b

        y_hp, step = 1385, 77
        draw.text((1855, y_hp), str(bs), fill="black", font=font_hp)
        draw.text((1855, y_hp + step), str((wt * 2) // 10), fill="black", font=font_hp)
        draw.text((1855, y_hp + 2 * step), str(sw), fill="black", font=font_hp)
        draw.text((1855, y_hp + 3 * step), str(tw_b) if tw_b > 0 else "-", fill="black", font=font_hp)
        draw.text((1855, y_hp + 4 * step), str(zyw), fill="black", font=font_hp)

        for i, (n, w) in enumerate(c.ekwipunek[:31]):
            y = 870 + i * 49
            draw.text((220, y), n, fill="black", font=font)
            draw.text((825, y), f"{w:.1f}", fill="black", font=font)

        if c.bron:
            n_full = f"{c.bron.get('n', '')} ({c.bron.get('rzadkosc', '')})"
            if len(n_full) > 30:
                idx = n_full.rfind(" ", 0, 30) or 30
                draw.text((220, 1950), n_full[:idx], fill="black", font=font)
                draw.text((220, 1985), n_full[idx:].strip(), fill="black", font=font)
            else:
                draw.text((220, 1950), n_full, fill="black", font=font)
            draw.text((815, 1950), str(c.bron.get("k", "")), fill="black", font=font_small)
            draw.text((1115, 1950), str(c.bron.get("z", "")), fill="black", font=font)
            draw.text((1350, 1950), str(c.bron.get("r", "")), fill="black", font=font)
            draw.text((1570, 1950), str(c.bron.get("cechy", "")), fill="black", font=font_small)

        if c.blogoslawienstwa and c.bog:
            y_m = 2545
            szcz = self._reg.get("modlitwy_szczegolowe", {})
            for b in c.blogoslawienstwa:
                if y_m > 3200:
                    break
                d = szcz.get(b, {})
                if not d:
                    continue
                draw.text((190, y_m), d.get("nazwa", b)[:28], fill="black", font=font)
                draw.text((720, y_m), str(d.get("pc", "-")), fill="black", font=font)
                draw.text((900, y_m), str(d.get("zasieg", "-")), fill="black", font=font)
                draw.text((1080, y_m), str(d.get("cel", "-")), fill="black", font=font)
                draw.text((1240, y_m), str(d.get("czas", "-")), fill="black", font=font)
                draw.text((1410, y_m), str(d.get("efekt_krotki", "-")), fill="black", font=font)
                y_m += 58

    # ---------- WW2 ----------
    def _draw_ww2(self, draw, c, font, font_b, font_hp):
        max_w = 2000
        y = 220
        cechy_o = self._reg.get("cechy_oreza", {})

        # Nagłówek BROŃ
        self._draw_styled(draw, 220, y, "BROŃ", size=40, bold=True)
        y += 60
        if c.bron:
            self._draw_styled(draw, 220, y,
                f"Nazwa: {c.bron.get('n', '')} ({c.bron.get('rzadkosc', '')})",
                size=33, bold=True)
            y += 45
            for cx in c.bron.get("cechy", "").split(", "):
                if not cx.strip():
                    continue
                opis = cechy_o.get(cx.strip(), "Brak opisu.")
                # rysujemy kropkę + pogrubioną nazwę cechy + opis
                self._draw_styled(draw, 240, y, "•", size=33, bold=True)
                self._draw_styled(draw, 260, y, f"{cx.strip()}:", size=33, bold=True)
                prefix_w = self._font(33).getlength(f"{cx.strip()}:")
                # opis zawijany od pozycji po nazwie
                remaining = self._font(33).getlength(str(opis))
                avail_first = max_w - (260 - 240) - prefix_w
                if remaining <= avail_first:
                    self._draw_styled(draw, 260 + prefix_w + 8, y, opis, size=33)
                    y += 40
                else:
                    words = opis.split()
                    line = ""
                    first = True
                    x_start = 260 + prefix_w + 8
                    for w in words:
                        test = (line + " " + w).strip()
                        if self._font(33).getlength(test) <= (max_w - (x_start - 240) if first else max_w - 20):
                            line = test
                        else:
                            if line:
                                self._draw_styled(draw, x_start if first else 260, y, line, size=33)
                                y += 40
                                first = False
                                line = w
                            else:
                                line = w
                    if line:
                        self._draw_styled(draw, x_start if first else 260, y, line, size=33)
                        y += 40
            y += 20

        # Nagłówek TALENTY
        self._draw_styled(draw, 220, y, "TALENTY", size=40, bold=True)
        y += 60
        wszystkie = {**self._reg.get("talenty", {}), **self._reg.get("talenty_profesji", {})}
        for t in c.talenty:
            key = t.split("\n")[0].strip()
            val = wszystkie.get(key, "Brak opisu.")
            opis = val.get("pelny", str(val)) if isinstance(val, dict) else str(val)
            # kropka + pogrubiona nazwa + opis
            self._draw_styled(draw, 240, y, "•", size=33, bold=True)
            self._draw_styled(draw, 260, y, f"{key}:", size=33, bold=True)
            prefix_w = self._font(33).getlength(f"{key}:")
            x_start = 260 + prefix_w + 8
            words = str(opis).split()
            line = ""
            first = True
            for w in words:
                test = (line + " " + w).strip()
                avail = (max_w - (x_start - 240)) if first else (max_w - 20)
                if self._font(33).getlength(test) <= avail:
                    line = test
                else:
                    if line:
                        self._draw_styled(draw, x_start if first else 260, y, line, size=33)
                        y += 40
                        first = False
                        line = w
                    else:
                        line = w
            if line:
                self._draw_styled(draw, x_start if first else 260, y, line, size=33)
                y += 40
        y += 40

        if c.bog and c.blogoslawienstwa:
            self._draw_styled(draw, 220, y, f"BŁOGOSŁAWIEŃSTWA ({c.bog})", size=40, bold=True)
            y += 60
            szcz = self._reg.get("modlitwy_szczegolowe", {})
            for b in c.blogoslawienstwa:
                d = szcz.get(b, {})
                nazwa = d.get("nazwa", b)
                opis = d.get("opis", "Brak opisu.")
                self._draw_styled(draw, 240, y, "•", size=33, bold=True)
                self._draw_styled(draw, 260, y, f"{nazwa}:", size=33, bold=True)
                prefix_w = self._font(33).getlength(f"{nazwa}:")
                x_start = 260 + prefix_w + 8
                words = str(opis).split()
                line = ""
                first = True
                for w in words:
                    test = (line + " " + w).strip()
                    avail = (max_w - (x_start - 240)) if first else (max_w - 20)
                    if self._font(33).getlength(test) <= avail:
                        line = test
                    else:
                        if line:
                            self._draw_styled(draw, x_start if first else 260, y, line, size=33)
                            y += 40
                            first = False
                            line = w
                        else:
                            line = w
                if line:
                    self._draw_styled(draw, x_start if first else 260, y, line, size=33)
                    y += 40
            y += 40

        self._draw_styled(draw, 220, y, "HISTORIA POSTACI", size=40, bold=True)
        y += 60
        y = self._draw_markdown(draw, c.historia, 220, y, max_w)

    # ---------- Markdown ----------
    def _draw_markdown(self, draw, text: str, x: int, y: int, max_w: int) -> int:
        blocks = MarkdownParser.parse(text)

        for b in blocks:
            if b.type == "hr":
                draw.line([(x, y + 10), (x + max_w, y + 10)], fill="black", width=2)
                y += 30
                continue

            if b.type == "h1":
                y = self._draw_runs(draw, b.runs, x, y, max_w, size=40, bold_all=True, line_h=45)
                y += 10
            elif b.type == "h2":
                y = self._draw_runs(draw, b.runs, x, y, max_w, size=36, bold_all=True, line_h=42)
                y += 8
            elif b.type == "h3":
                y = self._draw_runs(draw, b.runs, x, y, max_w, size=34, bold_all=True, line_h=40)
                y += 6
            elif b.type == "bullet":
                draw.ellipse([(x + 5, y + 12), (x + 14, y + 21)], fill="black")
                y = self._draw_runs(draw, b.runs, x + 30, y, max_w - 30, size=33, line_h=40)
            elif b.type == "numbered":
                self._draw_styled(draw, x, y, b.marker, size=33, bold=True)
                y = self._draw_runs(draw, b.runs, x + 50, y, max_w - 50, size=33, line_h=40)
            elif b.type == "quote":
                draw.line([(x + 5, y), (x + 5, y + 30)], fill="#666", width=3)
                y = self._draw_runs(draw, b.runs, x + 25, y, max_w - 25, size=33,
                                    line_h=40, color="#444")
            else:  # paragraph
                y = self._draw_runs(draw, b.runs, x, y, max_w, size=33, line_h=40)
                y += 5

        return y

    def _draw_runs(self, draw, runs, x, y, max_w, size=33, bold_all=False,
                   line_h=40, color="black"):
        """Rysuje fragmenty inline. bold_all=True wymusza pogrubienie (nagłówki)."""
        if not runs:
            return y

        tokens: list[tuple[str, bool, bool]] = []
        for run in runs:
            b = bold_all or run.bold
            for w in run.text.split(" "):
                if w == "":
                    continue
                tokens.append((w, b, run.italic))

        font = self._font(size)
        space_w = font.getlength(" ")
        curr_x = x

        for word, bold, italic in tokens:
            word_w = font.getlength(word) + (1 if bold else 0)
            if curr_x + word_w > x + max_w:
                y += line_h
                curr_x = x
            self._draw_styled(draw, curr_x, y, word, size, bold=bold,
                              italic=italic, color=color)
            curr_x += word_w + space_w

        return y + line_h