#!/usr/bin/env python3
import csv, hashlib, io, json
from collections import Counter
import requests

URL = "https://www.berlin.de/sen/finanzen/service/daten/csv-opendata_doppelhaushalt_2024_2025.csv"

response = requests.get(URL, timeout=120)
response.raise_for_status()
body = response.content
text = body.decode("cp1252")
dialect = csv.Sniffer().sniff(text[:20000], delimiters=";,\t,")
reader = csv.DictReader(io.StringIO(text), dialect=dialect)
rows = list(reader)
header = reader.fieldnames
sample = rows[:3]
print(json.dumps({
    "official_url": URL,
    "bytes": len(body),
    "sha256": hashlib.sha256(body).hexdigest(),
    "delimiter": dialect.delimiter,
    "header": header,
    "sample": sample,
    "rows": len(rows),
    "years": Counter(row["Jahr"] for row in rows),
    "amount_types": Counter(row["BetragTyp"] for row in rows),
    "title_types": Counter(row["Titelart"] for row in rows),
}, ensure_ascii=False))
