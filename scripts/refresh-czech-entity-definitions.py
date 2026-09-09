#!/usr/bin/env python3
"""Apply source definitions to retained cards; never replace reported amounts."""
import json,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('cards',ROOT/'pipeline/transforms/extract_strategic_entities_2024.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
p=ROOT/'data/cz-state-enterprises-2024.json';d=json.loads(p.read_text())
for e in d['entities']:
    m.add_comparison_fields(e)
    e.setdefault('owner_transfer_type_cs',None)
d['comparison_framework']['liability_ratio_definition']='debt_to_assets_pct uses reported liabilities (cizi zdroje), not interest-bearing debt'
d['comparison_framework']['owner_transfer_definition']='Original card transfer type where captured; unknown types remain null'
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print(len(d['entities']))
