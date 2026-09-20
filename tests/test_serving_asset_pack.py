import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


def load_module():
    source = Path(__file__).resolve().parents[1] / "scripts" / "publish-serving-asset-pack.py"
    spec = importlib.util.spec_from_file_location("publish_serving_asset_pack", source)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


publisher = load_module()


class ServingAssetPackTest(unittest.TestCase):
    def test_pack_extends_lock_without_rewriting_existing_assets(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for relative, body in {
                "data/paq/index.json": b"{}\n",
                "data/paq/catalog.json.gz": b"catalog",
                "data/paq/panels.json": b"{}\n",
                "data/paq/obec-001.json.gz": b"shard",
                "data/trade/automotive-monthly.v1.json": b'{"schema_version":"automotive-monthly.v1"}\n',
                "data/municipal-budget-codebook.v1.json": b"{}\n",
            }.items():
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(body)
            base = root / "base.json"
            base.write_text(json.dumps({
                "version": 1,
                "bucket": publisher.BUCKET,
                "packs": {"existing": {"key": "static-assets/v1/" + "a" * 64 + ".pack"}},
                "files": {"/data/isred/index.json": {"pack": "existing", "offset": 0, "size": 1, "sha256": "b" * 64}},
            }))
            lock, descriptor = publisher.assemble(root, base, root / "out")
            self.assertEqual(lock["files"]["/data/isred/index.json"]["pack"], "existing")
            self.assertEqual(lock["files"]["/data/paq/catalog.json.gz"]["pack"], publisher.PACK_NAME)
            self.assertEqual(lock["files"]["/data/trade/automotive-monthly.v1.json"]["pack"], publisher.PACK_NAME)
            self.assertEqual(lock["files"]["/data/municipal-budget-codebook.v1.json"]["pack"], publisher.PACK_NAME)
            self.assertEqual(descriptor["size"], sum(path.stat().st_size for path in publisher.selected(root)))
            self.assertTrue((root / "out" / descriptor["file"]).is_file())

    def test_pack_fails_closed_when_a_required_contract_is_missing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "data/paq").mkdir(parents=True)
            (root / "data/paq/index.json").write_text("{}")
            with self.assertRaises(ValueError):
                publisher.selected(root)


if __name__ == "__main__":
    unittest.main()
