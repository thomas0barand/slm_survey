"""
src/export.py
─────────────
Génère data.js à la racine du projet dashboard.

Input:  data/enriched_articles.json
Output: data.js  (à la racine du repo, au même niveau que index.html)

Usage (depuis la racine du projet):
    python src/export.py
"""

import json
from pathlib import Path
from collections import defaultdict

ROOT   = Path(__file__).parent.parent   # racine slm_survey/
INPUT  = ROOT / "data" / "enriched_articles.json"
OUTPUT = ROOT / "data.js"              # à la racine, même niveau qu'index.html

def relevance(a: dict) -> float:
    s = a.get("category_confidence", 0) * 0.5 + a.get("subcategory_confidence", 0) * 0.5
    if a.get("needs_review"): s -= 0.05
    return round(s, 4)

print(f"Reading {INPUT.relative_to(ROOT)} …")
with open(INPUT, encoding="utf-8") as f:
    raw = json.load(f)
print(f"  {len(raw)} articles trouvés")

articles = []
for a in raw:
    articles.append({
        "title":        (a.get("title") or "")[:150],
        "authors":      ", ".join((a.get("authors") or [])[:3]) or "Unknown",
        "summary":      (a.get("ai_summary") or a.get("summary") or "")[:300],
        "date":         a.get("published_date", ""),
        "url":          a.get("url", ""),
        "source":       a.get("source", ""),
        "category":     a.get("category", ""),
        "subcategory":  a.get("subcategory", ""),
        "relevance":    relevance(a),
        "needs_review": a.get("needs_review", True),
    })

articles.sort(key=lambda x: -x["relevance"])

taxonomy: dict = defaultdict(lambda: defaultdict(int))
for a in articles:
    taxonomy[a["category"]][a["subcategory"]] += 1
taxonomy_clean = {cat: dict(subs) for cat, subs in sorted(taxonomy.items())}

data_js = (
    "/* AUTO-GENERATED — ne pas éditer manuellement\n"
    "   Relancez src/export.py pour régénérer ce fichier\n"
    "*/\n"
    f"const ARTICLES_DATA = {json.dumps(articles, ensure_ascii=False, separators=(',',':'))};\n"
    f"const TAXONOMY_DATA = {json.dumps(taxonomy_clean, ensure_ascii=False, indent=2)};\n"
)

with open(OUTPUT, "w", encoding="utf-8") as f:
    f.write(data_js)

print(f"✓  data.js généré ({len(data_js)//1024} KB)")
print(f"   {len(articles)} articles, {len(taxonomy_clean)} catégories")
