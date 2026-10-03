#!/usr/bin/env python3
"""Offline checks for scripts/coa-panel.py: one excerpt per laboratory layout.

The excerpts reproduce how pdftotext -layout lays each laboratory's table out
(column order, two-column lines, labels above or below their figures); the
figures are test values. A wrong column here would match a certificate to the
wrong jar, so each layout pins which column is the result."""
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("coa_panel", ROOT / "scripts/coa-panel.py")
cp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cp)
failures = []


def check(cond, what):
    if not cond:
        failures.append(what)


KAYCHA = """                                                       Kaycha Labs
                                                     Blue Dream Flower
                                                     Strain: Blue Dream
1 Winners Circle                                          Matrix: Flower
Skyrose Farms
License # : OCM-CULT-24-000119
                Total THC                                    Total CBD                 Total Cannabinoids
                27.8033%                                     <0.1000                   32.8998%
ANALYTES                                   LOQ        LIMIT    PASS/FAIL RESULT (%) (MG/UNIT) QUALIFIER
TOTAL TERPENES                             0.1000     11.5     PASS             1.8300     64.0500
BETA-CARYOPHYLLENE                         0.0040     10       PASS             0.6800     23.8000
BETA-MYRCENE                               0.0040     10       PASS             0.2600     9.1000
LIMONENE                                   0.0040     10       PASS             0.1900     6.6500
TERPINOLENE                                0.0040     10       PASS             <0.0040    <0.1400
State License # OCM-CPL-2022-00006
"""
p = cp.panel(KAYCHA)
check(p and p["lab"] == "Kaycha" and p["name"] == "Blue Dream", f"Kaycha name: {p}")
check(p and p["thc"] == 27.8 and p["totalTerpenes"] == 1.83, f"Kaycha THC under its label, total terpenes: {p}")
check(p and p["terpenes"] == {"CARYOPHYLLENE": 0.68, "MYRCENE": 0.26, "LIMONENE": 0.19, "TERPINOLENE": 0.0},
      f"Kaycha result after PASS, <LOQ as 0: {p}")
check(p and p["licence"] == "OCM-CULT-24-000119", f"the client's licence, not the lab's: {p}")
check(p and p["matrix"] == "flower", f"Kaycha matrix: {p}")

KAYCHA_2023 = """                                                       Kaycha Labs
                                                        Slapz 3.5
    1 Winners Circle                                   Matrix: Flower
    Terpenes                          LOQ     mg/unit %          Result (%)            Terpenes        LOQ       mg/unit %     Result (%)
    ALPHA-PINENE                      0.004   3.5     0.1                              BORNEOL           0.004     <LOQ   <LOQ
    LIMONENE                          0.004   35.0    1.0                              ALPHA-BISABOLOL   0.004     3.5    0.1
    BETA-MYRCENE                      0.004   <LOQ    <LOQ                             ALPHA TERPINEOL   0.004     3.5    0.1
"""
p = cp.panel(KAYCHA_2023)
check(p and p["terpenes"].get("LIMONENE") == 1.0 and p["terpenes"].get("BISABOLOL") == 0.1
      and p["terpenes"].get("MYRCENE") == 0.0 and p["terpenes"].get("PINENE_ALPHA") == 0.1,
      f"Kaycha 2023, two rows a line: {p}")
check(p and p["name"] == "Slapz 3.5", f"Kaycha product line when no Strain: {p}")

DRS = """DRS Testing                                                        Strain: Acapulco Gold
                             30.51%                                   ND                     13.1%
                            Total THC                               Total CBD                Moisture
   Limonene                                                0.0125                  0.20                 2.02
   β-Myrcene                                               0.0125                  0.17                 1.66
   β-Caryophyllene                                         0.0125                  0.09                 0.93
   Caryophyllene Oxide                                     0.0125                   ND                   ND
   β-Pinene                                                0.0125                   ND                   ND
   License #: OCM-PROC-24-000002
"""
p = cp.panel(DRS)
check(p and p["thc"] == 30.51, f"DRS THC above its label: {p}")
check(p and p["terpenes"] == {"LIMONENE": 0.2, "MYRCENE": 0.17, "CARYOPHYLLENE": 0.09, "PINENE_BETA": 0.0},
      f"DRS second column, oxide left out: {p}")

GA = """Green Analytics
Client Name:                AP COHEN LICENSING INC. dba 1Off                     Sample Name:                French Cookie
License Number:             OCM-PROC-24-000062                                   Batch Lot ID:               10-8F-DL001-FC
Matrix: Flower
  Total THC [ Δ8-THC + Δ9-THC + Δ10-THC + (THCA * 0.877)) ]                  21.467                751.353
   beta-Myrcene                                  0.21                             0.05
   Limonene                                      0.74                             0.05
   Caryophyllene oxide                          < MRL                             0.05
   Linalool                                     < MRL                             0.05
  Total Terpenes (% w/w)                              1.91                   10                     PASS
"""
p = cp.panel(GA)
check(p and p["name"] == "French Cookie" and p["thc"] == 21.47 and p["totalTerpenes"] == 1.91, f"Green Analytics: {p}")
check(p and p["terpenes"] == {"MYRCENE": 0.21, "LIMONENE": 0.74, "LINALOOL": 0.0}, f"Green Analytics first column, < MRL as 0: {p}")
check(p and p["licence"] == "OCM-PROC-24-000062", f"Green Analytics licence: {p}")

GA_WRAPPED = """Green Analytics
Date Reported:              3/20/2026                                          Sample ID:                  20260316-HMOF-012
Client Name:                HM OPS dba HMOP-Flowerhouse                                                    Grocery | Mixed Light Flower | 28 Gram |
                                                                               Sample Name:
Sampling Location:          Rock Tavern, New York                                                          Atomic Breath | Hybrid
Contact Name:               Sean Lovely                                        Sample Matrix:              Flower
  Total THC [ Δ8-THC + Δ9-THC + Δ10-THC + (THCA * 0.877)) ]                  27.03                946.05
   beta-Myrcene                                  0.21                             0.05
"""
p = cp.panel(GA_WRAPPED)
check(p and p["name"] == "Grocery | Mixed Light Flower | 28 Gram | Atomic Breath | Hybrid",
      f"Green Analytics name wrapped around its label, never the next label: {p}")

KEYSTONE = """Keystone State Testing
    License #: OCM-PROC-24-000002
 Report #: 57280
 Acapulco Gold 1/4 Oz Pouch
 Category/Type: Plant, Flower - Cured
                                                   Total THC: 20.98 % - 209.8 mg/g
  1 Beta-myrcene                                      123-35-3        0.1000          0.2199
  4 Beta-caryophyllene                                 87-44-5        0.1000            ND
  5 Limonene                                         5989-27-5        0.1000          0.1100      1.100
"""
p = cp.panel(KEYSTONE)
check(p and p["name"] == "Acapulco Gold 1/4 Oz Pouch" and p["thc"] == 20.98, f"Keystone: {p}")
check(p and p["terpenes"] == {"MYRCENE": 0.22, "CARYOPHYLLENE": 0.0, "LIMONENE": 0.11}, f"Keystone after CAS and LOQ: {p}")

ACT = """ACT Laboratories                                   Strain: Rainbow Chipz, Unit Weight: 3.5000g
  Total THC                                         281.97      28.20        986.91        Water Activity
  Total Terpenes                                          115,000 4.348         Passed     Eucalyptol          84        ND     Tested
  b-Caryophyllene                           84                        1.312     Tested     DL-Menthol          84        ND     Tested
  Limonene                                  84                        0.931     Tested     Linalool            84        0.070  Tested
"""
p = cp.panel(ACT)
check(p and p["name"] == "Rainbow Chipz" and p["thc"] == 28.2, f"ACT name and THC (the % column): {p}")
check(p and p["terpenes"] == {"CARYOPHYLLENE": 1.312, "LIMONENE": 0.931, "LINALOOL": 0.07}, f"ACT two columns a line: {p}")

MCR = """MCR Labs
   Sample ID #                 Sample Name                          Matrix                         Sample Type
    S25-02414               Banana Creme 6.5g                       Flower                            Adult Use
         Total THC = THC + (THCA * 0.877)                                     41.8%                      N/A
                     β-Myrcene                  0.4142            4142            0.0021              21
                    D-Limonene                  0.2751            2751            0.0022              22
                   Total Terpenes                        1.7104                            10.0000                          Pass
"""
p = cp.panel(MCR)
check(p and p["name"] == "Banana Creme 6.5g" and p["thc"] == 41.8 and p["totalTerpenes"] == 1.71, f"MCR: {p}")
check(p and p["terpenes"] == {"MYRCENE": 0.414, "LIMONENE": 0.275}, f"MCR first column: {p}")

# What the reader refuses.
check(cp.panel("Some Unknown Lab\nTotal THC 25%\nLimonene 0.1 0.2\n") is None, "an unknown laboratory gives no panel")
check(cp.matrix_of("Kaycha Labs\nMatrix: Pre-Roll\n") == "other", "a pre-roll is not flower")
check(cp.matrix_of("Matrix: Flower\n") == "flower", "flower is flower")

if failures:
    print(f"coa-panel-check: {len(failures)} failed")
    for f in failures:
        print("  -", f)
    raise SystemExit(1)
print("coa-panel-check: OK (Kaycha, Kaycha 2023, DRS, Green Analytics, Keystone, ACT, MCR)")
