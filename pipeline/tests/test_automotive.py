import importlib.util,unittest
from decimal import Decimal
from pathlib import Path
spec=importlib.util.spec_from_file_location('automotive',Path(__file__).parents[1]/'automotive_cloud/build.py')
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
class AutomotiveTest(unittest.TestCase):
    def test_disjoint_product_definitions(self):
        expected={'870380':'vehicles','870441':'vehicles','870421':'vehicles','870121':'trucks','870124':'trucks','870442':'trucks','870899':'parts','870460':None,'870490':None,'8702':None,'840820':None}
        for code,segment in expected.items():self.assertEqual(a.segment(code),segment)
    def test_world_residual_and_intra_eu_removal(self):
        inputs={k:Decimal(v) for k,v in {'WORLD':'100','EU27':'40','USA':'10','CHN':'20'}.items()}
        self.assertEqual(a.assemble(inputs,'DEU'),{'USA':10,'EU27':0,'CHN':20,'ROW':30})
        self.assertEqual(sum(a.assemble(inputs,'USA').values()),100)
    def test_missing_world_is_not_zero(self):
        self.assertIsNone(a.assemble({'CHN':Decimal(20)},'USA'))
    def test_inconsistent_world_fails(self):
        with self.assertRaises(ValueError):a.assemble({'WORLD':Decimal(10),'CHN':Decimal(20)},'USA')
    def test_geography(self):
        self.assertEqual(len(a.EU),27)
        for iso in ['GBR','HKG','MAC']:self.assertEqual(a.region(iso),'ROW')
