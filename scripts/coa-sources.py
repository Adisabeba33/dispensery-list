#!/usr/bin/env python3
"""Brand certificate pages, read again every day: what a brand published since.

    python scripts/coa-sources.py            # data/coa-sources.json; Markdown summary on stdout

data/coa-sources.json lists, per brand, the pages where it publishes its lab
certificates (found by hand on 3 October 2026). A brand adds certificates to
those pages as new batches are tested — often before the jars reach a shelf —
so the pages are read again each day and every certificate link not seen
before is added as `pending-review`, with the moment it was first seen.
scripts/coa-dates.py then reads pending links, newest first, and the
certificate itself says what it tested (panel.matrix, the client's licence).

Only the pages already listed are read: nothing is followed, guessed or
enumerated, and a page counts only for a source whose links were published
there (status published-links or published-list-folder). Reading goes through
scripts/coa-source-http.py: robots.txt honoured, one request at a time, at
least 2.1 seconds apart (more if robots asks), five host errors stop that host
for a day.

A link is a certificate when its path ends in .pdf or it points at a known
certificate host (a lab's report portal). A Google Drive or Docs viewer is not
taken: its page is not the document, and Drive's robots.txt disallows the
download (/uc), so coa-dates.py could never read it. Links found in anchors
keep their text as the label; links found only in the page's own
configuration (WordPress and Wix galleries) are kept as embedded-page-config,
and links in a feed the brand's page loads its list from (a JSON answer,
listed as the page to read) as page-feed.
"""
import html
import importlib.util
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urljoin, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "data/coa-sources.json"
STATE = ROOT / "data/coa-http-state.json"
READ_STATUSES = {"published-links", "published-list-folder"}
MAX_PAGES = 150  # pages read per run, at most (60 until 8 October 2026, when 39 brands were added)
COA_HOSTS = re.compile(
    r"(^|\.)(yourcoa\.com|labware\.cloud|kaycha\w*\.com|greenanalytics\w*\.com|drsciences\.com|"
    r"actlab\w*\.com|smithers\w*\.com|keystonestatetesting\.com)$",
    re.I,
)

_spec = importlib.util.spec_from_file_location("coa_source_http", ROOT / "scripts/coa-source-http.py")
http = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(http)


def page_key(url):
    """A page without its #fragment: …/coa and …/coa#main are one page."""
    u = urlsplit(url)
    return urlunsplit((u.scheme, u.netloc, u.path, u.query, ""))


def canonical(url):
    """One spelling per document. The path is percent-encoded once (pages
    write the same file as "All Gas .5g.pdf" and "All%20Gas%20.5g.pdf"), and a
    yourcoa.com viewer link (coa-view?sample=X) becomes that site's own
    download link for the same sample (coa-download/X), the form brands also
    publish; a download link keeps no query (?is_view=1 is the same sample).
    coa-dates.py reads the PDF through the viewer when the bare link answers
    with it."""
    u = urlsplit(url)
    if u.netloc.lower().endswith("yourcoa.com") and u.path.rstrip("/").endswith("/coa/coa-view"):
        sample = (parse_qs(u.query).get("sample") or [""])[0]
        if re.fullmatch(r"[A-Za-z0-9-]+", sample):
            return urlunsplit((u.scheme, u.netloc, "/coa/coa-download/" + sample, "", ""))
    # coa-download/X?is_view=1 and coa-download/X are one document: a client's
    # list page links both for every sample
    if u.netloc.lower().endswith("yourcoa.com") and re.fullmatch(r"/coa/coa-download/[A-Za-z0-9-]+", u.path):
        return urlunsplit((u.scheme, u.netloc, u.path, "", ""))
    path = quote(unquote(u.path), safe="/-_.~!$&'()*+,;=:@")
    return urlunsplit((u.scheme, u.netloc, path, u.query, ""))


def same_document(url):
    """The key two spellings of one document share."""
    return unquote(canonical(url))


def is_certificate(url):
    try:
        u = urlsplit(url)
        u.port  # a malformed host ("https://[…") raises here
    except ValueError:
        return False
    if u.scheme not in ("http", "https"):
        return False
    if u.path.lower().endswith(".pdf"):
        return True
    if u.netloc.lower().endswith("yourcoa.com"):
        # a client's list page there also links the portal's own pages
        # (login, the list's next page): only its /coa/ links are documents
        return u.path.lower().startswith("/coa/")
    return bool(COA_HOSTS.search(u.netloc))


ANCHOR = re.compile(r"<a\b[^>]*?\bhref\s*=\s*([\"'])(.*?)\1[^>]*>(.*?)</a\s*>", re.I | re.S)
EMBEDDED = re.compile(r"https?:(?:\\?/){2}[^\s\"'<>\\]+(?:\\?/[^\s\"'<>\\]*)*", re.I)


def certificate_links(page_url, body):
    """(url, label, location) for every certificate link a page publishes:
    anchors first, with their text; then absolute URLs in the page's own
    configuration that no anchor carried."""
    text = body.decode("utf8", "replace") if isinstance(body, bytes) else body
    elsewhere = "page-feed" if text.lstrip()[:1] in ("{", "[") else "embedded-page-config"
    out, seen = [], set()
    for _q, href, inner in ANCHOR.findall(text):
        try:
            url = urljoin(page_url, html.unescape(href.strip()))
        except ValueError:
            continue
        if not is_certificate(url):
            continue
        url = canonical(url)
        if same_document(url) in seen:
            continue
        seen.add(same_document(url))
        label = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", inner))).strip()
        out.append((url, label[:200], "anchor"))
    for raw in EMBEDDED.findall(text):
        url = html.unescape(raw.replace("\\/", "/"))
        if not is_certificate(url):
            continue
        url = canonical(url)
        if same_document(url) in seen:
            continue
        seen.add(same_document(url))
        out.append((url, "", elsewhere))
    return out


def scan(doc, reader, now, max_pages=MAX_PAGES):
    """Read each listed page once and add the certificate links not known
    yet. Returns per-brand counts and the pages that could not be read."""
    known = {same_document(l["url"]) for s in doc["sources"] for l in s.get("certificateLinks", [])}
    added, failed, read = {}, [], 0
    done_pages = set()
    for source in doc["sources"]:
        if source.get("status") not in READ_STATUSES:
            continue
        for page in dict.fromkeys(page_key(p) for p in source.get("pages", [])):
            if page in done_pages or read >= max_pages:
                continue
            done_pages.add(page)
            read += 1
            try:
                final, _headers, body = reader.get(page)
            except Exception as e:  # robots, a wall, the network — named, not fatal
                failed.append((source["brand"], page, str(e)[:80] or type(e).__name__))
                continue
            for url, label, where in certificate_links(final, body):
                if same_document(url) in known:
                    continue
                known.add(same_document(url))
                link = {"url": url, "publishedOn": page, "scope": "pending-review",
                        "linkLocation": where, "firstSeenAt": now}
                if label:
                    link["label"] = label
                source.setdefault("certificateLinks", []).append(link)
                added[source["brand"]] = added.get(source["brand"], 0) + 1
        source["checkedAt"] = now
    doc["checkedAt"] = now
    return added, failed, read


def report(added, failed, read):
    lines = ["### Страницы сертификатов брендов", ""]
    total = sum(added.values())
    lines.append(f"- прочитано страниц: {read}; новых ссылок на сертификаты: **{total}**"
                 + (f" ({', '.join(f'{b} {n}' for b, n in sorted(added.items(), key=lambda x: -x[1]))})" if total else ""))
    if failed:
        lines.append(f"- не прочитаны: {len(failed)} — " + "; ".join(f"{b}: {why}" for b, _p, why in failed[:8]))
    return "\n".join(lines) + "\n"


def main():
    doc = json.loads(SOURCES.read_text())
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    reader = http.Reader(STATE)
    added, failed, read = scan(doc, reader, now)
    SOURCES.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
    print(f"{SOURCES.relative_to(ROOT)}: pages {read}, new links {sum(added.values())}, unread {len(failed)}",
          file=sys.stderr)
    sys.stdout.write(report(added, failed, read))


if __name__ == "__main__":
    main()
