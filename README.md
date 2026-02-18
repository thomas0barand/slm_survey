# SLM & Edge AI — Outil de Veille Technologique

Automated tech watch on **Small Language Models (SLM)** and **Edge AI**: scrape papers & news, classify with a local SLM (Ollama), and explore via an interactive Streamlit dashboard.

---

## Final objective

1. **Monitor the state of the art** — Papers and news from arXiv, RSS, and other sources.
2. **Demonstrate Edge AI** — Use a local SLM (Ollama: Phi-3/Mistral) to analyze and classify collected items.

**Target architecture**

- **Backend (local):** Python + Ollama for processing.
- **Frontend:** Streamlit dashboard (taxonomy tree, filters, stats).
- **Deployment:** Google Sites with the Streamlit app in an iframe.

---

## Repo structure

```
slm_survey/
├── data/                 # raw_articles.json, enriched_articles.json (gitignored)
├── docs/
│   ├── project_overview.md
│   └── subject_presentation.txt
├── src/
│   ├── scraper.py        # Collect papers & articles
│   ├── analyzer.py       # (TODO) Local SLM classification & summarization
│   ├── app.py            # (TODO) Streamlit dashboard
│   ├── chat_module.py    # (TODO) RAG chat over the corpus
│   └── debug_linkedin.py # Dev helper
├── requirements.txt
├── explore.ipynb
└── README.md
```

---

## Project structure (global)

| Step | Module        | Role |
|------|---------------|------|
| 1    | **Scraper**   | Fetch from arXiv, Scholar, RSS, etc. → filter by SLM/Edge AI keywords → save `data/raw_articles.json` (title, authors, summary, published_date, url, source, citation_text APA). |
| 2    | **Analyzer**  | Load raw articles → Ollama (phi3) → classify into Data/Model/System (Zhou et al.) + one-sentence summary → save `data/enriched_articles.json`. |
| 3    | **Dashboard** | Streamlit: sidebar filters (date, category), interactive tree (SLM & Edge AI → Data/Model/System → articles), pie chart, article detail (summary + link). |
| 4    | **RAG Chat**  | LangChain + ChromaDB over enriched summaries → user questions answered by Ollama with retrieved context. |

---

## What has been done

- **Environment:** `requirements.txt`, `.gitignore` (`.venv/`, `data/`, `.env`).
- **Scraper (`src/scraper.py`):**
  - **Sources:** ArXiv (cs.AI, cs.LG, cs.CL), Google Scholar, LinkedIn (Playwright), Medium.
  - **Queries:** SLM, Edge AI, quantization, pruning, on-device AI, NPU, etc.
  - **Output:** Normalized entries with `title`, `authors`, `summary`, `published_date`, `url`, `source`, and APA `citation_text` → `data/raw_articles.json`.
- **Docs:** `docs/project_overview.md` (full spec), `docs/subject_presentation.txt`.

---

## What remains to be done

| Step | Task | File(s) |
|------|------|--------|
| 1 | Add deps: `streamlit`, `streamlit-agraph` or `graphviz`, `feedparser`, `langchain`, `langchain-community`, `chromadb`. | `requirements.txt` |
| 2 | **Analyzer:** Load `raw_articles.json`, call Ollama (phi3) for taxonomy class (Data/Model/System) + one-sentence summary, write `enriched_articles.json`. | `src/analyzer.py` |
| 3 | **Dashboard:** Streamlit app with filters, tree (e.g. streamlit-agraph), pie chart, article detail panel. | `src/app.py` |
| 4 | **RAG Chat:** LangChain + ChromaDB over enriched articles, Ollama for answers; “Discuter avec la Veille” tab in Streamlit. | `src/chat_module.py` |
| 5 | Optional: RSS via feedparser (e.g. Hugging Face papers) in scraper. | `src/scraper.py` |

---

## How to run

**Prerequisites:** Python 3.10+, Ollama with `phi3` or `mistral`. For scraper: `.env` if needed (e.g. credentials for LinkedIn/Medium).

```bash
# Collect articles
python src/scraper.py

# Classify & summarize with local SLM (when implemented)
python src/analyzer.py

# Launch dashboard (when implemented)
streamlit run src/app.py
```

---

## Tech stack (from project overview)

- **Language:** Python 3.10+
- **Local LLM:** Ollama (phi3 / mistral)
- **Key libs:** streamlit, streamlit-agraph or graphviz, feedparser, arxiv, langchain, langchain-community, chromadb, scholarly, playwright, python-dotenv

---

*Spec details: `docs/project_overview.md`*
