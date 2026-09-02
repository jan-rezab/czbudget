#!/usr/bin/env python3
"""Build truthful contract/event and city-project/payment timelines for Plzen."""

from __future__ import annotations

import gzip
import json
import math
import re
import statistics
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any


WEB = Path(__file__).resolve().parents[2]
CONTRACTS = WEB / "data/contracts/00075370.full.v1.json.gz"
CITY_PROJECTS = WEB / "data/contracts/00075370.plzen-projects.v1.json"
OUTPUT = WEB / "data/contracts/00075370.timeline.v1.json"

PROJECT_RE = re.compile(r"(?<![A-Z0-9])[0-9]{2}[A-Z]{4,8}[0-9]{2}(?![A-Z0-9])")
WORD_RE = re.compile(r"[a-z0-9]+")
STOP_WORDS = {
    "a", "akce", "anebo", "bez", "cast", "cislo", "dila", "dilo", "dodatek",
    "dodavka", "dokumentace", "etapa", "investicni", "mesta", "mesto", "na", "nad",
    "objednavka", "od", "o", "plzen", "plzni", "pod", "pro", "projekt", "projektova",
    "prace", "provedeni", "priprava", "ramcova", "realizace", "rekonstrukce", "smlouva",
    "sluzby", "stavba", "stavebni", "uprava", "upravy", "ul", "ulice", "v", "ve", "z",
}


def ascii_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    return "".join(char for char in normalized if not unicodedata.combining(char)).lower()


def tokens(value: str) -> set[str]:
    return {
        token for token in WORD_RE.findall(ascii_text(value))
        if token not in STOP_WORDS and (len(token) >= 3 or token.isdigit())
    }


def date_key(value: str | None, length: int) -> str | None:
    if not value or len(value) < length:
        return None
    return value[:length]


def valid_signature(value: str | None, latest_publication: str) -> bool:
    if not value:
        return False
    # A future signature is a source-data typo (one 2026 record says 2036). Keep
    # it in detail data, but never let it distort the chart.
    return "2016-01-01" <= value[:10] <= latest_publication[:10]


def amount(value: Any) -> float:
    try:
        number = float(value)
        return number if math.isfinite(number) else 0.0
    except (TypeError, ValueError):
        return 0.0


def project_supplier_ids(project: dict[str, Any]) -> set[str]:
    return {str(item["ico"]) for item in project.get("suppliers") or [] if item.get("ico")}


def project_candidates(contract: dict[str, Any], projects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    subject = contract.get("subject") or ""
    subject_tokens = tokens(subject)
    subject_norm = " ".join(sorted(subject_tokens))
    supplier_ids = {str(item["ico"]) for item in contract.get("suppliers") or [] if item.get("ico")}
    candidates = []

    codes = set(PROJECT_RE.findall(subject.upper()))
    for project in projects:
        code = str(project.get("code") or "").upper()
        project_tokens = project["_tokens"]
        intersection = subject_tokens & project_tokens
        project_coverage = len(intersection) / len(project_tokens) if project_tokens else 0
        union = subject_tokens | project_tokens
        jaccard = len(intersection) / len(union) if union else 0
        sequence = SequenceMatcher(None, subject_norm, project["_norm"]).ratio() if project["_norm"] else 0
        shared_supplier = bool(supplier_ids & project["_supplier_ids"])

        if code and code in codes:
            candidates.append({"project": project, "score": 1.0, "method": "project_code", "confidence": "verified", "evidence": [code]})
            continue

        lexical = 0.62 * project_coverage + 0.23 * jaccard + 0.15 * sequence
        if shared_supplier and len(intersection) >= 2 and project_coverage >= 0.34:
            score = min(0.98, 0.48 + lexical * 0.52)
            candidates.append({
                "project": project,
                "score": score,
                "method": "supplier_title",
                "confidence": "high" if project_coverage >= 0.60 else "medium",
                "evidence": sorted(intersection),
            })
        elif len(intersection) >= 3 and project_coverage >= 0.72 and lexical >= 0.58:
            candidates.append({
                "project": project,
                "score": min(0.89, lexical),
                "method": "title",
                "confidence": "medium",
                "evidence": sorted(intersection),
            })
    return sorted(candidates, key=lambda item: item["score"], reverse=True)


def match_contracts(contracts: list[dict[str, Any]], projects_raw: list[dict[str, Any]]) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    projects = []
    by_code: dict[str, dict[str, Any]] = {}
    by_supplier: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_token: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for raw in projects_raw:
        project = dict(raw)
        project["_tokens"] = tokens(project.get("title") or "")
        project["_norm"] = " ".join(sorted(project["_tokens"]))
        project["_supplier_ids"] = project_supplier_ids(project)
        projects.append(project)
        by_code[str(project.get("code") or "").upper()] = project
        for supplier_id in project["_supplier_ids"]:
            by_supplier[supplier_id].append(project)
        for token in project["_tokens"]:
            by_token[token].append(project)

    primary: dict[str, dict[str, Any]] = {}
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_id = {str(contract.get("id")): contract for contract in contracts if contract.get("id")}

    for contract in contracts:
        subject = contract.get("subject") or ""
        explicit = [by_code[code] for code in PROJECT_RE.findall(subject.upper()) if code in by_code]
        if explicit:
            candidate_projects = explicit
        else:
            pool: dict[str, dict[str, Any]] = {}
            for supplier in contract.get("suppliers") or []:
                for project in by_supplier.get(str(supplier.get("ico") or ""), []):
                    pool[project["code"]] = project
            for token in tokens(subject):
                for project in by_token.get(token, []):
                    pool[project["code"]] = project
            candidate_projects = list(pool.values())
        candidates = project_candidates(contract, candidate_projects)
        if not candidates:
            continue
        best = candidates[0]
        # When two text matches are essentially tied, keep the contract
        # unallocated. Exact project-code matches are never ambiguous.
        if best["method"] != "project_code" and len(candidates) > 1 and best["score"] - candidates[1]["score"] < 0.035:
            continue
        match = {
            "project_code": best["project"]["code"],
            "method": best["method"],
            "confidence": best["confidence"],
            "score": round(best["score"], 3),
            "evidence": best["evidence"],
        }
        primary[str(contract["id"])] = match

    # Addenda inherit a parent's already established project relationship.
    changed = True
    while changed:
        changed = False
        for contract_id, contract in by_id.items():
            if contract_id in primary:
                continue
            parent_id = str(contract.get("parent_contract_id") or "")
            if parent_id and parent_id in primary:
                parent = primary[parent_id]
                primary[contract_id] = {
                    "project_code": parent["project_code"],
                    "method": "parent_contract",
                    "confidence": parent["confidence"],
                    "score": parent["score"],
                    "evidence": [parent_id],
                }
                changed = True

    for contract_id, match in primary.items():
        contract = by_id[contract_id]
        grouped[match["project_code"]].append({
            "id": contract.get("id"),
            "subject": contract.get("subject"),
            "signed_at": contract.get("signed_at"),
            "published_at": contract.get("published_at"),
            "value_czk": contract.get("value_czk"),
            "suppliers": contract.get("suppliers") or [],
            "source_url": contract.get("source_url"),
            "parent_contract_id": contract.get("parent_contract_id"),
            **match,
        })
    for rows in grouped.values():
        rows.sort(key=lambda row: (row.get("signed_at") or "", row.get("published_at") or ""))
    return primary, grouped


def aggregate_contracts(contracts: list[dict[str, Any]], matches: dict[str, dict[str, Any]], latest_publication: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    monthly: dict[str, Counter] = defaultdict(Counter)
    annual: dict[str, Counter] = defaultdict(Counter)
    lags = []
    pre_register_signatures = 0
    future_signatures = 0

    for contract in contracts:
        value = contract.get("value_czk")
        published = contract.get("published_at")
        signed = contract.get("signed_at")
        matched = str(contract.get("id")) in matches

        for length, bucket in ((7, monthly), (4, annual)):
            key = date_key(published, length)
            if key:
                bucket[key]["published_count"] += 1
                if value is not None:
                    bucket[key]["published_known_count"] += 1
                    bucket[key]["published_value_czk"] += amount(value)
                if matched:
                    bucket[key]["matched_published_count"] += 1
                    bucket[key]["matched_published_value_czk"] += amount(value)

            if valid_signature(signed, latest_publication):
                key = date_key(signed, length)
                if key:
                    bucket[key]["signed_count"] += 1
                    if value is not None:
                        bucket[key]["signed_known_count"] += 1
                        bucket[key]["signed_value_czk"] += amount(value)
                    if matched:
                        bucket[key]["matched_signed_count"] += 1
                        bucket[key]["matched_signed_value_czk"] += amount(value)

        if signed and signed[:10] < "2016-01-01":
            pre_register_signatures += 1
        elif signed and signed[:10] > latest_publication[:10]:
            future_signatures += 1
        if signed and published and valid_signature(signed, latest_publication):
            try:
                lag = (datetime.fromisoformat(published).date() - datetime.fromisoformat(signed).date()).days
                if 0 <= lag <= 3650:
                    lags.append(lag)
            except ValueError:
                pass

    def rows(source: dict[str, Counter], key_name: str) -> list[dict[str, Any]]:
        return [{key_name: key, **dict(values)} for key, values in sorted(source.items())]

    quality = {
        "pre_register_signature_dates": pre_register_signatures,
        "future_signature_dates": future_signatures,
        "publication_lag_median_days": statistics.median(lags) if lags else None,
        "publication_lag_p90_days": sorted(lags)[round((len(lags) - 1) * 0.90)] if lags else None,
        "publication_lag_sample": len(lags),
    }
    return rows(monthly, "month"), rows(annual, "year"), quality


def build() -> dict[str, Any]:
    with gzip.open(CONTRACTS, "rt", encoding="utf-8") as stream:
        contract_source = json.load(stream)
    project_source = json.loads(CITY_PROJECTS.read_text(encoding="utf-8"))
    contracts = contract_source["contracts"]
    projects = project_source["projects"]
    latest_publication = max(str(row.get("published_at") or "") for row in contracts)
    matches, grouped = match_contracts(contracts, projects)
    monthly, annual, quality = aggregate_contracts(contracts, matches, latest_publication)

    paid_by_year: Counter = Counter()
    compact_projects = []
    listing_by_code: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in project_source["budget_rows"]:
        if row.get("detail_id"):
            listing_by_code[row["detail_id"]].append(row)

    for project in projects:
        project = dict(project)
        preparation_phases = [phase for phase in project.get("phases") or [] if phase.get("kind") == "preparation"]
        delivery_phases = [phase for phase in project.get("phases") or [] if phase.get("kind") == "delivery"]
        execution_phases = [phase for phase in delivery_phases if str(phase.get("stage") or "").upper() == "REALIZACE"] or delivery_phases
        project["preparation_started_at"] = project.get("preparation_started_at") or min((phase["started_at"] for phase in preparation_phases if phase.get("started_at")), default=None)
        project["preparation_finished_at"] = project.get("preparation_finished_at") or max((phase["finished_at"] for phase in preparation_phases if phase.get("finished_at")), default=None)
        project["delivery_started_at"] = project.get("delivery_started_at") or min((phase["started_at"] for phase in execution_phases if phase.get("started_at")), default=None)
        project["delivery_finished_at"] = project.get("delivery_finished_at") or max((phase["finished_at"] for phase in execution_phases if phase.get("finished_at")), default=None)
        code = project.get("code")
        project_matches = grouped.get(code, [])
        for payment in project.get("paid_by_fiscal_year") or []:
            if payment.get("year") is not None:
                paid_by_year[str(payment["year"])] += amount(payment.get("amount_czk"))
        listing = sorted(listing_by_code.get(code, []), key=lambda row: row["year"])
        compact_projects.append({
            **project,
            "budget_by_year": [
                {
                    "year": row["year"],
                    "approved_czk": amount(row.get("approved_thousand_czk")) * 1000,
                    "adjusted_czk": amount(row.get("adjusted_thousand_czk")) * 1000,
                    "actual_czk": amount(row.get("actual_thousand_czk")) * 1000,
                    "department": row["path"][0] if row.get("path") else None,
                    "area": row["path"][-2] if len(row.get("path") or []) > 1 else None,
                }
                for row in listing
            ],
            "matched_contracts": project_matches,
            "match_summary": {
                "contracts": len(project_matches),
                "known_value_czk": sum(amount(row.get("value_czk")) for row in project_matches if row.get("value_czk") is not None),
                "verified": sum(row["confidence"] == "verified" for row in project_matches),
                "high": sum(row["confidence"] == "high" for row in project_matches),
                "medium": sum(row["confidence"] == "medium" for row in project_matches),
            },
        })

    compact_projects.sort(key=lambda project: amount(project.get("paid_czk")), reverse=True)
    annual_map = {row["year"]: row for row in annual}
    for year, paid in paid_by_year.items():
        annual_map.setdefault(year, {"year": year})["tracked_project_paid_czk"] = paid
    annual = [annual_map[key] for key in sorted(annual_map)]

    method_counts = Counter(match["method"] for match in matches.values())
    confidence_counts = Counter(match["confidence"] for match in matches.values())
    matched_known_value = sum(
        amount(contract.get("value_czk")) for contract in contracts
        if contract.get("value_czk") is not None and str(contract.get("id")) in matches
    )
    return {
        "schema_version": "1.0.0",
        "generated_at": project_source.get("generated_at"),
        "entity": contract_source.get("entity"),
        "period": {"contracts_from": "2016-07", "contracts_to": latest_publication[:7], "city_projects_from": 2018, "city_projects_to": 2026},
        "sources": {
            "contracts": contract_source.get("source"),
            "city_projects": project_source.get("source"),
        },
        "definitions": {
            "contract_value": "Value stated in the register, assigned only to its signature or publication event; never spread across fiscal years.",
            "tracked_project_paid": "Cash paid by fiscal year for the 555 MMP construction-investment projects exposed by the city application; not all city expenditure.",
            "project_match": "One best project per contract, using explicit project code or conservative supplier/title evidence. Medium matches remain visibly labelled estimates.",
        },
        "summary": {
            "contracts": len(contracts),
            "matched_contracts": len(matches),
            "matched_contract_share": len(matches) / len(contracts),
            "matched_known_value_czk": matched_known_value,
            "projects": len(projects),
            "projects_with_contracts": len(grouped),
            "tracked_project_paid_czk": sum(paid_by_year.values()),
            "match_methods": dict(method_counts),
            "match_confidence": dict(confidence_counts),
            "data_quality": quality,
        },
        "contract_activity_monthly": monthly,
        "annual_comparison": annual,
        "projects": compact_projects,
    }


if __name__ == "__main__":
    payload = build()
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps(payload["summary"], ensure_ascii=False))
