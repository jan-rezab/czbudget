import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("latam", ROOT / "pipeline/transforms/prepare_latam_major_city_budgets.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class LatamMajorCityBudgetsTest(unittest.TestCase):
    def test_montevideo_stage_and_boundary_contract(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "source.zip"
            with zipfile.ZipFile(archive, "w") as bundle:
                bundle.writestr("ingresos_2024.csv", "ejercicio,cuenta,descripcion_cuenta,monto_autorizado,monto_recaudado\n2024,101,Tasa,1000,900\n")
                bundle.writestr("egresos_2024.csv", "ejercicio,area_funcional,descripcion_area_funcional,pos_presupuestaria,descripcion_pos_presupuestaria,monto_autorizado,monto_incorporado\n2024,301,Secretaria,111,Alimentos,800,700\n")
            source = {
                "id": "fixture", "year": 2024, "currency": "UYU", "entity_code": "MONTEVIDEO",
                "fiscal_boundary": "Intendencia de Montevideo; anchor only", "resource_url": "https://example.test/source.zip",
                "landing_url": "https://example.test", "metadata_url": "https://example.test/meta", "retrieved_at": "2026-09-19T00:00:00Z",
            }
            result = MODULE.montevideo(source, archive, root / "out", "2026-09-19T00:00:00+00:00")
            self.assertEqual(4, result["facts"])
            facts = [json.loads(line) for line in (root / "out/municipal_budget_line_facts.jsonl").read_text().splitlines()]
            self.assertEqual({"enacted", "actual"}, {row["budget_stage"] for row in facts})
            self.assertEqual({"revenue", "expenditure"}, {row["budget_side"] for row in facts})
            self.assertTrue(all("anchor_only_not_un_agglomeration" in row["quality_flags"] for row in facts))

    def test_recovered_depth_adapters_and_receipts(self):
        config = json.loads((ROOT / "pipeline/config/latam_major_city_budget_sources.json").read_text())
        sources = {row["id"]: row for row in config["sources"]}
        expected = {
            "ar-buenos-aires-budget-execution-2025-q4": (140829, "3b196632-b968-4188-ac3d-145bb6957695"),
            "br-sao-paulo-budget-execution-2025": (24604, "cb8fc8f7-78fb-457f-81e0-340af0b921b5"),
            "pe-lima-mef-budget-execution-2024": (38284, "6bd40cb1-1486-484f-911c-fdd905cf9087"),
            "br-rio-de-janeiro-budget-execution-2025": (35101, "4d3995fa-cb99-4d94-93c3-4cbabfff81ca"),
        }
        for source_id, (rows, run_id) in expected.items():
            with self.subTest(source_id=source_id):
                self.assertEqual("loaded", sources[source_id]["status"])
                self.assertEqual(rows, sources[source_id]["warehouse_rows"])
                self.assertEqual(run_id, sources[source_id]["completed_run"])
                self.assertRegex(sources[source_id]["verified_sha256"], r"^[0-9a-f]{64}$")
        self.assertTrue(callable(MODULE.buenos_aires))
        self.assertTrue(callable(MODULE.sao_paulo))
        self.assertTrue(callable(MODULE.lima_mef))
        self.assertTrue(callable(MODULE.rio_de_janeiro))

    def test_sao_paulo_replacement_guard(self):
        columns = [
            "Cd_AnoExecucao","Cd_Exercicio","Cd_Dotacao_Id","Cd_Orgao","Cd_Unidade","Cd_Funcao",
            "Cd_SubFuncao","Cd_Programa","ProjetoAtividade","Cd_Despesa","Cd_Fonte","COD_EX_FONT_REC",
            "COD_DSTN_REC","COD_VINC_REC_PMSP","COD_TIP_CRED_ORCM","COD_RDZD_FONT_REC","Ds_Orgao",
            "Ds_Unidade","Ds_Programa","Ds_Projeto_Atividade","Ds_Despesa","Vl_Orcado_Ano",
            "Vl_Orcado_Atualizado","Vl_EmpenhadoLiquido","Vl_Liquidado","Vl_Pago",
        ]
        values = ["2025","2025","182954","07","10","08","244","3023","3399","44905100","08","1","759","1224","0","080014","FMD","FMD","Proteção","Equipamento","Obras","1000","1200,50","900","800","700"]
        fixture = (";".join(columns) + "\n" + ";".join(values) + "\n").encode("latin-1")
        with tempfile.TemporaryDirectory() as directory:
            source_path = Path(directory) / "source.csv"; source_path.write_bytes(fixture)
            source = {"id":"br-sao-paulo-test","verified_sha256":MODULE.sha256(source_path),"retrieved_at":"2026-09-20T12:00:00Z","resource_url":"https://example.invalid/source.csv","landing_url":"https://example.invalid","fiscal_boundary":"anchor only"}
            manifest = MODULE.sao_paulo(source, source_path, Path(directory) / "out", "2026-09-20T12:00:00+00:00")
            self.assertEqual((manifest["rows_read"], manifest["facts"]), (1, 5))
            self.assertEqual(manifest["replacement"]["expected_rows"], 288)

    def test_rio_replacement_guard(self):
        columns = ["Exercicio","Orgao","Descricao_Orgao","Unidade_Orcamentaria","Descricao_Unidade_Orcamentaria","Codigo_Funcao","Codigo_Subfuncao","Codigo_Programa","Descricao_Programa","Codigo_Acao","Descricao_Acao","Codigo_Programa_Trabalho","Descricao_Programa_Trabalho","Fonte_Recurso","Fonte_Recurso_Detalhada","Categoria_Economica","Codigo_Grupo","Codigo_Modalidade_Aplicacao","Codigo_Elemento","Codigo_Natureza_Despesa","Descricao_Natureza Despesa","Codigo_Item_Patrimonial","Descricao_Item Patrimonial","Dotacao_Inicial","Dotacao_Atualizada","Despesa_Empenhada","Despesa_Liquidada","Despesa_Paga","Pagamento_RP"]
        values = ["2025","1001","Governo","10001","Gabinete","04","122","0389","Gestão","2529","Pessoal","101001100010412203892529","Pessoal","500","1500000100","3","1","90","16","319016","Variáveis"," - "," - ","100","120","110","105","90","10"]
        fixture = (";".join(columns) + "\n" + ";".join(values) + "\n").encode("latin-1")
        with tempfile.TemporaryDirectory() as directory:
            source_path = Path(directory) / "source.csv"; source_path.write_bytes(fixture)
            source = {"id":"br-rio-de-janeiro-test","verified_sha256":MODULE.sha256(source_path),"retrieved_at":"2026-09-20T14:27:00Z","resource_url":"https://example.invalid/source.csv","landing_url":"https://example.invalid","dictionary_url":"https://example.invalid/dictionary.pdf","fiscal_boundary":"anchor only","stage_mapping":{"Dotacao_Inicial":"enacted","Dotacao_Atualizada":"revised","Despesa_Empenhada":"committed","Despesa_Liquidada":"actual","Despesa_Paga":"cash","Pagamento_RP":"cash_carried_over"}}
            manifest = MODULE.rio_de_janeiro(source, source_path, Path(directory) / "out", "2026-09-20T14:30:00+00:00")
            self.assertEqual((manifest["rows_read"], manifest["facts"]), (1, 6))
            self.assertEqual(manifest["replacement"]["expected_rows"], 286)


if __name__ == "__main__":
    unittest.main()
