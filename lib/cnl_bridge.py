"""Validate prototype formats and render all CNL-E variants as canonical CNL-E KV."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / 'vendor' / 'cnl-e'))
import cnl_json
import cnl_kv
import cnl_check


def convert(variant, raw):
    if variant == 'cnl-json':
        doc = json.loads(raw) if isinstance(raw, str) else raw
        errors = cnl_json.check(doc)
    elif variant == 'cnl-kv':
        errors = cnl_kv.check(raw)
        doc = cnl_kv.parse(raw) if not errors else None
    elif variant == 'cnl-e':
        errors = cnl_check.check(raw)
        doc = cnl_json.to_json(raw) if not errors else None
        if doc is not None:
            errors += cnl_json.check(doc)
    else:
        raise ValueError('Unknown CNL-E variant')
    if errors:
        raise ValueError('; '.join(errors))
    rendered = cnl_kv.dumps(doc)
    back = cnl_kv.parse(rendered)
    if cnl_json.slots(back) != cnl_json.slots(doc):
        raise ValueError('Canonical conversion lost semantic slots')
    return {'cnl': rendered, 'ir': doc}


if __name__ == '__main__':
    try:
        request = json.load(sys.stdin)
        print(json.dumps({'ok': True, **convert(request['variant'], request['raw'])}))
    except Exception as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}))
        sys.exit(1)
