import hashlib
from decimal import Decimal

STAGES = {
    "תשלומים - תקציב - שנה נוכחית": "enacted",
    "תשלומים - ביצוע - שנה נוכחית": "actual",
}
ROLLUP_LABELS = {
    "פעולות רגילות",
    "פעולות חירום",
    "פעולות רגילות ופעולות חירום",
}

def normalize_form2(rows):
    facts = []
    for row in rows:
        if row.get("גליון") != "טופס 2" or row.get("עמודה") not in STAGES:
            continue
        label = str(row.get("שורה") or "").strip()
        if not label or label.startswith("סהכ") or label in ROLLUP_LABELS or row.get("ערך") is None:
            continue
        amount = Decimal(str(row["ערך"])) * 1000
        facts.append({
            "source_row_id": int(row["_id"]),
            "published_code": str(row["קוד"]),
            "label": label,
            "stage": STAGES[row["עמודה"]],
            "amount_ils": amount,
            "functional_code": "ISR_FORM2_" + hashlib.sha1(label.encode()).hexdigest()[:12].upper(),
        })
    labels = {}
    for fact in facts:
        labels.setdefault(fact["label"], set()).add(fact["stage"])
    incomplete = {label: stages for label, stages in labels.items() if stages != {"enacted", "actual"}}
    if incomplete:
        raise RuntimeError(f"incomplete Form 2 stage pairs: {incomplete}")
    return facts
