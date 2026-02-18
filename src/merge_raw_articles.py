import json
import os
import re

# --- Configuration ---
DATA_DIR = "data"
OUTPUT_FILE = os.path.join(DATA_DIR, "raw_articles.json")

def _normalize_title(title: str) -> str:
    """Lowercase, strip whitespace/punctuation for dedup comparison."""
    if not title:
        return ""
    t = title.lower().strip()
    # Remove all non-alphanumeric characters
    t = re.sub(r"[^a-z0-9 ]", "", t)
    # Collapse multiple spaces
    t = re.sub(r"\s+", " ", t)
    return t

def merge_json_files():
    # Ensure data directory exists
    if not os.path.exists(DATA_DIR):
        print(f"Error: Directory '{DATA_DIR}' not found.")
        return

    # Find all files starting with 'raw_articles_' in the data folder
    # We exclude the output file itself to prevent reading it as input
    files = [
        f for f in os.listdir(DATA_DIR) 
        if f.startswith("raw_articles") 
        and f.endswith(".json") 
        and os.path.join(DATA_DIR, f) != OUTPUT_FILE
    ]
    
    print(f"Found {len(files)} files to merge in '{DATA_DIR}':")
    for f in files:
        print(f" - {f}")

    merged_articles = []
    seen_titles = set()

    # Process each file
    for filename in files:
        filepath = os.path.join(DATA_DIR, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                if not isinstance(data, list):
                    print(f"  ⚠ Skipping {filename}: Root element is not a list")
                    continue
                
                added_count = 0
                for article in data:
                    if article.get('source') == 'google_scholar':
                        continue
                    title = article.get('title', '')
                    norm_title = _normalize_title(title)
                    if norm_title and norm_title not in seen_titles:
                        seen_titles.add(norm_title)
                        merged_articles.append(article)
                        added_count += 1
                
                print(f"  -> Added {added_count} unique articles from {filename}")
                
        except json.JSONDecodeError:
            print(f"  ⚠ Skipping {filename}: Invalid JSON")
        except Exception as e:
            print(f"  ⚠ Error reading {filename}: {e}")

    # Sort by date (Newest first). Handles missing dates safely.
    merged_articles.sort(
        key=lambda x: x.get('published_date', '0000-00-00') or '0000-00-00', 
        reverse=True
    )

    # Save the combined file
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(merged_articles, f, ensure_ascii=False, indent=2)
        print(f"\n✅ Successfully saved {len(merged_articles)} articles to: {OUTPUT_FILE}")
    except Exception as e:
        print(f"\n❌ Failed to save output file: {e}")

if __name__ == "__main__":
    merge_json_files()