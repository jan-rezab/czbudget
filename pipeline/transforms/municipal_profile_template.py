"""Shared HTML shell for every generated international municipal profile.

Country importers own data normalization. This module owns the document
structure and loads the single municipal profile renderer used by every route.
"""

from __future__ import annotations

import html
import json


ORIGIN = "https://publicspendingdata.org"
ASSET_VERSION = "20260827-unified-municipal-profile"


def esc(value: object) -> str:
    return html.escape(str(value if value is not None else ""), quote=True)


def render_municipal_profile_shell(
    *,
    name: str,
    country_name: str,
    canonical_path: str,
    profile_data_path: str,
    source_url: str,
    default_language: str = "cs",
    history_data_path: str | None = None,
    page_title: str | None = None,
    page_description: str | None = None,
) -> str:
    """Return the common profile document; data determines capabilities."""
    title = page_title or f"{name} municipal finances — Public Spending Data"
    description = page_description or f"Official municipality-level finance profile for {name}, {country_name}."
    canonical = f"{ORIGIN}{canonical_path}"
    history_attribute = f' data-history-url="{esc(history_data_path)}"' if history_data_path else ""
    dataset = json.dumps({
        "@context": "https://schema.org",
        "@type": "Dataset",
        "name": title,
        "description": description,
        "url": canonical,
        "inLanguage": default_language,
        "spatialCoverage": {"@type": "AdministrativeArea", "name": name, "addressCountry": country_name},
        "distribution": {"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": profile_data_path},
    }, ensure_ascii=False, separators=(",", ":"))
    return f'''<!doctype html><html lang="{esc(default_language)}"><head><script src="/language-bootstrap.js?v=20260822-no-language-flash"></script><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)}</title><meta name="description" content="{esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="{esc(canonical)}"><link rel="alternate" hreflang="cs" href="{esc(canonical)}?lang=cs"><link rel="alternate" hreflang="en" href="{esc(canonical)}?lang=en"><meta property="og:type" content="website"><meta property="og:site_name" content="Public Spending Data"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{esc(canonical)}"><meta property="og:image" content="{ORIGIN}/assets/og.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{esc(title)}"><meta name="twitter:description" content="{esc(description)}"><meta name="twitter:image" content="{ORIGIN}/assets/og.png"><script type="application/ld+json">{dataset}</script><link rel="icon" href="../../../assets/favicon.svg"><link rel="stylesheet" href="../../../site-header.css?v=20260824-header-lockup" data-psd-site-header><link rel="stylesheet" href="../../../styles.css"><link rel="stylesheet" href="../../../chart-system.css"><link rel="stylesheet" href="../../../municipalities.css"><link rel="stylesheet" href="../../../municipal-benchmark-profile.css"><link rel="stylesheet" href="../../../municipal-expanded-profile.css?v={ASSET_VERSION}"><link rel="stylesheet" href="../../../global-footer.css"><script src="../../../global-nav.js?v=20260824-logo-120" defer></script><script src="../../../municipal-expanded-profile.js?v={ASSET_VERSION}" defer></script><script src="../../../global-footer.js" defer></script></head><body class="municipalities-page benchmark-profile expanded-profile" data-profile-url="{esc(profile_data_path)}" data-source="{esc(source_url)}"{history_attribute}><psd-site-header data-section="cities"></psd-site-header><main><section class="municipal-profile-loading" aria-live="polite">Loading municipal profile…</section></main><footer data-global-footer></footer></body></html>'''
