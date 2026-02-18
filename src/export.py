"""
export.py — génère data.js pour le dashboard
─────────────────────────────────────────────
Input:  data/enriched_articles.json
Output: dashboard/data.js  (contient les données embarquées)

Usage:
    python src/export.py
"""

import json
from pathlib import Path
from collections import defaultdict

ROOT   = Path(__file__).parent.parent
INPUT  = ROOT / "data" / "enriched_articles.json"
OUTPUT = ROOT / "dashboard" / "data.js"

def relevance(a: dict) -> float:
    s = a.get("category_confidence", 0) * 0.5 + a.get("subcategory_confidence", 0) * 0.5
    if a.get("needs_review"): s -= 0.05
    return round(s, 4)

print(f"Reading {INPUT} …")
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

articles_json  = json.dumps(articles,       ensure_ascii=False, separators=(",", ":"))
taxonomy_json  = json.dumps(taxonomy_clean, ensure_ascii=False, indent=2)

data_js = f"""/* AUTO-GENERATED — ne pas éditer manuellement
   Relancez src/export.py pour régénérer ce fichier
*/
const ARTICLES_DATA = {articles_json};
const TAXONOMY_DATA = {taxonomy_json};
"""

with open(OUTPUT, "w", encoding="utf-8") as f:
    f.write(data_js)

print(f"✓  {len(articles)} articles → {OUTPUT.relative_to(ROOT)}")
print(f"✓  {len(taxonomy_clean)} catégories dans la taxonomie")
print(f"   Taille : {len(data_js)//1024} KB")
print(f"\nRafraîchissez le navigateur pour voir les changements.")
