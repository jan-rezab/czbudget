import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pipeline"))
import raw_cache_archives as cache


class RawCacheArchivesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve() / "data/source_cache/municipal-expansion/BRA"
        self.root.mkdir(parents=True)
        self.payloads = {"2024/a.json": b'{"amount":42}\n', "2025/b.csv.gz": b"original gzip bytes\x00\xff"}
        for name, data in self.payloads.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            os.utime(path, (1_700_000_000, 1_700_000_000))

    def tearDown(self):
        self.temp.cleanup()

    def test_roundtrip_and_idempotent_repack(self):
        before = [cache.record(path, self.root) for path in cache.loose_files(self.root)]
        result = cache.pack(self.root, remove=True)
        self.assertEqual(result["removed"], 2)
        self.assertEqual(cache.inventory(self.root), before)
        self.assertEqual(cache.restore(self.root), 2)
        self.assertEqual(cache.restore(self.root), 0)
        for name, data in self.payloads.items():
            self.assertEqual((self.root / name).read_bytes(), data)
            self.assertEqual((self.root / name).stat().st_mtime, 1_700_000_000)
        self.assertEqual(cache.pack(self.root, remove=True)["removed"], 2)

    def test_pack_without_remove_and_active_scratch_untouched(self):
        (self.root / ".request-rate.lock").write_text("retain")
        cache.pack(self.root)
        self.assertEqual(len(cache.loose_files(self.root)), 2)
        cache.pack(self.root, remove=True)
        self.assertEqual((self.root / ".request-rate.lock").read_text(), "retain")

    def test_refresh_is_not_overwritten_or_deleted(self):
        cache.pack(self.root, remove=True)
        path = self.root / "2024/a.json"
        path.write_bytes(b"new source response")
        os.utime(path, (1_700_000_000, 1_700_000_000))
        cache.restore(self.root)
        self.assertEqual(path.read_bytes(), b"new source response")
        self.assertEqual(cache.inventory(self.root)[0]["sha256"], hashlib.sha256(b"new source response").hexdigest())
        with self.assertRaises(ValueError):
            cache.pack(self.root, remove=True)
        self.assertEqual(len(cache.loose_files(self.root)), 2)

    def test_corruption_blocks_restore_and_removal(self):
        cache.pack(self.root)
        (self.root / cache.ARCHIVE).write_bytes(b"broken archive")
        with self.assertRaises(tarfile.TarError):
            cache.pack(self.root, remove=True)
        self.assertEqual(len(cache.loose_files(self.root)), 2)

    def test_recent_active_partial_and_symlink_guards(self):
        path = self.root / "2024/a.json"
        os.utime(path, None)
        with self.assertRaises(ValueError):
            cache.pack(self.root, remove=True)
        os.utime(path, (1_700_000_000, 1_700_000_000))
        for name in (".in-flight", "download.part", "crawl.sqlite3"):
            marker = self.root / name
            marker.touch()
            with self.assertRaises(ValueError):
                cache.pack(self.root, remove=True)
            marker.unlink()
        (self.root / "link").symlink_to(path)
        with self.assertRaises(ValueError):
            cache.pack(self.root, remove=True)
        self.assertFalse((self.root / cache.ARCHIVE).exists())

    def test_restore_rejects_symlink_and_custom_unarchived_cache_works(self):
        self.assertEqual(cache.restore(Path(self.temp.name) / "custom-cache"), 0)
        cache.pack(self.root, remove=True)
        (self.root / "2024/a.json").symlink_to(self.root / cache.MANIFEST)
        with self.assertRaises(ValueError):
            cache.restore(self.root)

    def test_path_traversal_is_rejected(self):
        archive = self.root / cache.ARCHIVE
        with tarfile.open(archive, "w:gz") as bundle:
            info = tarfile.TarInfo("../escape")
            info.size = 1
            bundle.addfile(info, io.BytesIO(b"x"))
        manifest = {"schema_version": 1, "archive_sha256": cache.file_hash(archive),
                    "files": [{"name": "../escape", "bytes": 1, "sha256": hashlib.sha256(b"x").hexdigest()}]}
        (self.root / cache.MANIFEST).write_text(json.dumps(manifest))
        with self.assertRaises(ValueError):
            cache.restore(self.root)
        self.assertFalse((self.root.parent / "escape").exists())

    def test_js_inventory_matches_loose_tree_digest(self):
        expected = [cache.record(path, self.root) for path in cache.loose_files(self.root)]
        cache.pack(self.root, remove=True)
        helper = (Path(__file__).resolve().parents[1] / "pipeline/raw-cache-inventory.mjs").as_uri()
        code = "const m = await import(process.argv[1]); console.log(JSON.stringify(await m.archivedInventory(process.argv[2])))"
        output = subprocess.check_output(["node", "--input-type=module", "-e", code, helper, str(self.root)], text=True)
        self.assertEqual(json.loads(output), expected)


if __name__ == "__main__":
    unittest.main()
