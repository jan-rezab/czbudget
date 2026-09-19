#!/usr/bin/env python3
"""Decompose cached OECD 2025 wage models; retain the wider NTCP boundary."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NTCP = "https://www.oecd.org/content/dam/oecd/en/topics/policy-issues/tax-policy/non-tax-compulsory-payments.pdf"
BASE = "https://www.oecd.org/en/publications/taxing-wages-2026_3a5169ef-en/full-report/"
NAMES = {"CZE": "Česko", "ESP": "Španělsko", "DEU": "Německo", "FRA": "Francie", "POL": "Polsko", "GBR": "Británie", "CHE": "Švýcarsko", "NLD": "Nizozemsko"}
# OECD NTCP Table 1, PDF page index 18, column 2: single, no children, AW100.
AUGMENTED = {"CZE": 41.2, "ESP": 41.4, "DEU": 49.3, "FRA": 47.2, "POL": 40.0, "GBR": 32.4, "CHE": 40.2, "NLD": 49.9}
raw = ROOT.parent / "data/source_cache/labour-tax-breakdown-2025/oecd-non-tax-compulsory-payments-2025.pdf"
source = ROOT / "data/oecd-key-metrics.v1.json"
original = json.loads(source.read_text())
records = []
for code, name in NAMES.items():
    matches = [s for s in original["countries"][code]["tax"]["labour"]["scenarios"]
               if s["household_type"] == "S_C0" and s["principal_income"] == "AW100"]
    assert len(matches) == 1 and matches[0]["year"] == 2025
    m = matches[0]["metrics"]
    tax, employee, employer = [m[k] for k in ("av_itr", "av_r_empee_ssc", "av_r_emper_ssc")]
    labour_cost = 100 + employer
    net = 100 - tax - employee
    reconstructed = (tax + employee + employer) / labour_cost * 100
    assert abs(reconstructed - m["av_tw"]) < .003, (code, reconstructed, m["av_tw"])
    records.append({
        "country": code, "name_cs": name,
        "per_100_gross_wage": {"income_tax": tax, "employee_contributions": employee,
                              "employer_contributions_and_payroll_taxes": employer,
                              "net_before_non_tax_payments": round(net, 6),
                              "labour_cost_before_non_tax_payments": labour_cost},
        "per_100_oecd_labour_cost": {"income_tax": round(tax / labour_cost * 100, 6),
                                    "employee_contributions": round(employee / labour_cost * 100, 6),
                                    "employer_contributions_and_payroll_taxes": round(employer / labour_cost * 100, 6),
                                    "net_before_non_tax_payments": round(net / labour_cost * 100, 6)},
        "oecd_tax_wedge_percent": m["av_tw"],
        "oecd_compulsory_payment_wedge_percent": AUGMENTED[code],
        "compulsory_payment_wedge_precision_decimals": 1,
        "unmodelled_occupational_insurance": code in {"CZE", "ESP", "DEU", "CHE"},
        "ntcp_source": {"url": NTCP, "table": 1, "pdf_page_index": 18, "column": 2},
    })

details = {
    "CZE": {
        "unit": "percent_of_gross_wage", "scope": "Běžný zaměstnanec v modelu OECD; pod stropem a bez zvláštních slev/rizikových profesí.",
        "source_urls": [BASE + "czechia_f8f85811.html", "https://www.cssz.gov.cz/-/prehled-nejdulezitejsich-udaju-pro-socialni-zabezpeceni-v-roce-2025"],
        "employee": {"pension": 6.5, "sickness": .6, "health": 4.5},
        "employer": {"pension": 21.5, "sickness": 2.1, "employment_policy": 1.2, "health": 9},
        "unmodelled_employer_accident_rate_range": [.28, 5],
    },
    "ESP": {
        "unit": "percent_of_gross_wage", "scope": "Model OECD na průměrné mzdě, pod stropem příspěvků.",
        "source_urls": [BASE + "spain_96c2f5c9.html", "https://eurohealthobservatory.who.int/publications/i/spain-health-system-review-2024"],
        "employee": {"pension_sickness_disability_combined": 4.7, "unemployment": 1.55, "training": .1, "intergenerational_equity": .13},
        "employer": {"pension_sickness_disability_combined": 23.6, "unemployment": 5.5, "wage_guarantee_fund": .2, "training": .6, "intergenerational_equity": .67},
        "health": "Veřejné zdravotnictví je financované hlavně z daní. Samostatnou českou sazbu zdravotního pojistného nelze mechanicky přičíst.",
        "regional_income_tax": "Zahrnuta v modelu OECD jako vážená kombinace regionálních sazeb; nepřičítat podruhé.",
        "unmodelled_employer_accident_rate_range": [1.5, 7.15],
    },
}
for code, detail in details.items():
    row = next(r for r in records if r["country"] == code)
    amounts = row["per_100_gross_wage"]
    assert abs(sum(detail["employee"].values()) - amounts["employee_contributions"]) < 1e-9
    assert abs(sum(detail["employer"].values()) - amounts["employer_contributions_and_payroll_taxes"]) < 1e-9
    # Sensitivity, NOT a country-wide average. Both numerator and denominator change.
    detail["illustrative_wedge_with_accident_percent_range"] = [
        round((100 - amounts["net_before_non_tax_payments"] + amounts["employer_contributions_and_payroll_taxes"] + extra)
              / (amounts["labour_cost_before_non_tax_payments"] + extra) * 100, 6)
        for extra in detail["unmodelled_employer_accident_rate_range"]]

result = {
    "schema_version": "1.0.0", "year": 2025, "verified_on": "2026-09-09",
    "scenario": "Single, no children, 100% of each country's average wage (not equal EUR wage).",
    "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "ntcp_pdf_sha256": hashlib.sha256(raw.read_bytes()).hexdigest(),
    "records": records, "detailed_contributions": details,
    "notes_cs": [
        "Základní daňový klín není ukazatel všech povinných plateb. Rozšířený klín zahrnuje modelované NTCP, ale stále vynechává pracovní úrazové pojištění uvedených zemí.",
        "Procenta z hrubé mzdy se nesmějí sčítat s procenty z celkových nákladů. Přepočet používá celkové náklady = 100 + příspěvky zaměstnavatele.",
        "Rozšířený klín má větší jmenovatel, pokud se přidávají povinné platby zaměstnavatele. Rozdíl klínů není sazbou další platby z hrubé mzdy.",
        "NTCP mohou být individuální penzijní úspory, nikoli příjem státního rozpočtu. Povinná platba a daň jsou odlišné pojmy.",
        "Rozpětí úrazového pojištění je citlivostní výpočet dle sazeb z tabulky 7 doplňku OECD, nikoli typický celostátní výsledek.",
        "Rozšířené hodnoty jsou publikované modely OECD. Nejsou přesnou osobní kalkulací pro každý věk, region či profesi.",
        "DPH, spotřební daně, dobrovolné pojištění, životní náklady ani OSVČ nejsou v tomto zaměstnaneckém výpočtu.",
    ],
}
out = ROOT / "data/labour-tax-breakdown-2025.v1.json"
out.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n")
for r in records:
    a = r["per_100_oecd_labour_cost"]
    assert abs(sum(a.values()) - 100) < .00001
    print(r["name_cs"], r["per_100_gross_wage"], r["oecd_compulsory_payment_wedge_percent"])
print("Verified component reconciliation for 8 countries and detailed contribution sums for CZE/ESP.")
print(json.dumps(details, ensure_ascii=False))
