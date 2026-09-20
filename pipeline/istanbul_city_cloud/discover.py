#!/usr/bin/env python3
"""Probe official İBB and national sources for structured municipal accounts."""
import concurrent.futures
import json
import re
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

URLS = [
    "https://data.ibb.gov.tr/api/3/action/package_search?q=b%C3%BCt%C3%A7e",
    "https://data.ibb.gov.tr/api/3/action/package_show?id=b977ab27-7f32-4c37-ad79-756fccf05ebc",
    "https://ibb.istanbul/ibb/butce-ve-yatirimlar/",
    "https://muhasebat.hmb.gov.tr/genel.yonetim.butce.istatistikleri",
    "https://belediye.gov.tr/",
]
PATTERN = re.compile(r"b[üu]t[cç]e|kesin|hesap|gider|gelir|harcama|download|\.csv|\.xlsx?|\.json|api", re.I)


def probe(url):
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; PublicSpendingData/1.0)"})
    try:
        response = session.get(url, timeout=90)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        if "json" in content_type:
            value = response.json()
            return {"requested_url": url, "final_url": response.url, "status": response.status_code, "content_type": content_type, "json": value}
        soup = BeautifulSoup(response.text, "html.parser")
        links = []
        for node in soup.find_all("a", href=True):
            text = node.get_text(" ", strip=True)
            href = urljoin(response.url, node["href"])
            if PATTERN.search(text) or PATTERN.search(href):
                links.append({"text": text, "url": href})
        return {"requested_url": url, "final_url": response.url, "status": response.status_code, "content_type": content_type, "bytes": len(response.content), "title": soup.title.get_text(" ", strip=True) if soup.title else None, "relevant_links": links[:500]}
    except Exception as exc:
        return {"requested_url": url, "error": f"{type(exc).__name__}: {exc}"}


with concurrent.futures.ThreadPoolExecutor(max_workers=len(URLS)) as pool:
    print(json.dumps(list(pool.map(probe, URLS)), ensure_ascii=False))
