#!/usr/bin/env python3
"""Offline fixtures for coa-forensics.py. No network."""
import importlib.util
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("coa_forensics",ROOT/"scripts/coa-forensics.py")
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

fixtures=[
("""Green Analytics
Sample ID: GA-260519-001
Batch ID: 1A41203000026BA000000014
Sampling Date: 05/19/2026
Report Date: 05/22/2026
Total THC 26.10 %
Beta Caryophyllene 0.3020 %
Limonene 0.4226 %
Myrcene ND %
Moisture Content 10.4 %
Water Activity 0.58
""","Green Analytics","2026-05-19"),
("""Kaycha Labs
Sample #: K-12345
Sampled Date: 12/12/25
THCA 28.44 %
Delta-9 THC <LOQ %
Linalool 0.3408 %
""","Kaycha","2025-12-12"),
("""Keystone State Testing
Lab ID: KS-7788
Date Sampled: 10/15/2025
THC 24.16 %
β-Caryophyllene 1.181 %
α-Pinene 0.1112 %
""","Keystone","2025-10-15"),
("""ACT Lab
Sample ID: ACT-99
Sample Received: 01/28/2025
CBD N/D %
Limonene 0.52 %
""","ACT",None),
]

for text,lab,sampled in fixtures:
    r=m.parse_text(text)
    assert r["lab"]==lab,(lab,r)
    assert r["sampled"]==sampled,(sampled,r)

r=m.parse_text(fixtures[0][0])
assert r["analytes"]["beta_myrcene"]["value"] is None
assert r["analytes"]["beta_myrcene"]["qualifier"]=="ND"
assert r["analytes"]["beta_caryophyllene"]["value"]==0.302
assert r["moisture"]==10.4 and r["waterActivity"]==0.58

r=m.parse_text(fixtures[1][0])
assert r["analytes"]["delta_9_thc"]["value"] is None
assert r["analytes"]["delta_9_thc"]["qualifier"]=="<LOQ"

a=m.parse_text("Total THC 26.10 %\nLimonene 0.4226 %\n")
b=m.parse_text("Total THC 26.10 %\nLimonene 0.4226 %\n")
c=m.parse_text("Total THC 26.11 %\nLimonene 0.4226 %\n")
assert m.chemistry_fingerprint(a)==m.chemistry_fingerprint(b)
assert m.chemistry_fingerprint(a)!=m.chemistry_fingerprint(c)
assert m.sha256_bytes(b"abc")=="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"

# Real headers from the 2026-09-30 pilot (app.alleaves.com/.../coa/NNNNN.pdf):
# column headings and notes were read as identifiers.
drs=m.parse_text("""   Finger Lakes Hydro LLC                                   Sample: 2511RLI1133-4373
   Bloom eld, NY 14469                                     Batch#: 1027000000006604; Batch Size: 1200 units
   info@6pointcannabis.com                            Sample Received: 11/16/2025; Report Created: 11/24/2025;
                                                          Sample Collection Date/Time: 11/14/25 12:55
   Parent Lot:                                            Sampling Notes/Deviations:
   Limonene                                                0.0125                  0.60                 6.05
DRS Testing makes no claims""")  # 18764.pdf
assert drs["lab"]=="DRS" and drs["lotNumber"] is None, drs  # was "Sampling"
assert drs["sampleId"]=="2511RLI1133-4373" and drs["batchTag"]=="1027000000006604"
assert (drs["sampled"],drs["received"],drs["reported"])==("2025-11-14","2025-11-16","2025-11-24")
assert drs["analytes"]=={}  # LOQ, %, mg/g columns: no generic guess at which is the result

mcr=m.parse_text("""Hybrid Theory                       Report Date                            2/4/2026        MCR Labs
   Sample ID #                  Sample Name                          Matrix
    S26-00325               Papaya Juice - Flower                    Flower
       Lot #            Lot Size (units)
   PJ-BZA-001                 500                      5""")  # 21444.pdf
assert mcr["lab"]=="MCR" and mcr["sampleId"] is None and mcr["lotNumber"] is None, mcr  # were "Sample", "Size"

kay=m.parse_text("""Kaycha Labs
                     Batch #: 001-725-0001212001                       Lab ID: AL51212002-002
                     Metrc Package #:                                  Completed: 12/21/25
Rolling Hills Wellness llc        Sample: AL51212002-002
CATSKILL, NY, 12414, US           Seed to sale: 1A4120300001DBC000000048          Sampled: 12/12/25
LIMONENE                                                    0.0040   10     PASS     0.6800     23.8000
ALPHA-TERPINENE                                             0.0040   10     PASS     <0.0040    <0.1400""")  # 19893.pdf
assert kay["metrcTag"]=="1A4120300001DBC000000048" and kay["batchTag"]=="001-725-0001212001"
assert kay["sampleId"]=="AL51212002-002" and kay["sampled"]=="2025-12-12" and kay["reported"]=="2025-12-21"

act=m.parse_text("""ACT Laboratories
   Scotch Valley Ranch                                     Sample: SNYSVR0128-PFCU-0012418
   3777 Narrow Notch Rd                                    Batch#: STH102024-B, Batch Size: 3200
   Hobart, New York, 13788                                 Sample Received: 01/28/2025 01:15
   9175534333                                              Report Created: 02/04/2025 17:44""")  # 22666.pdf
assert act["batchTag"]=="STH102024-B" and act["reported"]=="2025-02-04" and act["sampleId"]=="SNYSVR0128-PFCU-0012418"

# A shop's "COA" that is a printout of the package's Metrc Retail ID card.
card=m.parse_text("""metrc
retail iD   ™
                                       Product Details
                Major - 3.5g - Applescotti - 3.5g
                 Cultivar                                              Applescotti
                 ID                               1A41203000004F0000000735
                 Facility                                         Fela's Farm LLC
                 Product Name                    Major - 3.5g - Applescotti - 3.5g
                 License                               OCM-MICR-24-000175-P2
                 Tested By                                       Kaycha Labs NY
                 Tested Date                                           12/17/2025
                 Laboratory License                      OCM-CPL-24-00006-L1
                 Cultivation Date                                      02/18/2026
                 Packaged Date                                         02/18/2026
                 Is Production Batch                                         false
                 Limonene                                    0.81%
                 Geraniol                                    0%""")  # 22008.pdf
assert card["docType"]=="metrc-retail-id" and card["batchTag"] is None, card  # was "false"
assert card["metrcTag"]=="1A41203000004F0000000735" and card["lab"]=="Kaycha" and card["strain"]=="Applescotti"
assert (card["tested"],card["packaged"],card["cultivated"])==("2025-12-17","2026-02-18","2026-02-18")
assert card["productionBatch"] is False and "harvested" not in card  # cultivation is not harvest
assert card["analytes"]["limonene"]["value"]==0.81
# The card's slate fills unreported terpenes with 0%: not a value to match on.
assert card["analytes"]["geraniol"]=={"value":None,"unit":"%","qualifier":"reported_zero"}

# The newer Retail ID page: label above value, THC with a mg/pkg column. Good
# Money's "Zeven Up" certificate (30965.pdf) is package …870 of batch …014.
page=m.parse_text("""                                                                   metrc
                                                                   retail ID   TM
 This product is regulated by the New York State Office of Cannabis Management.
    Name                                                                    Zeven Up
    Total THC                                           261 mg/pkg                 26.1%
β-Myrcene                                    0.4265%
Limonene                                     0.4226%
Package Details
 PACKAGE TAG
 1A4120300002719000000870
 FACILITY
 Pierre McClain LLC
 FACILITY LICENSE
 OCM-MICR-25-000246-DX1
 PACKAGED ON
 06/11/2026
 TESTED DATE
 10/28/2025
 TESTED BY
 Keystone State Testing, LLC""")
assert page["docType"]=="metrc-retail-id" and page["metrcTag"]=="1A4120300002719000000870", page
assert (page["product"],page["facility"],page["lab"])==("Zeven Up","Pierre McClain LLC","Keystone")
assert (page["tested"],page["packaged"])==("2025-10-28","2026-06-11")
assert page["analytes"]["total_thc"]["value"]==26.1 and page["analytes"]["beta_myrcene"]["value"]==0.4265
# The mg/pkg column is read only on a printout; a lab's row is not guessed at.
assert m.analytes("Total THC   261 mg/pkg   26.1%")=={}

# A bound is not a measurement.
r=m.parse_text("Linalool <0.0040 %\n")
assert r["analytes"]["linalool"]["value"] is None and r["analytes"]["linalool"]["qualifier"]=="<0.0040"

# A value belongs to its own line: ACT's summary box prints "Limonene" and the
# figure a line below; DRS' "Water Activity" heading sits above other numbers.
assert m.analytes("                    Limonene\n                              0.931%\n")=={}
assert m.physical("   Water Activity\n\n        13.6 %\n")=={}
# Keystone prints LOQ, limit, result: the first number is not the result.
assert m.physical("         Water Activity        0.05        0.65        0.58        Pass")=={}
assert m.physical("         Water Activity        0.3305      ≤ 0.65      Pass")=={"waterActivity":0.3305}  # MCR
assert m.physical("     WATER ACTIVITY        0.32 Aw        PASS")=={"waterActivity":0.32}  # TagLeaf
# Moisture too: CTNY prints the limit first (23788.pdf), MCR the result first.
assert m.physical(" Moisture                         15 %                  9.8 %              Pass")=={}
assert m.physical("     MOISTURE                     11.9 %                        PASS")=={"moisture":11.9}
# Numbers inside method codes, dates and times are not results (MCR, Green Analytics).
assert m.physical("        Moisture Content [TM-NY-1]      Analyst: WP      Test Date: 3/13/2026 16:10")=={}
assert m.physical("  Moisture content analysis utilizing Moisture Balance (MB; SOP-055-GA)")=={}
assert m.physical("        Water Activity [TM-NY-10]      Analyst: BS/WP   Test Date: 2/2/2026 18:20")=={}

# Same words, new bytes (a re-rendered PDF) hash the same text.
assert m.text_sha256("Total THC  26.10 %\n\n") == m.text_sha256("Total THC 26.10 %")
assert m.text_sha256("Total THC 26.10 %") != m.text_sha256("Total THC 26.11 %")

print("coa-forensics-check: OK")
