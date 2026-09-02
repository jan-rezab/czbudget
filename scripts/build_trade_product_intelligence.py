#!/usr/bin/env python3
"""Build the public product-intelligence snapshot from BigQuery views."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "data/trade/product-intelligence.v1.json"
DEFAULT_PROJECT = "czbudget-janrezab"
DEFAULT_DATASET = "budget_detail"

AREA_METADATA = {
    "SMARTPHONES": {"label": "Smartphones", "hs": "851713", "definition": "HS6 851713"},
    "PASSENGER_VEHICLES": {"label": "Passenger vehicles", "hs": "8703", "definition": "HS4 8703 · detailed HS6 lines"},
    "MEDICAMENTS": {"label": "Medicaments", "hs": "3004", "definition": "HS4 3004 · detailed HS6 lines"},
    "INTEGRATED_CIRCUITS": {"label": "Integrated circuits", "hs": "8542", "definition": "HS4 8542 · detailed HS6 lines"},
    "ELECTRIC_BATTERIES": {"label": "Electric batteries", "hs": "8507", "definition": "HS4 8507 · detailed HS6 lines"},
}
AREA_ORDER = list(AREA_METADATA)
ROLLUPS = ("COUNTRY", "EU27_AGGREGATED")


def table(project: str, dataset: str, name: str) -> str:
    return f"`{project}.{dataset}.{name}`"


def query_rows(project: str, sql: str) -> list[dict]:
    command = [
        "bq",
        "query",
        f"--project_id={project}",
        "--location=EU",
        "--use_legacy_sql=false",
        "--format=json",
        "--max_rows=100000",
        sql,
    ]
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def number(value):
    if value is None:
        return None
    return float(value)


def integer(value):
    if value is None:
        return None
    return int(value)


def build(project: str, dataset: str) -> dict:
    flow_view = table(project, dataset, "trade_business_area_flow_edges")
    position_view = table(project, dataset, "trade_business_area_positions")
    product_edge_view = table(project, dataset, "trade_product_import_flow_edges")

    summary_sql = f"""
      SELECT
        period_start,
        period,
        business_area_code,
        ANY_VALUE(business_area_name) AS business_area_name,
        SUM(primary_value_usd) AS primary_value_usd,
        COUNT(*) AS observed_route_count,
        COUNT(DISTINCT origin_geo_code) AS observed_origin_count,
        COUNT(DISTINCT market_geo_code) AS observed_market_count,
        MAX(source_last_released) AS source_last_released,
        MAX(retrieved_at) AS retrieved_at
      FROM {flow_view}
      WHERE period_start >= DATE '1900-01-01'
        AND frequency = 'A'
        AND geography_rollup = 'COUNTRY'
      GROUP BY period_start, period, business_area_code
      ORDER BY business_area_code, period_start
    """
    positions_sql = f"""
      SELECT
        period_start,
        period,
        business_area_code,
        geography_rollup,
        geography_role,
        geography_code,
        geography_name,
        counterparty_count,
        primary_value_usd,
        observed_value_share,
        observed_value_rank
      FROM {position_view}
      WHERE period_start >= DATE '1900-01-01'
        AND frequency = 'A'
        AND observed_value_rank <= 8
      ORDER BY
        business_area_code,
        period_start,
        geography_rollup,
        geography_role,
        observed_value_rank,
        geography_code
    """
    flows_sql = f"""
      WITH edges AS (
        SELECT
          period_start,
          period,
          business_area_code,
          geography_rollup,
          origin_geo_code,
          origin_geo_name,
          market_geo_code,
          market_geo_name,
          primary_value_usd
        FROM {flow_view}
        WHERE period_start >= DATE '1900-01-01'
          AND frequency = 'A'
      ), origin_totals AS (
        SELECT
          period_start,
          business_area_code,
          geography_rollup,
          origin_geo_code,
          SUM(primary_value_usd) AS primary_value_usd
        FROM edges
        GROUP BY period_start, business_area_code, geography_rollup, origin_geo_code
      ), ranked_origins AS (
        SELECT
          period_start,
          business_area_code,
          geography_rollup,
          origin_geo_code,
          DENSE_RANK() OVER (
            PARTITION BY period_start, business_area_code, geography_rollup
            ORDER BY primary_value_usd DESC
          ) AS origin_rank
        FROM origin_totals
      ), market_totals AS (
        SELECT
          period_start,
          business_area_code,
          geography_rollup,
          market_geo_code,
          SUM(primary_value_usd) AS primary_value_usd
        FROM edges
        GROUP BY period_start, business_area_code, geography_rollup, market_geo_code
      ), ranked_markets AS (
        SELECT
          period_start,
          business_area_code,
          geography_rollup,
          market_geo_code,
          DENSE_RANK() OVER (
            PARTITION BY period_start, business_area_code, geography_rollup
            ORDER BY primary_value_usd DESC
          ) AS market_rank
        FROM market_totals
      ), mapped AS (
        SELECT
          edge.period_start,
          edge.period,
          edge.business_area_code,
          edge.geography_rollup,
          IF(origin.origin_rank <= 6 OR edge.origin_geo_code = 'EU27', edge.origin_geo_code, 'OTHER_ORIGINS') AS origin_code,
          IF(origin.origin_rank <= 6 OR edge.origin_geo_code = 'EU27', edge.origin_geo_name, 'Other origins') AS origin_name,
          IF(market.market_rank <= 8 OR edge.market_geo_code = 'EU27', edge.market_geo_code, 'OTHER_MARKETS') AS market_code,
          IF(market.market_rank <= 8 OR edge.market_geo_code = 'EU27', edge.market_geo_name, 'Other observed markets') AS market_name,
          edge.primary_value_usd
        FROM edges AS edge
        JOIN ranked_origins AS origin
          ON origin.period_start = edge.period_start
         AND origin.business_area_code = edge.business_area_code
         AND origin.geography_rollup = edge.geography_rollup
         AND origin.origin_geo_code = edge.origin_geo_code
        JOIN ranked_markets AS market
          ON market.period_start = edge.period_start
         AND market.business_area_code = edge.business_area_code
         AND market.geography_rollup = edge.geography_rollup
         AND market.market_geo_code = edge.market_geo_code
      )
      SELECT
        period_start,
        period,
        business_area_code,
        geography_rollup,
        origin_code,
        ANY_VALUE(origin_name) AS origin_name,
        market_code,
        ANY_VALUE(market_name) AS market_name,
        SUM(primary_value_usd) AS primary_value_usd
      FROM mapped
      GROUP BY
        period_start,
        period,
        business_area_code,
        geography_rollup,
        origin_code,
        market_code
      HAVING primary_value_usd > 0
      ORDER BY business_area_code, period_start, geography_rollup, primary_value_usd DESC
    """
    coverage_sql = f"""
      WITH markets AS (
        SELECT DISTINCT
          period_start,
          period,
          market_iso3,
          market_crawl_status
        FROM {product_edge_view}
        WHERE period_start >= DATE '1900-01-01'
          AND frequency = 'A'
          AND (
            product_code = '851713'
            OR STARTS_WITH(product_code, '8703')
            OR STARTS_WITH(product_code, '8542')
            OR STARTS_WITH(product_code, '3004')
            OR STARTS_WITH(product_code, '8507')
          )
      )
      SELECT
        period_start,
        period,
        COUNT(DISTINCT market_iso3) AS observed_market_count,
        COUNT(DISTINCT IF(market_crawl_status = 'loaded', market_iso3, NULL)) AS loaded_market_count,
        COUNT(DISTINCT IF(market_crawl_status = 'partial', market_iso3, NULL)) AS partial_market_count
      FROM markets
      GROUP BY period_start, period
      ORDER BY period_start
    """

    summaries = query_rows(project, summary_sql)
    positions = query_rows(project, positions_sql)
    flows = query_rows(project, flows_sql)
    coverage = query_rows(project, coverage_sql)

    areas: dict[str, dict] = {}
    for code in AREA_ORDER:
        metadata = AREA_METADATA[code]
        areas[code] = {
            "code": code,
            "label": metadata["label"],
            "hs": metadata["hs"],
            "definition": metadata["definition"],
            "periods": {},
        }

    for row in summaries:
        code = row["business_area_code"]
        if code not in areas:
            continue
        period = row["period"]
        areas[code]["periods"][period] = {
            "period": period,
            "period_start": row["period_start"],
            "primary_value_usd": number(row["primary_value_usd"]),
            "observed_route_count": integer(row["observed_route_count"]),
            "observed_origin_count": integer(row["observed_origin_count"]),
            "observed_market_count": integer(row["observed_market_count"]),
            "source_last_released": row["source_last_released"],
            "retrieved_at": row["retrieved_at"],
            "geographies": {
                rollup: {"origins": [], "markets": [], "flows": []}
                for rollup in ROLLUPS
            },
        }

    role_key = {
        "ORIGIN_SUPPLY_PROXY": "origins",
        "IMPORT_MARKET_DEMAND_PROXY": "markets",
    }
    for row in positions:
        period_data = areas.get(row["business_area_code"], {}).get("periods", {}).get(row["period"])
        if not period_data or row["geography_rollup"] not in ROLLUPS:
            continue
        period_data["geographies"][row["geography_rollup"]][role_key[row["geography_role"]]].append({
            "code": row["geography_code"],
            "name": row["geography_name"],
            "counterparty_count": integer(row["counterparty_count"]),
            "primary_value_usd": number(row["primary_value_usd"]),
            "observed_value_share": number(row["observed_value_share"]),
            "observed_value_rank": integer(row["observed_value_rank"]),
        })

    for row in flows:
        period_data = areas.get(row["business_area_code"], {}).get("periods", {}).get(row["period"])
        if not period_data or row["geography_rollup"] not in ROLLUPS:
            continue
        period_data["geographies"][row["geography_rollup"]]["flows"].append({
            "origin_code": row["origin_code"],
            "origin_name": row["origin_name"],
            "market_code": row["market_code"],
            "market_name": row["market_name"],
            "primary_value_usd": number(row["primary_value_usd"]),
        })

    public_areas = []
    for code in AREA_ORDER:
        area = areas[code]
        if not area["periods"]:
            raise RuntimeError(f"No annual data returned for {code}")
        periods = [area["periods"][key] for key in sorted(area["periods"])]
        for period_data in periods:
            expected_total = period_data["primary_value_usd"]
            for rollup in ROLLUPS:
                geography = period_data["geographies"][rollup]
                if not geography["origins"] or not geography["markets"] or not geography["flows"]:
                    raise RuntimeError(f"Incomplete {rollup} payload for {code} {period_data['period']}")
                flow_total = sum(row["primary_value_usd"] for row in geography["flows"])
                tolerance = max(1.0, expected_total * 1e-9)
                if abs(flow_total - expected_total) > tolerance:
                    raise RuntimeError(
                        f"Flow total mismatch for {code} {period_data['period']} {rollup}: "
                        f"{flow_total} != {expected_total}"
                    )
        public_areas.append({
            "code": area["code"],
            "label": area["label"],
            "hs": area["hs"],
            "definition": area["definition"],
            "periods": periods,
        })

    coverage_rows = [{
        "period": row["period"],
        "period_start": row["period_start"],
        "observed_market_count": integer(row["observed_market_count"]),
        "loaded_market_count": integer(row["loaded_market_count"]),
        "partial_market_count": integer(row["partial_market_count"]),
    } for row in coverage]

    available_periods = sorted({
        period["period"]
        for area in public_areas
        for period in area["periods"]
    })
    return {
        "contract": "trade-product-intelligence.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "source": {
            "source_id": "un_comtrade",
            "publisher": "United Nations Statistics Division",
            "homepage": "https://comtrade.un.org/",
            "reporting_basis": "IMPORTER_REPORTED_ORIGIN",
            "warehouse_views": [
                f"{project}.{dataset}.trade_business_area_flow_edges",
                f"{project}.{dataset}.trade_business_area_positions",
            ],
        },
        "scope": {
            "frequency": "A",
            "classification": "HS 2022",
            "available_periods": available_periods,
            "geography_rollups": list(ROLLUPS),
            "eu27_treatment": "Member states are combined into EU-27 origin and market nodes; intra-EU trade is retained and explicitly represented.",
            "interpretation": "Origins are supply proxies and reporting import markets are demand proxies; neither is a direct factory-output or final-consumption measure.",
            "coverage": coverage_rows,
        },
        "business_areas": public_areas,
    }


def write_json(payload: dict, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=output.parent, delete=False) as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(output)
    output.chmod(0o644)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=os.getenv("BQ_PROJECT_ID", DEFAULT_PROJECT))
    parser.add_argument("--dataset", default=os.getenv("BQ_DATASET", DEFAULT_DATASET))
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    payload = build(args.project, args.dataset)
    write_json(payload, args.output)
    periods = ", ".join(payload["scope"]["available_periods"])
    print(f"Wrote {args.output} with {len(payload['business_areas'])} business areas and periods {periods}")


if __name__ == "__main__":
    main()
