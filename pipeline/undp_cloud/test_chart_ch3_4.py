import unittest
from chart_ch3_4 import transform

HASH = 'a' * 64

def binding(**changes):
    b = dict(source_id='synthetic', source_sha256=HASH, binding_verified=True,
        schema_evidence='synthetic-fixture-only', period='2024', geography='fixture',
        unit='percent', denominator='valid assigned respondents with positive weights',
        metric='frequent_distress', method_version='fixture-v1', answer_column='answer',
        weight_column='weight', valid_codes=['0', '1'], numerator_codes=['1'],
        group_columns=['sex'], group_labels={'sex': {'F': 'female', 'M': 'male'}})
    b.update(changes)
    return b


def record(payload, **changes):
    r = dict(source_id='synthetic', source_sha256=HASH, record_json=payload, member='fixture', row_number=1)
    r.update(changes)
    return r


class ChartContractTests(unittest.TestCase):
    def test_weights_and_denominators(self):
        rows = [record({'answer': '1', 'weight': '0.1', 'sex': 'F'}),
                record({'answer': '0', 'weight': '0.3', 'sex': 'F'}),
                record({'answer': '99', 'weight': '100', 'sex': 'F'}),
                record({'answer': '1', 'weight': None, 'sex': 'F'}),
                record({'answer': '1', 'weight': '1', 'sex': 'unknown'})]
        r = transform('cdc_brfss', rows, binding())
        o = r['observations'][0]
        self.assertEqual(o['value'], '25.00')
        self.assertEqual(o['weighted_denominator'], '0.4')
        self.assertEqual(o['unweighted_denominator'], 2)
        self.assertEqual(r['counts']['invalid_or_unassigned_answer'], 1)
        self.assertEqual(r['counts']['missing_invalid_or_nonpositive_weight'], 1)
        self.assertEqual(r['counts']['missing_or_unmapped_group'], 1)
        self.assertIsNone(o['confidence_interval'])
        self.assertIsNone(o['source_value'])

    def test_coded_zero_days_is_not_88_days(self):
        b = binding(statistic='weighted_mean', unit='days in past30',
                    valid_codes=['88', '14'], numerator_codes=[],
                    numeric_value_map={'88': '0', '14': '14'})
        rows = [record({'answer': '88', 'weight': '3', 'sex': 'F'}),
                record({'answer': '14', 'weight': '1', 'sex': 'F'})]
        r = transform('cdc_brfss', rows, b)
        self.assertEqual(r['observations'][0]['value'], '3.5')
        self.assertEqual(r['observations'][0]['numeric_value_map']['88'], '0')
        b.pop('numeric_value_map')
        self.assertEqual(transform('cdc_brfss', rows, b)['observations'], [])

    def test_source_hash_fail_closed(self):
        r = transform('ada_lovelace', [record({'answer': '1', 'weight': 1, 'sex': 'F'}, source_sha256='b'*64)], binding())
        self.assertEqual(r['observations'], [])
        self.assertEqual(r['status'], 'unresolved_binding_validation')

    def test_no_schema_guess(self):
        for family in ['wipo_assistive', 'sapien_public', 'cdc_brfss', 'itu_connectivity', 'ada_lovelace']:
            self.assertEqual(transform(family, [])['observations'], [])
        r = transform('ada_lovelace', [record({'guessed': 1})], binding())
        self.assertEqual(r['observations'], [])

    def test_assigned_module_and_sex_age_codes(self):
        b = binding(filters={'assigned': ['care']}, group_columns=['age'],
                    group_labels={'age': {'5': 'source band 65–74', '6': 'source band 75+'}})
        rows = [record({'answer': '1', 'weight': '1', 'age': '5', 'assigned': 'care'}),
                record({'answer': '0', 'weight': '9', 'age': '5', 'assigned': 'police'})]
        r = transform('ada_lovelace', rows, b)
        self.assertEqual(r['observations'][0]['value'], '100')
        self.assertEqual(r['observations'][0]['group'][0]['source_code'], '5')
        self.assertEqual(r['counts']['outside_explicit_filter'], 1)

    def test_cells_preserve_values_and_years(self):
        selections = [dict(member='book::sheet::cached', row_number=4, column_index=i,
            period=str(2023+i), geography='WIPO office', category='patent families',
            unit='families', denominator='defined landscape') for i in range(2)]
        b = binding(selections=selections)
        r = transform('wipo_assistive', [record({'values': ['0.12345678901234567890', None],
            'representation': 'cached_values'}, member='book::sheet::cached', row_number=4)], b)
        self.assertEqual(r['observations'][0]['value'], '0.12345678901234567890')
        self.assertEqual(r['observations'][0]['source_value'], '0.12345678901234567890')
        self.assertEqual(r['observations'][1]['period'], '2024')
        self.assertIsNone(r['observations'][1]['value'])

    def test_formula_and_partial_cell_extraction_rejected(self):
        b = binding(selections=[dict(member='x', row_number=1, column_index=0,
            period='2024', geography='x', category='age75+', unit='percent', denominator='age75+')])
        self.assertEqual(transform('itu_connectivity', [], b)['observations'], [])
        r = transform('itu_connectivity', [record({'values': ['=1/2'], 'representation': 'formulas_and_source_values'}, member='x')], b)
        self.assertEqual(r['observations'], [])


if __name__ == '__main__':
    unittest.main()
