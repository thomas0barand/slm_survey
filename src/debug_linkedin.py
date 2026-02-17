"""
Debug: LinkedIn content search - extract posts and find publication date near profile name.
"""

import json
import os
import time
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright
from urllib.parse import quote

load_dotenv()
os.makedirs("data", exist_ok=True)

EMAIL = os.environ.get("LINKEDIN_EMAIL", "")
PASSWORD = os.environ.get("LINKEDIN_PASSWORD", "")
if not EMAIL or not PASSWORD:
    print("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env"); exit(1)

keyword = "Small Language Model"
params = {
    "keywords": keyword,
    "origin": "FACETED_SEARCH",
    "sortBy": '["relevance"]',
    "datePosted": '["past-month"]',
}
qs = "&".join(f"{k}={quote(v, safe='')}" for k, v in params.items())
search_url = f"https://www.linkedin.com/search/results/content/?{qs}"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    )
    page = context.new_page()

    print("=== Login ===")
    page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded")
    page.fill('input#username', EMAIL)
    page.fill('input#password', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_url("**/feed/**", timeout=15000)
    print("  OK")

    print(f"\n=== Search '{keyword}' ===")
    page.goto(search_url, wait_until="domcontentloaded")
    try:
        page.wait_for_selector('[data-view-name="feed-see-translation"], [data-testid="expandable-text-button"]', timeout=15000)
    except Exception:
        time.sleep(8)

    for _ in range(3):
        page.mouse.wheel(0, 2000)
        time.sleep(2)

    # Extract posts + meta line (date is near profile name: e.g. "2 sem •" in FR)
    posts = page.evaluate("""() => {
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
            let metaLine = '';

            for (let level = 0; level < 20; level++) {
                if (!container.parentElement) break;
                container = container.parentElement;

                if (!author) {
                    const profileLinks = container.querySelectorAll('a[href*="/in/"], a[href*="/company/"]');
                    for (const link of profileLinks) {
                        const name = link.innerText.trim().split('\\n')[0].trim();
                        if (name.length > 1 && name.length < 80 && !name.includes('résultat')) {
                            author = name;
                            authorUrl = link.getAttribute('href');
                            // Balises FR: X h, X j, X sem, X mois (+ modifié)
                            let el = link.closest('span') || link.parentElement;
                            if (el) {
                                metaLine = el.innerText || el.textContent || '';
                                const timeRe = /\\d+\\s*(h|j|sem|mois|min|d|jour[s]?|semaine[s]?|week[s]?|day[s]?|hour[s]?|month[s]?)\\.?/i;
                                const stripMeta = (t) => t.replace(/\\s*[•·]?\\s*modifié.*$/i, '').trim();
                                let match = metaLine.match(timeRe);
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

            results.push({ text: text.substring(0, 500), author, authorUrl, postUrl, timeAgo, metaLine });
        });

        const seen = new Set();
        return results.filter(r => {
            const key = r.text.substring(0, 100);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }""")

    print(f"\n=== {len(posts)} unique posts ===\n")
    for i, post in enumerate(posts):
        print(f"[{i}]")
        print(f"  author:  {post['author']}")
        print(f"  timeAgo: {post.get('timeAgo') or '(none)'}")
        print(f"  metaLine: {repr(post.get('metaLine', '')[:120])}")
        print(f"  text:    {post['text'][:120]}...")
        print(f"  url:     {post['postUrl']}")
        print()

    with open("data/debug_linkedin_posts.json", "w") as f:
        json.dump(posts, f, indent=2, ensure_ascii=False)
    print(f"Saved to data/debug_linkedin_posts.json")

    browser.close()
