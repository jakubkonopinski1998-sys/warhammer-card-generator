"""Losowanie postaci."""
import random as rd

from src.domain.character import Character
from src.services.data_loader import DataRegistry


class CharacterGenerator:
    def __init__(self, registry: DataRegistry, rng: rd.Random | None = None):
        self._reg = registry
        self._rng = rng or rd.Random()

    @staticmethod
    def clamp(v: int) -> int:
        return max(10, min(95, v))

    def random(self, plec: str = "M") -> Character:
        c = Character(plec=plec)
        c.imie = self._rng.choice(self._reg["imiona_m" if plec == "M" else "imiona_k"])
        c.wlosy = self._rng.choice(self._reg["wlosy"])
        c.oczy = self._rng.choice(self._reg["oczy"])

        roll = self._rng.randint(1, 100)
        if roll < 90: c.rasa = "Człowiek"
        elif roll < 95: c.rasa = "Niziołek"
        elif roll < 99: c.rasa = "Krasnolud"
        elif roll == 99: c.rasa = "Leśny Elf"
        else: c.rasa = "Wysoki Elf"

        rasa = self._reg["rasy"][c.rasa]
        c.szybkosc = rasa["szybkosc"]
        c.wzrost = self._rng.randint(*rasa["wzrost"])
        c.wiek = self._rng.randint(*rasa["wiek"])
        c.stats = [
            self.clamp(rasa["cechy"][i] + self._rng.randint(2, 20))
            for i in range(10)
        ]

        c.klasa = self._rng.choice(list(self._reg["profesje"].keys()))
        c.sciezka_profesji = self._rng.choice(self._reg["profesje"][c.klasa])

        statusy = {
            "Uczeni": f"Brąz {self._rng.randint(2, 5)}",
            "Mieszcanie": f"Brąz {self._rng.randint(1, 5)}",
            "Dworzanie": f"Srebro {self._rng.randint(1, 3)}",
            "Pospólstwo": f"Brąz {self._rng.randint(1, 3)}",
            "Wędrowcy": f"Brąz {self._rng.randint(1, 5)}",
            "Wodniacy": f"Brąz {self._rng.randint(2, 5)}",
            "Łotrzykowie": f"Brąz {self._rng.randint(3, 5)}",
            "Wojownicy": f"Srebro {self._rng.randint(1, 2)}",
        }
        c.status = statusy.get(c.klasa, "Brąz 1")

        wszystkie = {**self._reg.get("talenty", {}), **self._reg.get("talenty_profesji", {})}
        if wszystkie:
            wybrane = self._rng.sample(list(wszystkie.keys()), min(2, len(wszystkie)))
            c.talenty = wybrane
            c.opisy_talentow = [
                wszystkie[t].get("skrot", wszystkie[t].get("pelny", ""))
                if isinstance(wszystkie[t], dict) else str(wszystkie[t])
                for t in wybrane
            ]
        return c