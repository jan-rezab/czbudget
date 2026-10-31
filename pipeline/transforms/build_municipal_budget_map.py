#!/usr/bin/env python3
"""Build the Czech municipal budget map published on the homepage.

Joins ČÚZK RÚIAN municipality boundaries to the published PSD municipal snapshot
and the five-year (2021-2025) warehouse sums named in
pipeline/config/municipal-budget-map-inputs.v1.json. Every input is an immutable
raw object pinned by SHA-256; restore them into one directory and pass --inputs.

Per municipality (all PSD calculations, never source observations):
  o   operating balance 2021-25 / current revenue 2021-25, where current revenue is
      tax + non-tax revenue + current grants (41xx, consolidation items excluded)
      and current spending is class 5
  ob  operating balance 2021-25, CZK
  cx  capital spending (class 6) 2021-25, CZK
  cf  capital revenue + investment grants (42xx) 2021-25, CZK
  k   capital spending a year per resident: cx / 5 / mean mid-year population
  f   overall result 2021-25 / revenue 2021-25 (after consolidation)
  fb  overall result 2021-25, CZK
  m   cash at 31 Dec 2025 in months of 2025 spending (snapshot cash_to_expense x 12)
  cc  cash at 31 Dec 2025, CZK
The identity ob + cf - cx = fb is enforced for every municipality.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from decimal import Decimal
from pathlib import Path

WEB = Path(__file__).resolve().parents[2]
MANIFEST = WEB / "pipeline/config/municipal-budget-map-inputs.v1.json"
OUTPUT = WEB / "data/czech-municipal-budget-map.v1.json"
HISTORY_RELEASE = "cb5e6d60-fcf9-4c12-af75-1c59491114a1"
TRANSFER_RELEASE = "d5410309-fe00-413f-a082-a85041386efb"
WIDTH, PAD = 1000.0, 6
SMALL = {"nad", "pod", "u", "v", "ve", "na", "a", "při", "za", "mezi"}


class MapError(ValueError):
    """Raised when an input or the joined map violates the contract."""


def load_inputs(directory: Path, manifest: dict) -> dict[str, list]:
    by_role: dict[str, list] = {}
    for item in manifest["inputs"]:
        path = directory / item["name"]
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != item["sha256"] or len(raw) != item["bytes"]:
            raise MapError(f"{item['name']}: bytes do not match the pinned raw object")
        by_role.setdefault(item["role"], []).append(raw if item["role"] == "query" else json.loads(raw))
    return by_role


def tidy(name: str) -> str:
    if name != name.upper():
        return name
    words = re.split(r"(\s+|-)", name.lower())
    return "".join(w if (w in SMALL and i) else w[:1].upper() + w[1:] for i, w in enumerate(words))


def build(inputs: dict[str, list], manifest_sha: str) -> dict:
    state = inputs["state"][0]["features"][0]
    xs = [x for ring in state["geometry"]["rings"] for x, _ in ring]
    ys = [y for ring in state["geometry"]["rings"] for _, y in ring]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    k = (WIDTH - 2 * PAD) / (x1 - x0)
    height = round((y1 - y0) * k + 2 * PAD, 1)

    def proj(x, y):
        return round((x - x0) * k + PAD, 1), round((y1 - y) * k + PAD, 1)

    def fmt(v):
        s = f"{v:.1f}".rstrip("0").rstrip(".")
        if s.startswith("0."):
            s = s[1:]
        elif s.startswith("-0."):
            s = "-" + s[2:]
        return s or "0"

    def path(rings):
        out = []
        for ring in rings:
            pts = [proj(x, y) for x, y in ring]
            dedup = [pts[0]]
            for p in pts[1:]:
                if p != dedup[-1]:
                    dedup.append(p)
            if len(dedup) < 3:
                continue
            start = px, py = dedup[0]
            parts = []
            for x, y in dedup[1:]:
                dx, dy = fmt(round(x - px, 1)), fmt(round(y - py, 1))
                parts.append(dx + ("" if dy.startswith("-") else " ") + dy)
                px, py = x, y
            out.append(f"M{fmt(start[0])} {fmt(start[1])}l" + " ".join(parts).replace(" -", "-") + "z")
        return "".join(out)

    geo = {}
    # ArcGIS flags every full page; only the last page must be complete.
    pages = sorted(inputs["municipalities"], key=lambda page: len(page["features"]), reverse=True)
    if pages[-1].get("exceededTransferLimit"):
        raise MapError("RÚIAN municipality pages end before the last municipality")
    for page in pages:
        for feature in page["features"]:
            code = feature["attributes"]["kod"]
            if code in geo:
                raise MapError(f"duplicate RÚIAN municipality {code}")
            geo[code] = feature

    five = {r["national_id"]: r for r in inputs["five_year"][0]}
    snapshot = inputs["snapshot"][0]
    rows, seen = [], set()
    for m in snapshot["municipalities"]:
        code = m["territory"]["municipality_code"]
        feature = geo.get(code)
        if feature is None:
            raise MapError(f"{m['national_id']}: no RÚIAN boundary for municipality {code}")
        r = five.get(m["national_id"])
        if r is None or r["yrs"] != "5" or r["years_without_transfer_rows"] != "0":
            raise MapError(f"{m['national_id']}: incomplete 2021-2025 warehouse years")
        if r["history_run"] != HISTORY_RELEASE or r["transfer_run"] != TRANSFER_RELEASE:
            raise MapError(f"{m['national_id']}: input is not from the pinned warehouse releases")
        if Decimal(r["transfer_gap"]) != 0:
            raise MapError(f"{m['national_id']}: grants by type do not add up to transfer revenue")
        cur_rev, cur_exp = Decimal(r["cur_rev"]), Decimal(r["cur_exp"])
        cap_fund, cap_exp = Decimal(r["cap_fund"]), Decimal(r["cap_exp"])
        bal, rev = Decimal(r["bal"]), Decimal(r["rev"])
        op = cur_rev - cur_exp
        if abs(op + cap_fund - cap_exp - bal) > Decimal("0.05"):
            raise MapError(f"{m['national_id']}: operating + capital funding - capital spending != overall result")
        pop = (m.get("population") or {}).get("value")
        avg_pop = float(r["pop"]) if r["pop"] is not None else None
        ratios, amounts = m["ratios"], m["amounts"]
        rows.append({
            "c": code,
            "i": m["national_id"],
            "n": tidy(m["short_name"]),
            "r": m["territory"]["region_name"],
            "s": m["seo"]["path"],
            "p": pop,
            "o": round(float(op / cur_rev), 4) if cur_rev > 0 else None,
            "ob": round(float(op)),
            "cx": round(float(cap_exp)),
            "cf": round(float(cap_fund)),
            "k": round(float(cap_exp) / 5 / avg_pop) if avg_pop and r["pop_null"] == "0" else None,
            "f": round(float(bal / rev), 4) if rev > 0 else None,
            "fb": round(float(bal)),
            "m": round(ratios["cash_to_expense"] * 12, 2) if ratios.get("cash_to_expense") is not None else None,
            "cc": round(amounts["cash_current"]) if amounts.get("cash_current") is not None else None,
            "d": path(feature["geometry"]["rings"]),
        })
        seen.add(code)
    if len(rows) != len(five):
        raise MapError(f"snapshot has {len(rows)} municipalities, warehouse sums {len(five)}")
    unbudgeted = [{"c": c, "n": f["attributes"]["nazev"], "d": path(f["geometry"]["rings"])}
                  for c, f in sorted(geo.items()) if c not in seen]
    regions = [{"n": f["attributes"]["nazev"], "d": path(f["geometry"]["rings"])}
               for f in sorted(inputs["regions"][0]["features"], key=lambda f: f["attributes"]["nazev"])]
    rows.sort(key=lambda row: row["c"])
    return {
        "schema_version": 1,
        "dataset_id": "CZ_MUNICIPAL_BUDGET_MAP_2021_2025",
        "inputs_manifest_sha256": manifest_sha,
        "releases": {"history": HISTORY_RELEASE, "transfers": TRANSFER_RELEASE,
                     "snapshot_fiscal_year": snapshot.get("fiscal_year", 2025)},
        "period": "2021-2025",
        "currency": "CZK",
        "viewBox": f"0 0 {WIDTH:g} {height:g}",
        "municipalities": rows,
        "unbudgeted": unbudgeted,
        "regions": regions,
        "state": path(state["geometry"]["rings"]),
    }


def serialise(doc: dict) -> bytes:
    return (json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--inputs", type=Path, required=True, help="directory holding the restored raw inputs")
    parser.add_argument("--check", action="store_true", help="rebuild and byte-compare the committed output")
    args = parser.parse_args()
    manifest_raw = MANIFEST.read_bytes()
    doc = build(load_inputs(args.inputs, json.loads(manifest_raw)), hashlib.sha256(manifest_raw).hexdigest())
    data = serialise(doc)
    if args.check:
        if OUTPUT.read_bytes() != data:
            raise SystemExit(f"{OUTPUT.relative_to(WEB)} differs from a rebuild of the pinned inputs")
        print("check ok", hashlib.sha256(data).hexdigest())
        return
    OUTPUT.write_bytes(data)
    rows = doc["municipalities"]
    print(f"{len(rows)} municipalities, {len(doc['unbudgeted'])} without a budget, {len(doc['regions'])} regions,"
          f" {len(data):,} bytes, sha256 {hashlib.sha256(data).hexdigest()}")


if __name__ == "__main__":
    main()
