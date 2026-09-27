"""Source-native exclusion policy, including the exact pinned failure record."""
from decimal import Decimal
import json
import unittest

from chart_ch5_6 import epoch_source
from publish_ch5_6_panels import provider_panels

META=dict(source_id='epoch_models_1',source_sha256='a'*64,source_url='https://epoch.ai/data/all_ai_models.csv',source_vintage='fixture',relation='synthetic')


def model(name='valid',**changes):
    row={'Model':name,'Publication date':'2024-01-01','Training compute (FLOP)':'2e23','Training compute lower bound':'9e22','Training compute upper bound':'3e23','Country (of organization)':'Multinational','Confidence':'Likely','Training compute estimation method':'Estimated'}
    row.update(changes);return row


class EpochSourceBoundsTests(unittest.TestCase):
    def test_actual_conv_s2s_source_inconsistency_is_excluded_without_clamping(self):
        # Original release fa0e0af3-297b-4c5d-b5d3-c0a77bddeac9, row3093,
        # bounded BQ read2026-09-27; identity/raw decimals reproduce actual failure.
        # Other fields use synthetic context; no guessed country is a source claim.
        original=model('ConvS2S (ensemble of 8 models)',**{'Publication date':'2017-07-25','Training compute (FLOP)':'5.64e+19','Training compute lower bound':'5.65000000001e+19','Training compute upper bound':''})
        result,coverage=epoch_source([original,model()],META)
        bad=result['model_selection'][0]
        self.assertEqual(bad['selection_status'],'excluded_inconsistent_source_compute')
        self.assertEqual(bad['source_issues'],['central_compute_outside_source_bounds'])
        self.assertEqual(bad['compute_flop'],Decimal('5.64e19'))
        self.assertEqual(bad['compute_lower'],Decimal('5.65000000001e19'))
        self.assertIsNone(bad['compute_upper'])
        self.assertEqual(bad['source_record'],original)
        self.assertEqual(result['series'][0]['cumulative_models'],1)
        self.assertEqual(coverage['source_issue_counts'],{'central_compute_outside_source_bounds':1})
        self.assertEqual(coverage['inconsistent_source_records'][0]['central_source'],'5.64e+19')
    def test_other_invalid_bounds_and_nonpositive_values_never_enter_counts(self):
        reversed_bounds=model('reversed',**{'Training compute lower bound':'3e23','Training compute upper bound':'1e23'})
        nonpositive=model('nonpositive',**{'Training compute (FLOP)':'0','Training compute lower bound':'','Training compute upper bound':''})
        result,coverage=epoch_source([reversed_bounds,nonpositive,model()],META)
        self.assertEqual(coverage['selection_statuses']['excluded_inconsistent_source_compute'],2)
        self.assertEqual(result['series'][0]['cumulative_models'],1)
        self.assertTrue(all(not r['uncertainty_crosses_threshold'] for r in result['model_selection'][:2]))
    def test_binding_and_primary_key_failures_remain_blocking(self):
        with self.assertRaisesRegex(ValueError,'columns'):epoch_source([{'Model':'unreviewed'}],META)
        with self.assertRaisesRegex(ValueError,'duplicate'):epoch_source([model(),model()],META)
    def test_unreviewed_global_epoch_binding_holds_panel_without_counts(self):
        meta=dict(release_id='fixture',url='https://epoch.ai/data/all_ai_models.csv',sha256='a'*64,vintage='fixture',accepted_records=2)
        def records(sid):
            for row in [{'kind':'header','columns':['Unreviewed model field']},{'kind':'data','columns':['Unreviewed model field'],'values':['sample']}]:
                yield dict(source_id=sid,release_id='fixture',source_sha256='a'*64,source_url=meta['url'],record_json=json.dumps(row))
        charts,gaps=provider_panels(records,{'epoch_models_1':meta})
        self.assertEqual(charts,[])
        held=next(g for g in gaps if g['source_id']=='epoch_models_1')
        self.assertEqual(held['status'],'needs_definition')
        self.assertIn('No model counts published',held['reason'])

    def test_exact_threshold_and_wrong_estimates_remain_excluded(self):
        result,coverage=epoch_source([model('exact',**{'Training compute (FLOP)':'1e23'}),model('wrong',Confidence='Wrong'),model()],META)
        self.assertEqual(result['series'][0]['cumulative_models'],1)
        self.assertEqual(coverage['selection_statuses']['excluded_central_estimate'],1)
        self.assertEqual(coverage['selection_statuses']['excluded_source_wrong'],1)


if __name__=='__main__':unittest.main()
