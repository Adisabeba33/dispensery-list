#!/usr/bin/env python3
"""What a certificate measured: the strain it names, total THC, total terpenes
and the leading terpenes — read from the text pdftotext -layout gives.

Dates and identifiers are read by coa-dates.py and coa-forensics.py; this is
the chemistry, which is what lets a certificate be compared with a shelf: a
jar whose menu prints the same panel as a brand's certificate is that batch,
whatever name the menu gives it.

Every laboratory lays the terpene table out its own way, so the column a
result sits in is decided per laboratory:

- Kaycha:           NAME  LOQ  LIMIT  PASS  RESULT(%)  MG       → after PASS/FAIL
- DRS:              NAME  LOQ  RESULT(%)  RESULT(mg/g)          → second number
- Green Analytics:  NAME  RESULT  LOQ                           → first number
- Keystone:         N NAME  CAS  LOQ  RESULT(%)  mg/g           → second after CAS
- ACT:              NAME  LOQ(ppm)  RESULT(%)  Tested  (two columns a line)
- MCR:              NAME  RESULT(%)  ppm  …                     → first number

A laboratory not listed, or a line that does not fit its layout, gives
nothing rather than a guess: a wrong panel would match the wrong jar.
ND, <LOQ, <MRL and the like are kept as 0.0 — measured, not found.

    python scripts/coa-panel.py some.txt     # the panel of one pdftotext output
"""
import json
import re
import sys

LAB_NEEDLES = [("Kaycha", "Kaycha"), ("Green Analytics", "Green Analytics"), ("DRS Testing", "DRS"),
               ("DRS ", "DRS"), ("Keystone", "Keystone"), ("ACT Lab", "ACT"), ("MCR Labs", "MCR"),
               ("Smithers", "Smithers")]

# The terpenes compared between a certificate and a shelf. Oxides and the
# like are left out: menus rarely print them, and a panel is compared on what
# both sides state.
TERPENES = {
    "myrcene": re.compile(r"^(?:β|b|beta)?[- ]?myrcene$"),
    "caryophyllene": re.compile(r"^(?:β|b|beta)?[- ]?caryophyllene$"),
    "limonene": re.compile(r"^(?:d[- ])?limonene$"),
    "linalool": re.compile(r"^linalool$"),
    "humulene": re.compile(r"^(?:α|a|alpha)?[- ]?humulene$"),
    "alpha-pinene": re.compile(r"^(?:α|a|alpha)[- ]?pinene$"),
    "beta-pinene": re.compile(r"^(?:β|b|beta)[- ]?pinene$"),
    "terpinolene": re.compile(r"^terpinolene$"),
    "ocimene": re.compile(r"^(?:(?:cis|trans)[- ]?(?:β|b|beta)?[- ]?)?ocimene$"),
    "bisabolol": re.compile(r"^(?:α|a|alpha)?[- ]?bisabolol$"),
    "farnesene": re.compile(r"^(?:(?:trans|cis)[- ]?(?:β|b|beta)?[- ]?)?farnesene$"),
}
# The names the register's shelf panels use (data/shelf-terpenes.json), so a
# certificate and a shelf lot are compared key for key.
REGISTER_KEY = {
    "myrcene": "MYRCENE", "caryophyllene": "CARYOPHYLLENE", "limonene": "LIMONENE",
    "linalool": "LINALOOL", "humulene": "HUMULENE", "alpha-pinene": "PINENE_ALPHA",
    "beta-pinene": "PINENE_BETA", "terpinolene": "TERPINOLENE", "ocimene": "OCIMENE",
    "bisabolol": "BISABOLOL", "farnesene": "FARNESENE",
}
NOT_FOUND = re.compile(r"^(?:ND|<.*|NR|N/?A|BQL|BLQ|<\s*MRL|<\s*LOQ)$", re.I)
NUMBER = re.compile(r"^-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$|^-?\d+(?:\.\d+)?$")
CAS = re.compile(r"^\d{2,7}-\d{2}-\d$")
LICENCE = re.compile(r"\bOCM-(?!CPL)[A-Z]{3,6}-\d{2}-\d{6}\b")


def lab_of(text):
    return next((name for needle, name in LAB_NEEDLES if needle in text), None)


def value(token):
    """A result cell → float, 0.0 for 'not found', None for anything else."""
    token = token.strip()
    if NOT_FOUND.match(token):
        return 0.0
    if NUMBER.match(token):
        return float(token.replace(",", ""))
    return None


def terpene_key(name):
    name = re.sub(r"\s+", " ", name.strip().lower()).replace("–", "-")
    name = re.sub(r"^\d+\s+", "", name)  # Keystone numbers its rows
    for key, pattern in TERPENES.items():
        if pattern.match(name):
            return key
    return None


def split_cells(line):
    return [c for c in re.split(r"\s{2,}", line.strip()) if c]


def row_value(lab, cells):
    """The result of one terpene row, from the cells after its name."""
    rest = cells[1:]
    if lab == "Kaycha":
        for i, c in enumerate(rest):
            if c.upper() in ("PASS", "FAIL") and i + 1 < len(rest):
                return value(rest[i + 1])
        # The 2023 layout: NAME  LOQ  mg/unit  %, two columns a line.
        if len(rest) >= 3 and value(rest[0]) is not None:
            return value(rest[2])
        return None
    if lab == "DRS":
        nums = [value(c) for c in rest]
        return nums[1] if len(nums) >= 2 else None
    if lab == "Green Analytics":
        return value(rest[0]) if rest else None
    if lab == "Keystone":
        if rest and CAS.match(rest[0]):
            rest = rest[1:]
        nums = [value(c) for c in rest]
        return nums[1] if len(nums) >= 2 else None
    if lab == "MCR":
        return value(rest[0]) if rest else None
    return None


def act_terpenes(text):
    """ACT prints two columns a line: 'Name  LOQ  RESULT  Tested  Name  LOQ  ND  Tested'."""
    found = {}
    for line in text.splitlines():
        for segment in re.split(r"\b(?:Tested|Passed|Failed)\b", line):
            cells = split_cells(segment)
            if len(cells) < 2:
                continue
            key = terpene_key(cells[0])
            if key and key not in found:
                v = value(cells[-1])
                if v is not None:
                    found[key] = v
    return found


def terpenes_of(text, lab):
    if lab == "ACT":
        return act_terpenes(text)
    found = {}
    for line in text.splitlines():
        cells = split_cells(line)
        # A line may hold two rows side by side (Kaycha 2023): every cell that
        # names a terpene starts a row of its own.
        starts = [i for i, c in enumerate(cells) if terpene_key(c) or (i == 0 and len(cells) >= 2)]
        for n, i in enumerate(starts):
            key = terpene_key(cells[i])
            if not key or key in found:
                continue
            end = starts[n + 1] if n + 1 < len(starts) else len(cells)
            row = cells[i:end]
            if len(row) < 2:
                continue
            v = row_value(lab, row)
            if v is not None and v < 20:
                found[key] = v
    return found


def first_number(s):
    m = re.search(r"(\d+(?:\.\d+)?)", s)
    return float(m.group(1)) if m else None


def thc_of(text, lab):
    lines = text.splitlines()
    if lab == "Keystone":
        m = re.search(r"Total THC:\s*(\d+(?:\.\d+)?)\s*%", text)
        return float(m.group(1)) if m else None
    if lab == "MCR":
        m = re.search(r"Total THC\s*=[^\n]*?(\d+(?:\.\d+)?)%", text)
        return float(m.group(1)) if m else None
    if lab == "Green Analytics":
        m = re.search(r"Total THC\s*\[[^\]]*\][^\n\d]*(\d+(?:\.\d+)?)", text)
        return float(m.group(1)) if m else None
    if lab == "ACT":
        for line in lines:
            m = re.match(r"\s*Total THC\s{2,}(.*)", line)
            if m:
                nums = [value(c) for c in split_cells(m.group(1))]
                nums = [n for n in nums if n is not None]
                if len(nums) >= 2:
                    return nums[1]
        return None
    if lab in ("Kaycha", "DRS"):
        for i, line in enumerate(lines):
            if re.search(r"\bTotal THC\b", line) and ":" not in line:
                # Kaycha prints the figure under the label, DRS above it.
                window = lines[i + 1:i + 4] if lab == "Kaycha" else lines[max(0, i - 2):i][::-1]
                for w in window:
                    m = re.search(r"(\d+(?:\.\d+)?)\s*%", w)
                    if m:
                        return float(m.group(1))
        return None
    return None


def total_terpenes_of(text, lab):
    for line in text.splitlines():
        cells = split_cells(line)
        if not cells or not re.match(r"(?i)total terpenes", cells[0]):
            continue
        if lab == "Kaycha":
            v = row_value("Kaycha", cells)
        elif lab == "ACT":
            nums = [value(c) for c in cells[1:] if value(c) is not None]
            v = nums[-1] if nums else None
        elif lab in ("Green Analytics", "MCR"):
            v = value(cells[1]) if len(cells) > 1 else None
        else:
            v = None
        if v is not None and 0 < v < 20:
            return v
    return None


def name_of(text, lab):
    m = re.search(r"Strain:\s*([^,\n]+?)(?:,|\s{2,}|\n|$)", text)
    if m and m.group(1).strip():
        return m.group(1).strip()
    lines = text.splitlines()
    for i, line in enumerate(lines):
        at = line.find("Sample Name:")
        if at < 0:
            continue
        same_line = re.match(r"[ \t]*(\S.*?)(?:\s{2,}|$)", line[at + len("Sample Name:"):])
        if same_line:
            return same_line.group(1).strip()
        # Green Analytics wraps a long name around its label: the line above
        # and the line below carry it, in the label's column.
        parts = [lines[j][at:].strip() for j in (i - 1, i + 1) if 0 <= j < len(lines) and len(lines[j]) > at]
        parts = [p for p in parts if p and ":" not in p.split("  ")[0]]
        if parts:
            return " ".join(parts)
        return None
    if lab == "Kaycha":
        # The product, printed under the laboratory's name at the top right.
        for i, line in enumerate(lines[:6]):
            if line.strip() == "Kaycha Labs":
                for nxt in lines[i + 1:i + 4]:
                    if nxt.strip() and ":" not in nxt:
                        return nxt.strip()
    if lab == "MCR":
        for i, line in enumerate(lines):
            if "Sample Name" in line:
                for nxt in lines[i + 1:i + 5]:
                    cells = split_cells(nxt)
                    if len(cells) >= 2:
                        return cells[1]
    if lab == "Keystone":
        for i, line in enumerate(lines):
            if line.strip().startswith("Report #"):
                for nxt in lines[i + 1:i + 3]:
                    cells = split_cells(nxt)
                    if cells:
                        return cells[0]
    return None


def matrix_of(text):
    """Flower, or what else the document says it tested."""
    m = re.search(r"(?:Matrix|Category/Type|Sample Type|Product Type|Category):\s*([^\n]+?)(?:\s{2,}|\n|$)", text)
    said = (m.group(1) if m else "").lower()
    if re.search(r"pre-?roll|vape|cartridge|edible|gumm|concentrate|extract|rosin|resin|tincture|oil|infused", said):
        return "other"
    if "flower" in said or "plant" in said or "bud" in said:
        return "flower"
    head = text[:3000].lower()
    if re.search(r"pre-?roll|vape|cartridge|gummies|gummy|chocolate|live resin|rosin|tincture", head):
        return "other"
    if "flower" in head:
        return "flower"
    return None


def panel(text):
    """The panel a certificate states, or None when it states none we can read."""
    lab = lab_of(text)
    terps = terpenes_of(text, lab) if lab else {}
    thc = thc_of(text, lab) if lab else None
    if thc is not None and not (0 < thc < 50):
        thc = None
    if not terps and thc is None:
        return None
    total = total_terpenes_of(text, lab) if lab else None
    lic = LICENCE.search(text)
    return {
        "lab": lab,
        "name": name_of(text, lab),
        "matrix": matrix_of(text),
        "licence": lic.group(0) if lic else None,
        "thc": round(thc, 2) if thc is not None else None,
        "totalTerpenes": round(total, 3) if total is not None else None,
        "terpenes": {REGISTER_KEY[k]: round(v, 3) for k, v in sorted(terps.items())},
    }


if __name__ == "__main__":
    for path in sys.argv[1:]:
        print(path, json.dumps(panel(open(path, errors="ignore").read()), ensure_ascii=False))
