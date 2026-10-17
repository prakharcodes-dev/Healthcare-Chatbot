"""
evaluation/evaluate.py
======================
Evaluates the Healthcare Chatbot's symptom-matcher against test_cases.json.

Reports:
  - Top-1 accuracy  (expected disease is rank-1 result)
  - Top-3 accuracy  (expected disease appears in top-3 results)
  - Top-5 accuracy  (expected disease appears in top-5 results)
  - Per-type breakdown (exact / partial / typo)
  - Worst failures list
  - Saves full results to evaluation/results.md

Usage (from project root):
    python evaluation/evaluate.py
"""

import sys, os, json, datetime

# Allow importing backend modules from project root
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from backend.matcher import EnhancedDiseaseMatcher
from backend.utils import clean_symptoms

# ── Paths ──────────────────────────────────────────────────────────────────
BASE      = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(ROOT, "data", "diseases.json")
TEST_PATH = os.path.join(BASE, "test_cases.json")
RESULTS_PATH = os.path.join(BASE, "results.md")

# ── Load data ──────────────────────────────────────────────────────────────
with open(DATA_PATH, encoding="utf-8") as f:
    diseases = json.load(f)

with open(TEST_PATH, encoding="utf-8") as f:
    test_cases = json.load(f)

matcher = EnhancedDiseaseMatcher(diseases)

# (known_symptoms list kept for reference — clean_symptoms takes just text)

# ── Run evaluation ─────────────────────────────────────────────────────────
results = []

for tc in test_cases:
    tc_id    = tc["id"]
    tc_type  = tc["type"]
    expected = tc["expected_disease"]
    raw_input = tc["input_symptoms"]   # list of symptom strings

    # Join into a phrase so clean_symptoms can tokenise it
    input_text = ", ".join(raw_input)

    cleaned = clean_symptoms(input_text)   # single-arg signature
    if not cleaned:
        cleaned = [s.lower() for s in raw_input]

    matches = matcher.match_with_weights(cleaned)
    ranked  = [m["disease"] for m in matches]

    results.append({
        "id":       tc_id,
        "type":     tc_type,
        "expected": expected,
        "input":    raw_input,
        "cleaned":  cleaned,
        "ranked":   ranked[:5],
        "top1":     expected in ranked[:1],
        "top3":     expected in ranked[:3],
        "top5":     expected in ranked[:5],
        "note":     tc.get("note", ""),
    })

# ── Aggregate metrics ─────────────────────────────────────────────────────
total = len(results)

def acc(key, subset=None):
    pool = [r for r in results if subset is None or r["type"] == subset]
    if not pool:
        return 0.0, 0, 0
    n    = len(pool)
    hits = sum(1 for r in pool if r[key])
    return round(hits / n * 100, 1), hits, n

top1_all,  h1_all, n_all  = acc("top1")
top3_all,  h3_all, _      = acc("top3")
top5_all,  h5_all, _      = acc("top5")

top1_exact,   h1e, ne  = acc("top1", "exact")
top3_exact,   h3e, _   = acc("top3", "exact")
top5_exact,   h5e, _   = acc("top5", "exact")

top1_partial, h1p, np_ = acc("top1", "partial")
top3_partial, h3p, _   = acc("top3", "partial")
top5_partial, h5p, _   = acc("top5", "partial")

top1_typo,    h1t, nt  = acc("top1", "typo")
top3_typo,    h3t, _   = acc("top3", "typo")
top5_typo,    h5t, _   = acc("top5", "typo")

failures = [r for r in results if not r["top5"]]

# ── Console output ─────────────────────────────────────────────────────────
print("\n" + "=" * 62)
print("  SYMPTOM MATCHER EVALUATION RESULTS")
print("=" * 62)
print(f"\nTotal test cases : {total}")
print(f"\nOverall Accuracy")
print(f"  Top-1 : {top1_all:5.1f}%  ({h1_all}/{n_all})")
print(f"  Top-3 : {top3_all:5.1f}%  ({h3_all}/{n_all})")
print(f"  Top-5 : {top5_all:5.1f}%  ({h5_all}/{n_all})")
print(f"\nBy type  (Top-1 / Top-3 / Top-5)")
print(f"  Exact   : {top1_exact:5.1f}% / {top3_exact:5.1f}% / {top5_exact:5.1f}%  (n={ne})")
print(f"  Partial : {top1_partial:5.1f}% / {top3_partial:5.1f}% / {top5_partial:5.1f}%  (n={np_})")
print(f"  Typo    : {top1_typo:5.1f}% / {top3_typo:5.1f}% / {top5_typo:5.1f}%  (n={nt})")
print(f"\nWorst failures (not in top-5): {len(failures)}")
for r in failures[:10]:
    print(f"  [{r['type']:7s}] Expected: {r['expected']}")
    print(f"             Input   : {r['input']}")
    print(f"             Cleaned : {r['cleaned']}")
    print(f"             Top-5   : {r['ranked']}")

# ── Save results.md ────────────────────────────────────────────────────────
now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

md_lines = [
    "# Symptom Matcher — Evaluation Results",
    "",
    f"> Generated: {now}  ",
    f"> Dataset: `data/diseases.json` ({len(diseases)} diseases)  ",
    f"> Test cases: `evaluation/test_cases.json` ({total} cases)",
    "",
    "---",
    "",
    "## Overall Accuracy",
    "",
    "| Metric | Score | Hits / Total |",
    "|--------|-------|--------------|",
    f"| Top-1 Accuracy | **{top1_all}%** | {h1_all} / {n_all} |",
    f"| Top-3 Accuracy | **{top3_all}%** | {h3_all} / {n_all} |",
    f"| Top-5 Accuracy | **{top5_all}%** | {h5_all} / {n_all} |",
    "",
    "---",
    "",
    "## Accuracy by Test Type",
    "",
    "| Type | n | Top-1 | Top-3 | Top-5 |",
    "|------|---|-------|-------|-------|",
    f"| Exact symptoms | {ne} | {top1_exact}% | {top3_exact}% | {top5_exact}% |",
    f"| Partial symptoms (2 of N) | {np_} | {top1_partial}% | {top3_partial}% | {top5_partial}% |",
    f"| Typo symptoms | {nt} | {top1_typo}% | {top3_typo}% | {top5_typo}% |",
    "",
    "---",
    "",
    "## Worst Failures (not in Top-5)",
    "",
]

if not failures:
    md_lines.append("None — perfect Top-5 coverage on all test cases!")
else:
    md_lines += [
        "| # | Type | Expected Disease | Input Symptoms | Top-5 Returned |",
        "|---|------|-----------------|----------------|----------------|",
    ]
    for i, r in enumerate(failures[:20], 1):
        inp = "; ".join(r["input"])
        ret = "; ".join(r["ranked"]) if r["ranked"] else "*(no match)*"
        md_lines.append(f"| {i} | {r['type']} | {r['expected']} | {inp} | {ret} |")

md_lines += [
    "",
    "---",
    "",
    "## All Test Case Results",
    "",
    "| ID | Type | Expected | Top-1 | Top-3 | Top-5 | Rank-1 Returned |",
    "|----|------|----------|-------|-------|-------|----------------|",
]

for r in results:
    t1 = "✅" if r["top1"] else "❌"
    t3 = "✅" if r["top3"] else "❌"
    t5 = "✅" if r["top5"] else "❌"
    r1 = r["ranked"][0] if r["ranked"] else "*(none)*"
    md_lines.append(f"| {r['id']} | {r['type']} | {r['expected']} | {t1} | {t3} | {t5} | {r1} |")

md_lines += [
    "",
    "---",
    "",
    "## Methodology",
    "",
    "- **Matcher**: `backend/matcher.py` — `EnhancedDiseaseMatcher.match_with_weights()`",
    "- **Pre-processing**: `backend/utils.py` — `clean_symptoms()` (medical spell-checker + stop-word removal)",
    "- **Top-k**: The expected disease must appear in the top-k results returned by the matcher",
    "- **Test types**:",
    "  - *Exact* — 3–5 of the disease's own symptoms used as input (40 cases)",
    "  - *Partial* — only the first 2 symptoms used — harder (10 cases)",
    "  - *Typo* — 1 symptom contains a deliberate character-level typo (10 cases)",
]

with open(RESULTS_PATH, "w", encoding="utf-8") as f:
    f.write("\n".join(md_lines))

print(f"\n[OK] Full results saved to: {RESULTS_PATH}")
