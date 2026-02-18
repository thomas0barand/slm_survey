import arxiv
import json
import os
import re
import time
from datetime import datetime, timedelta
from urllib.parse import quote
from dotenv import load_dotenv
from semanticscholar import SemanticScholar
from playwright.sync_api import sync_playwright

load_dotenv()

# --- Configuration ---

MAX_ARXIV_PER_QUERY = 40
MAX_SCHOLAR_PER_QUERY = 20
MAX_LINKEDIN_PER_QUERY = 10
MAX_MEDIUM_PER_QUERY = 10
DAYS_LOOKBACK = 180
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_PATH = os.path.join(DATA_DIR, "raw_articles.json")

sch = SemanticScholar(api_key=os.getenv("SEMANTIC_SCHOLAR_API_KEY"))

# Timestamped raw file created when saving first source in a run
_raw_timestamp_path: str | None = None

CATEGORIES = ["cs.AI", "cs.LG", "cs.CL"]

# S2_API_BASE = "https://api.semanticscholar.org/graph/v1"
# S2_FIELDS = "title,abstract,authors,year,url,venue,publicationDate,externalIds"
# S2_RATE_DELAY = 3.5  # seconds between requests (100 req / 5 min ≈ 1 per 3s)

# ---- ArXiv query groups ----
ARXIV_QUERY_GROUPS = {
    "slm_core": [
        '"Small Language Model"',
        '"Small Language Models"',
        '"SLM" AND language',
        '"compact language model"',
        '"lightweight language model"',
        '"on-device language model"',
    ],
    "edge_ai": [
        '"Edge AI"',
        '"Edge Intelligence"',
        '"On-device AI"',
        '"On-device inference"',
        '"on-device learning"',
        '"on-device model"',
    ],
    "quantization": [
        'Quantization AND "language model"',
        '"post-training quantization" AND LLM',
        '"quantization-aware training" AND LLM',
        '"mixed-precision" AND inference AND language',
        'INT4 AND "language model"',
        'GPTQ OR AWQ OR GGUF AND language',
    ],
    "pruning_distillation": [
        'Pruning AND "language model"',
        '"structured pruning" AND transformer',
        '"Knowledge Distillation" AND "small model"',
        '"Knowledge Distillation" AND "language model"',
        '"model compression" AND "language model"',
        '"low-rank" AND "language model"',
        'LoRA AND edge',
    ],
    "hardware_inference": [
        'NPU AND inference AND neural',
        '"Neural Processing Unit" AND AI',
        '"hardware acceleration" AND "language model"',
        '"efficient inference" AND "language model"',
        'TensorRT OR "TensorFlow Lite" AND "language model"',
        '"inference optimization" AND transformer',
    ],
}

ARXIV_SORT_STRATEGIES = [
    arxiv.SortCriterion.SubmittedDate,
    arxiv.SortCriterion.Relevance,
    arxiv.SortCriterion.LastUpdatedDate,
]

# ---- Google Scholar queries ----
SCHOLAR_QUERIES = [
    "Small Language Model edge deployment",
    "Edge AI on-device inference LLM",
    "model compression quantization small language model",
    "knowledge distillation lightweight LLM",
    "NPU neural processing unit language model",
    "on-device AI model optimization pruning",
    "efficient inference transformer edge",
    "LoRA fine-tuning edge device small model",
]

# ---- LinkedIn queries ----


LINKEDIN_QUERIES = [
    "Small Language Model",
    "SLM edge AI deployment",
    "on-device AI inference",
    "Edge AI language model",
    "model quantization mobile edge",
    "NPU neural processing unit",
    "lightweight LLM on-device",
    "efficient inference edge computing",
    "knowledge distillation small model production",
    "TinyML language model edge",
    "Phi-4 Gemma Qwen small model",
    "on-device LLM privacy",
]

# ---- Medium queries ----
MEDIUM_QUERIES = [
    "Small Language Model",
    "SLM edge AI",
    "on-device AI inference",
    "Edge AI language model",
    "model quantization edge deployment",
    "NPU neural processing unit AI",
    "lightweight LLM on-device",
    "efficient inference edge computing",
    "knowledge distillation small model",
    "TinyML language model",
]


# --- Helpers ---

def _normalize_title(title: str) -> str:
    """Lowercase, strip whitespace/punctuation for dedup comparison."""
    t = title.lower().strip()
    t = re.sub(r"[^a-z0-9 ]", "", t)
    t = re.sub(r"\s+", " ", t)
    return t


def format_apa_citation(authors: list[str], year: int | str, title: str, source: str) -> str:
    if not authors:
        author_str = "Unknown"
    elif len(authors) == 1:
        author_str = authors[0]
    elif len(authors) == 2:
        author_str = f"{authors[0]} & {authors[1]}"
    else:
        author_str = f"{authors[0]} et al."
    return f"{author_str} ({year}). {title}. {source}."


# --- ArXiv ---

def build_arxiv_query(keyword_terms: list[str], categories: list[str]) -> str:
    cat_query = " OR ".join(f"cat:{c}" for c in categories)
    kw_parts = [f"abs:({term})" for term in keyword_terms]
    kw_query = " OR ".join(kw_parts)
    return f"({cat_query}) AND ({kw_query})"


def normalize_arxiv(result: arxiv.Result) -> dict:
    authors = [a.name for a in result.authors]
    published = result.published
    return {
        "title": result.title.replace("\n", " "),
        "authors": authors,
        "summary": result.summary.replace("\n", " "),
        "published_date": published.strftime("%Y-%m-%d"),
        "url": result.entry_id,
        "source": "arxiv",
        "citation_text": format_apa_citation(
            authors, published.year, result.title.replace("\n", " "), "arXiv"
        ),
    }


def fetch_arxiv(seen_titles: set[str]) -> list[dict]:
    # 1. Increase delay to 6.0s (double the 3s requirement to be safe)
    # 2. Use num_retries=5 so the library automatically retries 429s/500s
    client = arxiv.Client(
        page_size=MAX_ARXIV_PER_QUERY, 
        delay_seconds=6.0, 
        num_retries=5
    )
    
    cutoff = datetime.now().astimezone() - timedelta(days=DAYS_LOOKBACK)
    articles: list[dict] = []

    for group_name, terms in ARXIV_QUERY_GROUPS.items():
        query = build_arxiv_query(terms, CATEGORIES)
        for sort_by in ARXIV_SORT_STRATEGIES:
            print(f"  [arxiv/{group_name}] sort={sort_by.value}")
            
            try:
                search = arxiv.Search(
                    query=query,
                    max_results=MAX_ARXIV_PER_QUERY,
                    sort_by=sort_by,
                    sort_order=arxiv.SortOrder.Descending,
                )
                
                # Execute search
                results = client.results(search)
                
                for result in results:
                    # Date check
                    if result.published.astimezone() < cutoff:
                        continue
                    
                    # Dedup check
                    norm_title = _normalize_title(result.title)
                    if norm_title in seen_titles:
                        continue
                    
                    seen_titles.add(norm_title)
                    articles.append(normalize_arxiv(result))
            
            except Exception as e:
                # If a 429 slips through or another error occurs, log it and wait
                print(f"    ⚠ ArXiv Error for '{group_name}': {e}")
                print("    Waiting 20 seconds before continuing...")
                time.sleep(20)

            # Extra sleep between distinct queries to ensure we don't look like a bot swarm
            time.sleep(2)

    return articles

# --- Google Scholar ---

def normalize_scholar(paper) -> dict | None:
    """
    Convert a Semantic Scholar library Paper object to the project format.
    """
    # Access attributes directly (dot notation) instead of dictionary lookup
    title = (paper.title or "").strip()
    if not title:
        return None

    # Handle Authors (list of Author objects)
    raw_authors = paper.authors or []
    authors = [a.name for a in raw_authors if a.name]

    # Handle Dates
    year = paper.year
    pub_date = paper.publicationDate # This is usually a datetime object or None
    
    formatted_date = ""
    if pub_date:
        # Ensure we have a string YYYY-MM-DD
        formatted_date = pub_date.strftime("%Y-%m-%d") if hasattr(pub_date, 'strftime') else str(pub_date)
    elif year:
        formatted_date = f"{year}-01-01"
    
    # Handle Abstract
    abstract = (paper.abstract or "").strip()
    
    # Handle Venue
    venue = paper.venue or "Semantic Scholar"

    # Handle URL
    url = paper.url or ""
    # Fallback to external IDs if main URL is missing
    if not url and paper.externalIds:
        if 'DOI' in paper.externalIds:
            url = f"https://doi.org/{paper.externalIds['DOI']}"
        elif 'ArXiv' in paper.externalIds:
            url = f"https://arxiv.org/abs/{paper.externalIds['ArXiv']}"

    return {
        "title": title,
        "authors": authors,
        "summary": abstract,
        "published_date": formatted_date,
        "url": url,
        "source": "semantic_scholar",
        "citation_text": format_apa_citation(
            authors, year or "n.d.", title, venue
        ),
    }

def fetch_scholar(seen_titles: set[str]) -> list[dict]:
    """
    Fetch papers using the semanticscholar library with forced slicing 
    to prevent infinite pagination loops.
    """
    print(f"\n  [scholar] Queries: {len(SCHOLAR_QUERIES)}")
    articles: list[dict] = []
    
    # Calculate precise date range: "YYYY-MM-DD:YYYY-MM-DD"
    now = datetime.now()
    date_low = (now - timedelta(days=DAYS_LOOKBACK)).strftime("%Y-%m-%d")
    date_high = now.strftime("%Y-%m-%d")
    date_range = f"{date_low}:{date_high}"

    for query_str in SCHOLAR_QUERIES:
        print(f'  [scholar] "{query_str}"')
        try:
            # 1. Search Request
            results = sch.search_paper(
                query=query_str,
                publication_date_or_year=date_range,
                fields_of_study=["Computer Science"],
                limit=MAX_SCHOLAR_PER_QUERY, 
                fields=['title', 'abstract', 'authors', 'year', 'url', 'venue', 'publicationDate', 'externalIds']
            )
            
            # 2. FORCE LIMIT VIA SLICING
            # The 'results' object is a PaginatedResults generator. 
            # Slicing it like a list (results[:N]) forces it to stop 
            # after N items and prevents background fetching of the remaining 1400+.
            safe_subset = results[:MAX_SCHOLAR_PER_QUERY]
            
            added_count = 0
            
            for item in safe_subset:
                # 3. Normalize
                art = normalize_scholar(item)
                if art is None:
                    continue

                # 4. Deduplicate
                norm_title = _normalize_title(art["title"])
                if norm_title in seen_titles:
                    continue
                
                seen_titles.add(norm_title)
                articles.append(art)
                added_count += 1
            
            print(f"    -> {added_count} new articles found (Total matches: {results.total})")

        except Exception as e:
            print(f"    ⚠ Semantic Scholar error for '{query_str}': {e}")
            time.sleep(1) 

    return articles


# --- LinkedIn (Playwright-based scraping) ---

# JS injected into the browser to extract posts from LinkedIn's SDUI DOM
_EXTRACT_POSTS_JS = """() => {
    const results = [];
    const textButtons = document.querySelectorAll('[data-testid="expandable-text-button"]');

    textButtons.forEach((btn) => {
        const pTag = btn.closest('p');
        const text = pTag ? pTag.innerText.trim() : '';
        if (text.length < 20) return;

        let container = pTag;
        let author = '';
        let authorUrl = '';
        let postUrl = '';
        let timeAgo = '';

        for (let level = 0; level < 20; level++) {
            if (!container.parentElement) break;
            container = container.parentElement;

            if (!author) {
                const profileLinks = container.querySelectorAll('a[href*="/in/"], a[href*="/company/"]');
                for (const link of profileLinks) {
                    const name = link.innerText.trim().split('\\n')[0].trim();
                    if (name.length > 1 && name.length < 80) {
                        author = name;
                        authorUrl = link.getAttribute('href');
                        let el = link.closest('span') || link.parentElement;
                        if (el) {
                            let metaLine = el.innerText || el.textContent || '';
                            const timeRe = /\\d+\\s*(h|j|sem|mois|min|d|jour[s]?|semaine[s]?|week[s]?|day[s]?|hour[s]?|month[s]?)\\.?/i;
                            let match = metaLine.match(timeRe);
                            const stripMeta = (t) => t.replace(/\\s*[•·]?\\s*modifié.*$/i, '').trim();
                            if (match) timeAgo = stripMeta(match[0].trim());
                            if (!timeAgo && el.parentElement) {
                                metaLine = el.parentElement.innerText || el.parentElement.textContent || '';
                                match = metaLine.match(timeRe);
                                if (match) timeAgo = stripMeta(match[0].trim());
                            }
                        }
                        break;
                    }
                }
            }
            if (!postUrl) {
                const postLinks = container.querySelectorAll('a[href*="/feed/update/"]');
                if (postLinks.length > 0) postUrl = postLinks[0].getAttribute('href');
            }
            if (author && postUrl) break;
        }

        results.push({ text: text.substring(0, 500), author, authorUrl, postUrl, timeAgo });
    });

    const seen = new Set();
    return results.filter(r => {
        const key = r.text.substring(0, 100);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}"""


# Faceted search: relevance sort + date filter so results span multiple days
LINKEDIN_DATE_POSTED = "past-month"  # or past-week, past-24-hours

def _scrape_linkedin_page(page, keyword: str) -> list[dict]:
    """Navigate to a LinkedIn content search page and extract posts."""
    kw = keyword[0] if isinstance(keyword, list) else keyword
    params = {
        "keywords": str(kw),
        "origin": "FACETED_SEARCH",
        "sortBy": '["relevance"]',
        "datePosted": f'["{LINKEDIN_DATE_POSTED}"]',
    }
    qs = "&".join(f"{k}={quote(str(v), safe='')}" for k, v in params.items())
    url = f"https://www.linkedin.com/search/results/content/?{qs}"
    page.goto(url, wait_until="domcontentloaded")
    try:
        page.wait_for_selector(
            '[data-view-name="feed-see-translation"], [data-testid="expandable-text-button"]',
            timeout=12000,
        )
    except Exception:
        time.sleep(5)

    # Scroll to load more results
    for _ in range(3):
        page.mouse.wheel(0, 2000)
        time.sleep(1.5)

    return page.evaluate(_EXTRACT_POSTS_JS)


def _parse_linkedin_time_ago(time_ago: str) -> str | None:
    """Parse relative time: X {h, j, sem, mois} (+ modifié) -> YYYY-MM-DD."""
    if not time_ago or not time_ago.strip():
        return None
    s = re.sub(r"\s*modifié.*$", "", time_ago.strip(), flags=re.I).strip().lower()
    m = re.match(r"(\d+)\s*([a-z]+)", s)
    if not m:
        return None
    num = int(m.group(1))
    unit = re.sub(r"\.$", "", m.group(2))
    now = datetime.now()
    if unit in ("min", "mins", "minute", "minutes"):
        d = now - timedelta(minutes=num)
    elif unit in ("h", "hour", "hours", "heure", "heures"):
        d = now - timedelta(hours=num)
    elif unit in ("j", "d", "day", "days", "jour", "jours"):
        d = now - timedelta(days=num)
    elif unit in ("sem", "sems", "semaine", "semaines", "week", "weeks"):
        d = now - timedelta(weeks=num)
    elif unit in ("mois", "month", "months"):
        d = now - timedelta(days=num * 30)
    else:
        return None
    return d.strftime("%Y-%m-%d")


def normalize_linkedin(raw: dict) -> dict | None:
    """Convert a Playwright-extracted LinkedIn post to the project format."""
    text = raw.get("text", "").strip()
    if not text:
        return None

    first_line = text.split("\n")[0].strip()
    title = first_line[:200] if len(first_line) > 200 else first_line
    if not title:
        return None

    author = raw.get("author", "").split("\n")[0].strip()
    author = re.sub(r"\s*•.*$", "", author).strip()
    authors = [author] if author else []

    url = raw.get("postUrl") or raw.get("authorUrl") or ""
    if url and not url.startswith("http"):
        url = f"https://www.linkedin.com{url}"

    published_date = _parse_linkedin_time_ago(raw.get("timeAgo", "") or "") or datetime.now().strftime("%Y-%m-%d")

    return {
        "title": title,
        "authors": authors,
        "summary": text[:500],
        "published_date": published_date,
        "url": url,
        "source": "linkedin",
        "citation_text": format_apa_citation(
            authors, published_date[:4], title, "LinkedIn"
        ),
    }


def fetch_linkedin(seen_titles: set[str]) -> list[dict]:
    email = os.environ.get("LINKEDIN_EMAIL", "")
    password = os.environ.get("LINKEDIN_PASSWORD", "")
    if not email or not password:
        print("  ⚠ Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env to enable LinkedIn scraping")
        return []

    articles: list[dict] = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            )
            page = ctx.new_page()

            # Login
            print("  [linkedin] logging in...")
            page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded")
            page.fill("input#username", email)
            page.fill("input#password", password)
            page.click('button[type="submit"]')
            page.wait_for_url("**/feed/**", timeout=15000)
            print("  [linkedin] login OK")

            for query_str in LINKEDIN_QUERIES:
                print(f'  [linkedin] "{query_str}"')
                try:
                    raw_posts = _scrape_linkedin_page(page, query_str)
                    for post in raw_posts[:MAX_LINKEDIN_PER_QUERY]:
                        art = normalize_linkedin(post)
                        if art is None:
                            continue
                        norm_title = _normalize_title(art["title"])
                        if norm_title in seen_titles:
                            continue
                        seen_titles.add(norm_title)
                        articles.append(art)
                    print(f"    -> {len(raw_posts)} posts scraped")
                    time.sleep(2)
                except Exception as e:
                    print(f"    ⚠ error: {e}")
                    time.sleep(3)

            browser.close()

    except Exception as e:
        print(f"  ⚠ LinkedIn scraper failed: {e}")

    return articles


# --- Medium (Playwright-based scraping, no login required) ---

_EXTRACT_MEDIUM_JS = """() => {
    const results = [];
    const seen = new Set();

    const headings = document.querySelectorAll('h2, h3');

    for (const h of headings) {
        const title = h.innerText.trim();
        if (!title || title.length < 10 || seen.has(title)) continue;

        let link = h.closest('a');
        let url = link ? link.href : '';
        if (!url) {
            const parent = h.parentElement;
            if (parent) {
                const nearby = parent.querySelector('a') || parent.closest('a');
                if (nearby) url = nearby.href;
            }
        }
        if (!url || url.includes('/tag/') || url.includes('/search')) continue;

        // Walk up to find a reasonable container
        let container = h;
        for (let i = 0; i < 6; i++) {
            if (container.parentElement) container = container.parentElement;
        }

        // Author
        let author = '';
        const authorEls = container.querySelectorAll('a[href*="/@"]');
        for (const a of authorEls) {
            const name = a.innerText.trim().split('\\n')[0];
            if (name && name.length > 1 && name.length < 80 && name !== title) {
                author = name;
                break;
            }
        }

        // Summary
        let summary = '';
        const pEls = container.querySelectorAll('h3, p');
        for (const p of pEls) {
            const text = p.innerText.trim();
            if (text !== title && text.length > 20) {
                summary = text.substring(0, 500);
                break;
            }
        }

        // Date
        let dateStr = '';
        const text = container.innerText;
        const dm = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2}(?:,?\\s+\\d{4})?/i);
        if (dm) dateStr = dm[0];
        if (!dateStr) {
            const rm = text.match(/(\\d+)\\s+(day|hour|min|week|month)s?\\s+ago/i);
            if (rm) dateStr = rm[0];
        }

        seen.add(title);
        results.push({ title, url, author, summary, dateStr });
    }

    return results;
}"""


def _scrape_medium_page(page, keyword: str) -> list[dict]:
    url = f"https://medium.com/search?q={quote(keyword)}"
    page.goto(url, wait_until="domcontentloaded")
    time.sleep(3)

    # Scroll to load more results
    for _ in range(3):
        page.mouse.wheel(0, 2000)
        time.sleep(1.5)

    return page.evaluate(_EXTRACT_MEDIUM_JS)


def _parse_medium_date(date_str: str) -> str:
    if not date_str:
        return datetime.now().strftime("%Y-%m-%d")

    s = date_str.strip()

    # Relative: "3 days ago"
    m = re.match(r"(\d+)\s+(day|hour|min|week|month)s?\s+ago", s, re.I)
    if m:
        num = int(m.group(1))
        unit = m.group(2).lower()
        now = datetime.now()
        if unit == "min":
            d = now - timedelta(minutes=num)
        elif unit == "hour":
            d = now - timedelta(hours=num)
        elif unit == "day":
            d = now - timedelta(days=num)
        elif unit == "week":
            d = now - timedelta(weeks=num)
        elif unit == "month":
            d = now - timedelta(days=num * 30)
        else:
            return now.strftime("%Y-%m-%d")
        return d.strftime("%Y-%m-%d")

    # Absolute with year: "Dec 12, 2024"
    for fmt in ("%b %d, %Y", "%b %d %Y", "%B %d, %Y", "%B %d %Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Without year: "Jan 5"
    for fmt in ("%b %d", "%B %d"):
        try:
            d = datetime.strptime(s, fmt)
            return d.replace(year=datetime.now().year).strftime("%Y-%m-%d")
        except ValueError:
            continue

    return datetime.now().strftime("%Y-%m-%d")


def normalize_medium(raw: dict) -> dict | None:
    title = raw.get("title", "").strip()
    if not title or len(title) < 10:
        return None

    author = raw.get("author", "").strip()
    author = re.sub(r"\s*·.*$", "", author).strip()
    authors = [author] if author else []

    url = raw.get("url", "")
    summary = raw.get("summary", "").strip()
    published_date = _parse_medium_date(raw.get("dateStr", ""))

    return {
        "title": title,
        "authors": authors,
        "summary": summary,
        "published_date": published_date,
        "url": url,
        "source": "medium",
        "citation_text": format_apa_citation(
            authors, published_date[:4], title, "Medium"
        ),
    }


def fetch_medium(seen_titles: set[str]) -> list[dict]:
    articles: list[dict] = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            )
            page = ctx.new_page()

            for query_str in MEDIUM_QUERIES:
                print(f'  [medium] "{query_str}"')
                try:
                    raw_posts = _scrape_medium_page(page, query_str)
                    for post in raw_posts[:MAX_MEDIUM_PER_QUERY]:
                        art = normalize_medium(post)
                        if art is None:
                            continue
                        norm_title = _normalize_title(art["title"])
                        if norm_title in seen_titles:
                            continue
                        seen_titles.add(norm_title)
                        articles.append(art)
                    print(f"    -> {len(raw_posts)} articles scraped")
                    time.sleep(2)
                except Exception as e:
                    print(f"    ⚠ error: {e}")
                    time.sleep(3)

            browser.close()

    except Exception as e:
        print(f"  ⚠ Medium scraper failed: {e}")

    return articles


# --- Main ---

def save_articles(articles: list[dict], path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)


def _get_raw_timestamp_path() -> str:
    """Path for this run's raw articles file (created on first save)."""
    global _raw_timestamp_path
    if _raw_timestamp_path is None:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        _raw_timestamp_path = os.path.join(DATA_DIR, f"raw_articles_{ts}.json")
    return _raw_timestamp_path


def persist_articles_to_raw(articles: list[dict]) -> None:
    """Append new articles to this run's raw file; skip if already present (by normalized title)."""
    if not articles:
        return
    path = _get_raw_timestamp_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    existing: list[dict] = []
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except (json.JSONDecodeError, OSError):
            existing = []
    seen = {_normalize_title(a["title"]) for a in existing}
    added = 0
    for art in articles:
        nt = _normalize_title(art["title"])
        if nt not in seen:
            seen.add(nt)
            existing.append(art)
            added += 1
    if added:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)
        print(f"    -> {added} new articles appended to {os.path.basename(path)}")


def main():
    seen_titles: set[str] = set()
    

    print(f"\n=== Medium ===")
    print(f"  {len(MEDIUM_QUERIES)} queries, max {MAX_MEDIUM_PER_QUERY} each")
    medium_articles = fetch_medium(seen_titles)
    print(f"  -> {len(medium_articles)} articles from Medium")
    persist_articles_to_raw(medium_articles)

    print(f"=== ArXiv (last {DAYS_LOOKBACK} days) ===")
    print(f"  {len(ARXIV_QUERY_GROUPS)} groups x {len(ARXIV_SORT_STRATEGIES)} sorts")
    arxiv_articles = fetch_arxiv(seen_titles)
    print(f"  -> {len(arxiv_articles)} articles from arXiv")
    persist_articles_to_raw(arxiv_articles)

    print(f"\n=== Semanatic Scholar (last {DAYS_LOOKBACK} days) ===")
    print(f"  {len(SCHOLAR_QUERIES)} queries, max {MAX_SCHOLAR_PER_QUERY} each")
    scholar_articles = fetch_scholar(seen_titles)
    print(f"  -> {len(scholar_articles)} articles from Semantic Scholar")
    persist_articles_to_raw(scholar_articles)

    print(f"\n=== LinkedIn ===")
    print(f"  {len(LINKEDIN_QUERIES)} queries, max {MAX_LINKEDIN_PER_QUERY} each")
    linkedin_articles = fetch_linkedin(seen_titles)
    print(f"  -> {len(linkedin_articles)} posts from LinkedIn")
    persist_articles_to_raw(linkedin_articles)

    

    all_articles = arxiv_articles + scholar_articles + linkedin_articles + medium_articles
    all_articles.sort(key=lambda a: a["published_date"], reverse=True)

    out = os.path.abspath(OUTPUT_PATH)
    save_articles(all_articles, out)
    print(f"\nTotal: {len(all_articles)} unique articles saved to {out}")


if __name__ == "__main__":
    main()
