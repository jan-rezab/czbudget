import importlib.util
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "worker.py"
SPEC = importlib.util.spec_from_file_location("paris_worker", MODULE)
WORKER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(WORKER)


def test_normalize_preserves_coded_leaf_and_marks_order_rows():
    body = ("exercice_comptable;budget;section_budgetaire_i_f;sens_depense_recette;type_d_operation_r_o_i_m;"
            "chapitre_budgetaire_cle;chapitre_niveau_vote_texte_descriptif;nature_budgetaire_cle;"
            "nature_budgetaire_texte;fonction_cle;fonction_texte;mandate_titre_apres_regul\n"
            "2024;M57 Ville;Fonctionnement;Dépenses;Pour Ordre;930;Services;6811;Dotations;020;Administration;12.34\n").encode()
    old = (WORKER.EXPECTED_EXPORT_ROWS, WORKER.EXPECTED_2024_ROWS, WORKER.EXPECTED_2024_NONZERO_ROWS)
    WORKER.EXPECTED_EXPORT_ROWS = WORKER.EXPECTED_2024_ROWS = WORKER.EXPECTED_2024_NONZERO_ROWS = 1
    try:
        rows, stats = WORKER.normalize(body, "2026-09-20T00:00:00+00:00")
    finally:
        WORKER.EXPECTED_EXPORT_ROWS, WORKER.EXPECTED_2024_ROWS, WORKER.EXPECTED_2024_NONZERO_ROWS = old
    assert stats == {"export_rows": 1, "rows_2024": 1, "nonzero_rows_2024": 1}
    assert rows[0]["economic_item_code"] == "expenditure:6811"
    assert rows[0]["functional_paragraph_code"] == "020"
    assert rows[0]["amount_local"] == "12.34"
    assert rows[0]["is_consolidation_item"] is True
    assert rows[0]["is_summary_row"] is False
