from src.services.data_loader import get_registry

def list_races(self) -> list[str]:
    return list(get_registry().get("rasy", {}).keys())

def list_professions(self) -> dict:
    return get_registry().get("profesje", {})