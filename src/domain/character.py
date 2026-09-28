"""Model postaci — czysty dataclass, bez zależności od PIL/JSON."""
from dataclasses import dataclass, field


@dataclass
class Character:
    imie: str = ""
    plec: str = "M"
    rasa: str = ""
    klasa: str = ""
    sciezka_profesji: str = ""
    status: str = ""
    wiek: int = 0
    wzrost: int = 0
    wlosy: str = ""
    oczy: str = ""
    szybkosc: int = 0
    stats: list[int] = field(default_factory=lambda: [0] * 10)
    talenty: list[str] = field(default_factory=list)
    opisy_talentow: list[str] = field(default_factory=list)
    ekwipunek: list[tuple[str, float]] = field(default_factory=list)
    bron: dict | None = None
    historia: str = ""
    bog: str = ""
    blogoslawienstwa: list[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, d: dict) -> "Character":
        return cls(
            imie=d.get("imie", ""),
            plec=d.get("plec", "M"),
            rasa=d.get("rasa", ""),
            klasa=d.get("klasa", ""),
            sciezka_profesji=d.get("sciezka_profesji", ""),
            status=d.get("status", ""),
            wiek=int(d.get("wiek", 0) or 0),
            wzrost=int(d.get("wzrost", 0) or 0),
            wlosy=d.get("wlosy", ""),
            oczy=d.get("oczy", ""),
            szybkosc=int(d.get("szybkosc", 0) or 0),
            stats=list(d.get("stats", [0] * 10)),
            talenty=list(d.get("talenty", [])),
            opisy_talentow=list(d.get("opisy_talentow", [])),
            ekwipunek=[tuple(x) for x in d.get("ekwipunek", [])],
            bron=d.get("bron"),
            historia=d.get("historia", ""),
            bog=d.get("bog", ""),
            blogoslawienstwa=list(d.get("blogoslawienstwa", [])),
        )