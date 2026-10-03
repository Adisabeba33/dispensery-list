#!/usr/bin/env python3
"""Offline document/date and robots-policy regression checks."""
import importlib.util
import json
import tempfile
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
m = load('coa_dates', 'coa-dates.py')
h = m.http
# Labels taken from published lab layouts; values are offline test examples.
for lab, label, basis in [('Kaycha', 'Sampled Date', 'sampled'),
                         ('Green Analytics', 'Sampling Date', 'sampled'),
                         ('DRS Testing', 'Sample Collection Date/Time', 'sampled'),
                         ('ACT Laboratories', 'Sample Received', 'received'),
                         ('Keystone', 'Date Sampled', 'sampled'),
                         ('Smithers', 'Sample Collected', 'sampled')]:
    text = f'{lab}\n{label}: 05/11/2026\nBatch #: LOT-1234\nSeed to sale: 1A4120300001DBC000000048\n'
    r = m.read(text)
    assert (r['sampled'], r['sampledFrom']) == ('2026-05-11', basis), r
    ids = m.identifiers(text, text.encode())
    assert ids['batchTag'] == 'LOT-1234' and ids['metrcTag'] == '1A4120300001DBC000000048', ids
assert m.read('Smithers\nSample Collected: 05/11/2026')['lab'] == 'Smithers'
assert m.read('Date Collected: May 28, 2026')['sampledFrom'] == 'sampled'
assert m.read('Report Date: 05/11/2026')['sampledFrom'] == 'reported'
assert m.read('Kaycha\nSampled: 05/11/2026')['packaged'] is None
card = m.read('metrc\nretail ID\nPackage Details\nPACKAGE TAG\n1A4120300001DBC000000048\nPACKAGED ON\n02/18/2026\nTESTED DATE\n12/17/2025\nTESTED BY\nKaycha Labs NY\n')
assert (card['sampled'], card['sampledFrom'], card['packaged'], card['packagedFrom']) == ('2025-12-17', 'tested', '2026-02-18', 'metrc-retail-id'), card
assert card['harvested'] is None
assert m.iso('02/30/2026') is None

p = h.robot_rules('User-agent: *\nDisallow: /private\nAllow: /private/public\nDisallow: /*.pdf$\n')
assert not h.allowed(p, 'https://x.test/private/a')
assert h.allowed(p, 'https://x.test/private/public/a')
assert not h.allowed(p, 'https://x.test/report.pdf')
assert h.allowed(p, 'https://x.test/report.pdf?public=1')
p = h.robot_rules('User-agent: *\nDisallow: /\nUser-agent: the-flower-index\nAllow: /\nCrawl-delay: 4\n')
assert h.allowed(p, 'https://x.test/report.pdf') and p['delay'] == 4
p = h.robot_rules('User-agent: *\nDisallow: /a\nAllow: /a\n')
assert h.allowed(p, 'https://x.test/a')

with tempfile.TemporaryDirectory() as tmp:
    reader = h.Reader(Path(tmp) / 'state.json')
    calls = []
    def request(url, **kwargs):
        calls.append(url)
        if url.endswith('/robots.txt'):
            return 200, {}, b'User-agent: *\nDisallow: /denied\n'
        if url.endswith('/start'):
            return 302, {'Location': 'https://other.test/denied.pdf'}, b''
        raise AssertionError('Forbidden content request: ' + url)
    reader.request = request
    try:
        reader.get('https://x.test/start')
        raise AssertionError('redirect must check target robots')
    except h.SourceBlocked as e:
        assert str(e) == 'robots-disallowed'
    assert calls == ['https://x.test/robots.txt', 'https://x.test/start', 'https://other.test/robots.txt'], calls
    reader = h.Reader(Path(tmp) / 'state.json')
    reader.request = lambda *a, **k: (403, {}, b'')
    try:
        reader.get('https://x.test/report.pdf')
        raise AssertionError('unavailable robots must fail closed')
    except h.SourceBlocked as e:
        assert str(e) == 'robots-unavailable-403'
    reader = h.Reader(Path(tmp) / 'state.json')
    class Response:
        code = 500
        headers = {}
        def read(self, limit): return b'error'
        def __enter__(self): return self
        def __exit__(self, *args): pass
    reader.opener.open = lambda *a, **k: Response()
    # Avoid real sleeps, preserving production pacing.
    original_sleep = h.time.sleep
    h.time.sleep = lambda _: None
    try:
        for _ in range(5): reader.request('https://x.test/report.pdf')
        try:
            reader.request('https://x.test/report.pdf')
            raise AssertionError('sixth request must be blocked')
        except h.SourceBlocked as e:
            assert str(e) == 'host-stopped-for-24h'
        assert datetime.fromisoformat(reader.state['https://x.test']['blockedUntil']) > datetime.now(timezone.utc)
        assert h.Reader(reader.path).state['https://x.test']['errors'] == 5
    finally:
        h.time.sleep = original_sleep
    sources = Path(tmp) / 'sources.json'
    sources.write_text(json.dumps({'sources': [{'certificateLinks': [
        {'url': 'https://x.test/good.pdf', 'publishedOn': 'https://brand.test/coas', 'scope': 'ny-flower'},
        {'url': 'https://x.test/other.pdf', 'publishedOn': 'https://brand.test/coas', 'scope': 'other-state'},
        {'url': 'https://x.test/unpublished.pdf', 'scope': 'ny-flower'}]}]}))
    assert list(m.source_links(sources)) == ['https://x.test/good.pdf']
print('coa-dates-check: OK (six labs, date provenance, robots, redirects, cooldown, source scope)')
