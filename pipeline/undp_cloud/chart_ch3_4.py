"""Evidence-bound chapter 3–4 transforms; no I/O, downloads, or cloud mutation.

The cloud orchestrator supplies immutable source records and a schema binding
reviewed against that exact preview. Unknown schemas produce gaps, never guesses.
"""
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
import json

SOURCE_FAMILIES = {
    'wipo_assistive': {'mode': 'cells', 'limitations': ['Patent offices are not countries. Keep patent families separate from applications.', 'Do not assume the workbook timeframe equals the HDR 2000–2010 caption.']},
    'sapien_public': {'mode': 'cells', 'limitations': ['Public aggregates only. Exact HDR pooled smartphone analysis may be unavailable.', 'Internet-enabled self-selected samples are not population censuses or clinical diagnoses.']},
    'cdc_brfss': {'mode': 'survey', 'limitations': ['Only admitted source years may be shown; full 1993–2024 historical inputs are not presently available.', '2011 survey-design break; 2024 excludes Tennessee; 2025 excludes California, Mississippi, Nevada and US Virgin Islands.', 'No design-based confidence intervals without verified strata/PSU and variance implementation.']},
    'itu_connectivity': {'mode': 'cells', 'limitations': ['Observation years and age bands vary by country. Preserve source age bands.', 'Do not interpret stacked percentages across age groups as an overall internet-use rate.']},
    'ada_lovelace': {'mode': 'survey', 'limitations': ['Wave 1 Great Britain and wave 2 United Kingdom have different coverage.', 'Questions were assigned in modules. Denominators are valid assigned respondents, not every survey participant.', 'Wave 2 README fieldwork date is inconsistent with its 2024/25 title; verify technical report.', 'No design-based confidence intervals without validated variance implementation.']},
}

class BindingError(ValueError):
    """A schema/evidence error prevents admission of the entire chart."""


def decimal(value):
    if isinstance(value, bool) or value is None or isinstance(value, dict):
        return None
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
    return result if result.is_finite() else None


def _payload(record):
    value = record.get('record_json')
    return json.loads(value) if isinstance(value, str) else value


def _row(payload):
    if isinstance(payload, dict) and payload.get('kind') == 'data':
        columns, values = payload['columns'], payload['values']
        if len(columns) != len(set(columns)) or len(columns) != len(values):
            raise BindingError('Ambiguous duplicate columns or ragged source row')
        return dict(zip(columns, values))
    if isinstance(payload, dict) and not payload.get('kind') and 'columns' not in payload:
        return payload
    return None


def _identity(binding):
    required = ('source_id', 'source_sha256', 'schema_evidence', 'binding_verified',
                'period', 'geography', 'unit', 'denominator', 'metric', 'method_version')
    for key in required:
        if not binding.get(key):
            raise BindingError('Unverified or absent binding field: ' + key)
    if binding['binding_verified'] is not True:
        raise BindingError('Binding must be explicitly verified')
    if len(binding['source_sha256']) != 64:
        raise BindingError('Exact source SHA256 is required')


def _check_record(record, binding):
    if record.get('source_id') != binding['source_id']:
        return False
    if record.get('source_sha256') != binding['source_sha256']:
        raise BindingError('Record hash differs from reviewed schema snapshot')
    return True


def _base(binding):
    return {key: binding[key] for key in ('source_id', 'source_sha256', 'schema_evidence',
            'period', 'geography', 'unit', 'denominator', 'metric', 'method_version')}


def survey(records, binding):
    """Weighted proportions using explicit codes, questions, and group bindings.

    Codes are compared exactly as source strings: the caller must review source
    coding and cannot silently coerce 99/nonresponse or categorical age codes.
    All outcomes are derived estimates, never source-reported aggregates.
    """
    _identity(binding)
    for key in ('answer_column', 'weight_column', 'valid_codes', 'numerator_codes', 'group_columns'):
        if key not in binding:
            raise BindingError('Missing survey binding: ' + key)
    valid = {str(x) for x in binding['valid_codes']}
    numerator = {str(x) for x in binding['numerator_codes']}
    if not valid or not numerator.issubset(valid):
        raise BindingError('Numerator must be a subset of explicit valid response codes')
    statistic = binding.get('statistic', 'weighted_proportion')
    if statistic not in {'weighted_proportion', 'weighted_mean'}:
        raise BindingError('Unsupported statistic')
    value_map = binding.get('numeric_value_map', {})
    if statistic == 'weighted_mean' and not valid.issubset(value_map):
        raise BindingError('Every valid source code needs an explicit numeric mapping')
    if statistic == 'weighted_proportion' and binding['unit'] != 'percent':
        raise BindingError('Proportion output requires percent unit')
    groups = defaultdict(lambda: {'n': 0, 'num_n': 0, 'weight': Decimal(0), 'num_weight': Decimal(0), 'weighted_sum': Decimal(0), 'counts': Counter()})
    counts = Counter()
    for record in records:
        if not _check_record(record, binding):
            continue
        row = _row(_payload(record))
        if row is None:
            continue
        if binding.get('member') and record.get('member') != binding['member']:
            continue
        required = [binding['answer_column'], binding['weight_column']] + binding['group_columns']
        required += list(binding.get('filters', {}))
        if not all(column in row for column in required):
            raise BindingError('Reviewed column absent in source record')
        counts['received'] += 1
        if any(str(row[column]) not in {str(v) for v in allowed}
               for column, allowed in binding.get('filters', {}).items()):
            counts['outside_explicit_filter'] += 1
            continue
        answer = str(row[binding['answer_column']])
        if answer not in valid:
            counts['invalid_or_unassigned_answer'] += 1
            continue
        weight = decimal(row[binding['weight_column']])
        if weight is None or weight <= 0:
            counts['missing_invalid_or_nonpositive_weight'] += 1
            continue
        keys = []
        for column in binding['group_columns']:
            value = row[column]
            labels = binding.get('group_labels', {}).get(column)
            if labels is None:
                raise BindingError('Explicit group labels required; source codes are not assumed ages or sex')
            label = labels.get(str(value))
            if label is None:
                break
            keys.append((column, str(value), label))
        if len(keys) != len(binding['group_columns']):
            counts['missing_or_unmapped_group'] += 1
            continue
        group = groups[tuple(keys)]
        group['n'] += 1
        group['weight'] += weight
        group['counts'][answer] += 1
        if statistic == 'weighted_mean':
            mapped = decimal(value_map[answer])
            if mapped is None:
                raise BindingError('Invalid reviewed numeric value mapping')
            group['weighted_sum'] += mapped * weight
        counts['accepted'] += 1
        if answer in numerator:
            group['num_n'] += 1
            group['num_weight'] += weight
    if not counts['received']:
        raise BindingError('No source records for the reviewed binding')
    observations = []
    for key, group in sorted(groups.items()):
        observations.append(dict(_base(binding), group=[{'column': k, 'source_code': c, 'label': label} for k, c, label in key],
            value=str(group['weighted_sum'] / group['weight'] if statistic == 'weighted_mean' else group['num_weight'] / group['weight'] * Decimal(100)),
            statistic=statistic, weighted_value_sum=str(group['weighted_sum']) if statistic == 'weighted_mean' else None, numeric_value_map=value_map if statistic == 'weighted_mean' else None,
            observation_kind='derived_weighted_estimate', source_value=None,
            unweighted_denominator=group['n'], unweighted_numerator=group['num_n'],
            weighted_denominator=str(group['weight']), weighted_numerator=str(group['num_weight']),
            source_response_counts=dict(group['counts']), source_weight_column=binding['weight_column'],
            source_answer_column=binding['answer_column'], valid_codes=sorted(valid), numerator_codes=sorted(numerator),
            confidence_interval=None, variance_status='unresolved_design_variance_not_implemented'))
    return {'status': 'derived' if observations else 'unresolved_no_valid_weighted_groups', 'observations': observations, 'counts': dict(counts)}


def cells(records, binding):
    """Extract individually reviewed workbook cells without fuzzy header matching.

    Each selection pins member, row ordinal, column ordinal and its original
    geography/period/category metadata. Formula records are rejected; cached
    values must come from the reviewed source snapshot.
    """
    _identity(binding)
    if not binding.get('selections'):
        raise BindingError('No reviewed source cell selections')
    wanted = {}
    for selection in binding['selections']:
        required = ('member', 'row_number', 'column_index', 'period', 'geography', 'category', 'unit', 'denominator')
        if not all(k in selection for k in required):
            raise BindingError('Missing cell-specific coverage binding')
        key = (selection['member'], selection['row_number'])
        wanted.setdefault(key, []).append(selection)
    found, observations = set(), []
    for record in records:
        if not _check_record(record, binding):
            continue
        key = (record.get('member'), record.get('row_number'))
        for selection in wanted.get(key, []):
            marker = (key, selection['column_index'])
            if marker in found:
                raise BindingError('Duplicate admitted cell coordinate')
            found.add(marker)
            payload = _payload(record)
            if payload.get('representation') != 'cached_values':
                raise BindingError('Cell binding selected formula records instead of cached source values')
            index = selection['column_index']
            if not isinstance(index, int) or index < 0 or index >= len(payload['values']):
                raise BindingError('Reviewed cell lies outside source row')
            original = payload['values'][index]
            number = decimal(original)
            observations.append(dict(_base(binding), **{k: selection[k] for k in ('period', 'geography', 'category', 'unit', 'denominator')},
                source_value=original, value=str(number) if number is not None else None,
                observation_kind='source_workbook_cell', member=selection['member'], source_row_number=selection['row_number'],
                source_column_index=index, missing_status=None if number is not None else 'source_missing_or_nonnumeric'))
    if len(found) != sum(map(len, wanted.values())):
        raise BindingError('Some reviewed source cells are absent')
    return {'status': 'extracted', 'observations': observations, 'counts': {'selected_cells': len(found), 'numeric_cells': sum(o['value'] is not None for o in observations)}}


def transform(family, records, binding=None):
    """Return a chart result or an explicit unresolved coverage entry."""
    if family not in SOURCE_FAMILIES:
        raise BindingError('Unsupported chapter3–4 family')
    info = SOURCE_FAMILIES[family]
    if binding is None:
        return {'family': family, 'status': 'unresolved_source_schema_preview_required', 'observations': [], 'limitations': info['limitations']}
    try:
        result = (survey if info['mode'] == 'survey' else cells)(records, binding)
    except BindingError as exc:
        result = {'status': 'unresolved_binding_validation', 'reason': str(exc), 'observations': []}
    return dict(result, family=family, limitations=info['limitations'])
