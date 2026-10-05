#!/usr/bin/env python3
"""Checks for scripts/coa-sources.py, without the network: which links on a
brand page are certificates, one spelling per document, and what a daily
scan adds."""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("coa_sources", ROOT / "scripts/coa-sources.py")
cs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cs)
failures = []


def check(cond, what):
    if not cond:
        failures.append(what)


PAGE = "https://brand.example/coa#main"
HTML = """
<nav><a href="/shop">Shop</a> <a href="https://instagram.com/brand">IG</a></nav>
<a href="/files/Blue%20Dream%203.5g.pdf"><span>Blue Dream</span> Lot #: BD01</a>
<a href='https://ny.yourcoa.com/coa/coa-view?sample=AL40619005-007'>VIEW AL40619005-007 REPORT</a>
<a href="https://ny-keystonestatetesting.grow.labware.cloud/COA?guid=ABC-1">GELATO : HH-1</a>
<a href="https://drive.google.com/file/d/1abc/view?usp=sharing">Mochi</a>
<a href="https://drive.google.com/drive/folders/xyz">All COAs</a>
<script>var gallery={"items":[{"src":"https:\\/\\/brand.example\\/wp-content\\/uploads\\/2026\\/05\\/Gas%20Leak.pdf"}]}</script>
<a href="/files/Blue Dream 3.5g.pdf">again, spelled with spaces</a>
"""

# --- which links are certificates
links = cs.certificate_links("https://brand.example/coa", HTML)
urls = [u for u, _l, _w in links]
check(urls == [
    "https://brand.example/files/Blue%20Dream%203.5g.pdf",
    "https://ny.yourcoa.com/coa/coa-download/AL40619005-007",
    "https://ny-keystonestatetesting.grow.labware.cloud/COA?guid=ABC-1",
    "https://brand.example/wp-content/uploads/2026/05/Gas%20Leak.pdf",
], f"certificate links, one spelling each: {urls}")
check(links[0][1] == "Blue Dream Lot #: BD01" and links[0][2] == "anchor", f"anchor text is the label: {links[0]}")
check(links[-1][2] == "embedded-page-config" and links[-1][1] == "", "a link only in the page's configuration")
check(not cs.is_certificate("https://drive.google.com/drive/folders/xyz")
      and not cs.is_certificate("https://drive.google.com/file/d/1abc/view"), "a Drive folder or viewer is not a readable document")
feed = cs.certificate_links("https://api.brand.example/strains",
                            '{"strains":[{"current_coa":{"pdf_url":"https:\\/\\/api.brand.example\\/blobs\\/x\\/bbm.pdf"}}]}')
check(feed == [("https://api.brand.example/blobs/x/bbm.pdf", "", "page-feed")], f"a link in a JSON feed: {feed}")
check(not cs.is_certificate("https://[broken/a.pdf") and cs.certificate_links(PAGE, '<a href="https://[x/a.pdf">x</a> "https://[y/b.pdf"') == [],
      "a malformed link is skipped, not fatal")
check(cs.same_document("https://x.example/a%20b.pdf") == cs.same_document("https://x.example/a b.pdf"),
      "two spellings of one file are one document")
check(cs.canonical("https://ny.yourcoa.com/coa/coa-view?sample=../x") == "https://ny.yourcoa.com/coa/coa-view?sample=../x",
      "a sample that is not an id is left as published")


# --- a scan: listed pages only, known links kept, new ones pending
class Reader:
    def __init__(self, pages):
        self.pages, self.asked = pages, []

    def get(self, url):
        self.asked.append(url)
        if url not in self.pages:
            raise RuntimeError("robots-disallowed")
        return url, {}, self.pages[url].encode()


doc = {"checkedAt": "2026-10-03T00:00:00+00:00", "scope": "x", "sources": [
    {"brandKey": "brand", "brand": "Brand", "url": "https://brand.example/", "method": "list",
     "status": "published-links", "pages": [PAGE, "https://brand.example/coa"],
     "certificateLinks": [{"url": "https://brand.example/files/Blue%20Dream%203.5g.pdf",
                           "publishedOn": "https://brand.example/coa", "scope": "ny-flower"}]},
    {"brandKey": "other", "brand": "Other", "url": "https://other.example/", "method": None,
     "status": "no-source-link-found", "pages": ["https://other.example/"], "certificateLinks": []},
    {"brandKey": "walled", "brand": "Walled", "url": "https://walled.example/", "method": "list",
     "status": "published-links", "pages": ["https://walled.example/coa"], "certificateLinks": []},
]}
reader = Reader({"https://brand.example/coa": HTML})
added, failed, read = cs.scan(doc, reader, "2026-10-05T12:00:00+00:00")
check(reader.asked == ["https://brand.example/coa", "https://walled.example/coa"],
      f"each listed page once, without its #fragment; nothing for a source with no published links: {reader.asked}")
check(added == {"Brand": 3} and read == 2, f"three new links: {added}, {read}")
brand = doc["sources"][0]["certificateLinks"]
check(brand[0]["scope"] == "ny-flower" and "firstSeenAt" not in brand[0], "a reviewed link stays as reviewed")
check(all(l["scope"] == "pending-review" and l["firstSeenAt"] == "2026-10-05T12:00:00+00:00" for l in brand[1:]),
      "new links are pending, with the moment first seen")
check(failed == [("Walled", "https://walled.example/coa", "robots-disallowed")], f"an unread page is named: {failed}")
added2, _f, _r = cs.scan(doc, Reader({"https://brand.example/coa": HTML}), "2026-10-06T12:00:00+00:00")
check(added2 == {}, f"read again, nothing new: {added2}")
text = cs.report(added, failed, read)
check("новых ссылок на сертификаты: **3** (Brand 3)" in text and "Walled: robots-disallowed" in text, f"report: {text}")

if failures:
    print(f"coa-sources-check: {len(failures)} ошибок")
    for f in failures:
        print("  -", f)
    sys.exit(1)
print("coa-sources-check: ok")
