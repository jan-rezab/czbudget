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
        self.assertEqual(a.assemble(inputs,'DEU',include_intra_eu=True),{'USA':10,'EU27':40,'CHN':20,'ROW':30})
        self.assertEqual(sum(a.assemble(inputs,'USA').values()),100)
    def test_missing_world_is_not_zero(self):
        self.assertIsNone(a.assemble({'CHN':Decimal(20)},'USA'))
    def test_inconsistent_world_fails(self):
        with self.assertRaises(ValueError):a.assemble({'WORLD':Decimal(10),'CHN':Decimal(20)},'USA')
    def test_country_routes_keep_unallocated_and_all_country_origins(self):
        values={'DEU':Decimal(40),'USA':Decimal(10),'CHN':Decimal(20),'JPN':Decimal(25)}
        expected={'DEU':40,'USA':10,'CHN':20,'JPN':25,'UNALLOCATED':5}
        self.assertEqual(a.country_routes(values,Decimal(100)),expected)
        self.assertEqual(sum(a.country_routes(values,Decimal(100)).values()),100)
        with self.assertRaises(ValueError):a.country_routes(values,Decimal(80))
    def test_geography(self):
        self.assertEqual(len(a.EU),27)
        for iso in ['GBR','HKG','MAC']:self.assertEqual(a.region(iso),'ROW')

class AutomotiveReleaseTest(unittest.TestCase):
    def test_release_rejects_incomplete_or_duplicate_market_months(self):
        import copy
        spec=importlib.util.spec_from_file_location('hydrate_automotive',Path(__file__).parents[2]/'scripts/hydrate-automotive.py')
        hydrate=importlib.util.module_from_spec(spec);spec.loader.exec_module(hydrate)
        markets=[f'M{i}' for i in range(20)];periods=['202601','202602']
        data={'schema_version':'automotive-monthly.v1','panel':markets,'eu27':list(a.EU),'periods':periods,'rows':[{'market':m,'period':p,'segment':s,'values':{'USA':1,'EU27':2,'CHN':3,'ROW':4},'values_all':{'USA':1,'EU27':2,'CHN':3,'ROW':4}} for m in markets for p in periods for s in ['vehicles','trucks','parts']]}
        data['origins']=[{'code':r,'region':r} for r in ['USA','EU27','CHN','ROW']]
        data['routes']=[{'period':r['period'],'market':r['market'],'segment':r['segment'],'origin':o,'value':v} for r in data['rows'] for o,v in r['values'].items()]
        hydrate.validate(data)
        wrong_route=copy.deepcopy(data);wrong_route['routes'][0]['value']+=1
        with self.assertRaises(AssertionError):hydrate.validate(wrong_route)
        duplicate_route=copy.deepcopy(data);duplicate_route['routes'].append(duplicate_route['routes'][0])
        with self.assertRaises(AssertionError):hydrate.validate(duplicate_route)
        missing=copy.deepcopy(data);missing['rows'].pop()
        with self.assertRaises(AssertionError):hydrate.validate(missing)
        duplicate=copy.deepcopy(data);duplicate['rows'][-1]=duplicate['rows'][0]
        with self.assertRaises(AssertionError):hydrate.validate(duplicate)
        negative=copy.deepcopy(data);negative['rows'][0]['values']['ROW']=-1
        with self.assertRaises(AssertionError):hydrate.validate(negative)
