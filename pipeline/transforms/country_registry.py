"""Resolve any country alias to the canonical form (B2).

The country dimension has historically been written six different ways across the published
artifacts. The entity registry records every alias form actually in use, so a producer can
canonicalise on write instead of a human reconciling spellings afterwards.

Canonical form is ISO alpha-3 (consolidated decision 3).

    from country_registry import to_alpha3
    to_alpha3("CZ")   -> "CZE"
    to_alpha3("cz")   -> "CZE"
    to_alpha3("CZE")  -> "CZE"

Producers should call this at the point they emit `country_code` into a published artifact,
never on the source registries, which legitimately record whatever form the upstream uses.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

REGISTRY = Path(__file__).resolve().parents[2] / "data" / "registry" / "countries.v1.json"


class UnknownCountry(KeyError):
    """Raised when a value cannot be resolved. Guessing is worse than failing loudly."""


@lru_cache(maxsize=1)
def _alias_index() -> dict[str, str]:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    index: dict[str, str] = {}
    for country in registry["countries"]:
        canonical = country["canonical"]
        index[canonical.upper()] = canonical
        for alias in country["aliases"].values():
            if alias:
                index[str(alias).upper()] = canonical
    return index


def to_alpha3(value: str | None, *, default: str | None = None) -> str | None:
    """Canonicalise one country value. Returns `default` if given, else raises."""
    if value is None:
        return default
    resolved = _alias_index().get(str(value).strip().upper())
    if resolved:
        return resolved
    if default is not None:
        return default
    raise UnknownCountry(
        f"{value!r} does not resolve against {REGISTRY.name}. "
        "Add it to the registry rather than special-casing it here."
    )


@lru_cache(maxsize=1)
def _alpha2_index() -> dict[str, str]:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    return {
        c["canonical"]: c["aliases"]["alpha2"]
        for c in registry["countries"]
        if c["aliases"].get("alpha2")
    }


def to_alpha2(value: str | None, *, default: str | None = None) -> str | None:
    """The ISO alpha-2 form, for display APIs that require it.

    `Intl.DisplayNames({type: "region"})` and the flag assets both key on alpha-2 and throw
    or miss on alpha-3, so a published artifact carrying a canonical `country_code` should
    carry this alongside it rather than making every consumer re-derive it.
    """
    alpha3 = to_alpha3(value, default=None) if value is not None else None
    if alpha3 is None:
        if default is not None:
            return default
        raise UnknownCountry(f"{value!r} does not resolve to an alpha-2 form")
    return _alpha2_index().get(alpha3, default)


def is_canonical(value: str | None) -> bool:
    return bool(value) and to_alpha3(value, default="") == value
