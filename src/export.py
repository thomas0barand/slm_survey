"""
export.py
─────────
Generates the two JSON files consumed by the dashboard.

Usage:
    python src/export.py

Input:  data/enriched_articles.json
Output: dashboard/data/articles.json
        dashboard/data/taxonomy.json
"""

import json
from pathlib import Path
from collections import defaultdict

# ── Paths ─────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
INPUT  = ROOT / "data" / "enriched_articles.json"
OUTDIR = ROOT / "dashboard" / "data"

OUTDIR.mkdir(parents=True, exist_ok=True)

# ── Relevance score ───────────────────────────────────────
def relevance(a: dict) -> float:
    score = (
        a.get("category_confidence", 0) * 0.5
        + a.get("subcategory_confidence", 0) * 0.5
    )
    if a.get("needs_review"):
        score -= 0.05
    return round(score, 4)

# ── Load ──────────────────────────────────────────────────
print(f"Reading {INPUT} …")
with open(INPUT, encoding="utf-8") as f:
    raw = json.load(f)

print(f"  {len(raw)} articles found")

# ── Clean ─────────────────────────────────────────────────
articles = []
for a in raw:
    articles.append({
        "title":       (a.get("title") or "")[:150],
        "authors":     ", ".join((a.get("authors") or [])[:3]) or "Unknown",
        "summary":     (a.get("ai_summary") or a.get("summary") or "")[:300],
        "date":        a.get("published_date", ""),
        "url":         a.get("url", ""),
        "source":      a.get("source", ""),
        "category":    a.get("category", ""),
        "subcategory": a.get("subcategory", ""),
        "relevance":   relevance(a),
        "needs_review": a.get("needs_review", True),
    })

# Sort by relevance descending
articles.sort(key=lambda x: -x["relevance"])

# ── Taxonomy from actual data ─────────────────────────────
taxonomy: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
for a in articles:
    taxonomy[a["category"]][a["subcategory"]] += 1

taxonomy_clean = {cat: dict(subs) for cat, subs in sorted(taxonomy.items())}

# ── Write ─────────────────────────────────────────────────
art_path = OUTDIR / "articles.json"
tax_path = OUTDIR / "taxonomy.json"

with open(art_path, "w", encoding="utf-8") as f:
    json.dump(articles, f, ensure_ascii=False, separators=(",", ":"))

with open(tax_path, "w", encoding="utf-8") as f:
    json.dump(taxonomy_clean, f, ensure_ascii=False, indent=2)

print(f"\n✓  {len(articles)} articles → {art_path.relative_to(ROOT)}")
print(f"✓  taxonomy ({len(taxonomy_clean)} categories) → {tax_path.relative_to(ROOT)}")
print(f"\nDashboard data ready. Refresh the browser to see changes.")
