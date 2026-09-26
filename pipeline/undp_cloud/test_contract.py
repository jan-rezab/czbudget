"""Focused pure-source checks, using tiny fixtures and no network or cloud SDK."""
import ast
from decimal import Decimal, InvalidOperation
import math
from pathlib import Path
import re
import unittest

# Exercise the actual pure parsers without requiring cloud/scientific packages.
source=ast.parse(Path(__file__).with_name('publish.py').read_text())
functions=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name in {'text','number','code_unit'}]
class PD:
    Timestamp=type('Timestamp',(),{})
namespace=dict(Decimal=Decimal,InvalidOperation=InvalidOperation,math=math,re=re,pd=PD,
               MISSING={'','..','...','NA','N/A','NaN','nan','None','—','–','.'})
exec(compile(ast.Module(body=functions,type_ignores=[]),'publish.py','exec'),namespace)
number=namespace['number'];unit=namespace['code_unit']
class Contract(unittest.TestCase):
    def test_precision_and_missing_are_separate(self):
        self.assertEqual(number('0.941833603075098'),'0.941833603075098')
        self.assertIsNone(number('..'))
        self.assertEqual(number('0'),'0')
        self.assertIsNone(number(float('nan')))
        self.assertIsNone(number('2010-2023'))
        self.assertEqual(number('1.75e-08'),'1.75E-8')
    def test_units_follow_codebook(self):
        self.assertEqual(unit('gnipc','Gross National Income Per Capita (2021 PPP$)'),'2021 PPP$')
        self.assertEqual(unit('hdi','Human Development Index (value)'),'index')
        self.assertEqual(unit('mmr','Maternal mortality ratio (deaths per 100,000 live births)'),'deaths per 100,000 live births')
    def test_excess_precision_never_silently_rounds(self):
        with self.assertRaises(ValueError):number('0.'+'1'*39)
    def test_build_has_data_only_boundary(self):
        config=Path(__file__).with_name('cloudbuild.publish.yaml').read_text()
        self.assertIn('plane-data',config)
        self.assertNotIn('europe-west1',config)
        self.assertNotIn('gcloud run',config)
if __name__=='__main__':unittest.main()
