# PROJET : Outil de Veille Technologique "SLM & Edge AI"

## 1. Contexte et Objectif
Je souhaite développer un outil de veille technologique automatisé focalisé sur les **Small Language Models (SLM)** et le **Edge AI**.
L'objectif est double :
1. Surveiller l'état de l'art (Papers, News).
2. Prouver l'utilité du Edge AI en utilisant un SLM local (via Ollama) pour analyser et classer les données récoltées.

**Architecture Cible :**
* **Backend (Local) :** Python + Ollama (Phi-3/Mistral) pour le traitement.
* **Frontend (Dashboard) :** Streamlit (Python) pour la visualisation interactive (Arbre de décision).
* **Hébergement final :** Google Sites (contenant le dashboard Streamlit en iframe).

---

## 2. Tech Stack & Pré-requis
* **Langage :** Python 3.10+
* **IA Locale :** Ollama (doit être installé sur la machine) avec le modèle `phi3` ou `mistral`.
* **Librairies Clés :**
    * `streamlit` (Dashboard)
    * `streamlit-agraph` ou `graphviz` (Visualisation Arbre)
    * `feedparser` (RSS Scraping)
    * `arxiv` (API Arxiv)
    * `langchain` / `langchain-community` (Orchestration LLM)
    * `chromadb` (Vector Store pour le RAG simple)

---

## 3. Plan de Développement (Step-by-Step)

### ÉTAPE 1 : Configuration de l'environnement
**Instruction pour l'Agent :**
Crée un environnement virtuel et un fichier `requirements.txt` contenant les dépendances nécessaires.
Structure du dossier :

```text
/slm-edge-watch
    /data          (pour stocker les articles.json)
    /src
        scraper.py
        analyzer.py
        app.py
    requirements.txt
    README.md
```

### ÉTAPE 2 : Module de Collecte (Scraping)
**Fichier :** src/scraper.py

**Instruction pour l'Agent :**
Crée un script qui récupère les derniers papiers et articles.

**Sources :** Utilise l'API arxiv (catégories: cs.AI, cs.LG, cs.CL) et feedparser pour des flux RSS tech (ex: Hugging Face papers).

**Filtrage :** Ne garde que les articles contenant les mots-clés : SLM, Small Language Models, Edge AI, Quantization, Pruning, On-device AI, NPU.

**Normalisation :** Chaque entrée doit avoir : title, authors, summary, published_date, url, source.

**Sortie :** Sauvegarde dans data/raw_articles.json.

### ÉTAPE 3 : Module d'Analyse Intelligent (Local SLM)
**Fichier :** src/analyzer.py

**Instruction pour l'Agent :**
C'est le cœur du projet "Edge AI". Ce script doit tourner en local.

Charge data/raw_articles.json.

Connecte-toi à Ollama (modèle phi3).

**Prompt de Classification :** Pour chaque article, demande au modèle de le classer dans une des 3 branches de la taxonomie Zhou et al. :

* Data-level (ex: Dataset pruning, Synthetic data)
* Model-level (ex: Quantization, Architecture, Distillation)
* System-level (ex: Hardware optimization, Inference engine)

**Prompt de Résumé :** Génère un résumé en 1 phrase focalisé sur l'innovation.

**Sortie :** Sauvegarde le résultat enrichi dans data/enriched_articles.json.

### ÉTAPE 4 : Dashboard Interactif (Visualization)
**Fichier :** src/app.py

**Instruction pour l'Agent :**
Crée une application Streamlit.

**Layout :**
* Sidebar : Filtres par date et par catégorie (Data/Model/System).
* Main : Visualisation sous forme d'arbre interactif.

**Composant Arbre :** Utilise streamlit-agraph.
* Nœud central : "SLM & Edge AI".
* Nœuds niveau 1 : Data, Model, System.
* Nœuds niveau 2 (Feuilles) : Les titres des articles cliquables.

**Détails :** Quand on clique sur un nœud (article), afficher le résumé généré par l'IA et le lien source.

**Statistiques :** Affiche un camembert de la répartition des sujets.

### ÉTAPE 5 : RAG & Chat (Bonus)
**Fichier :** src/chat_module.py

**Instruction pour l'Agent :**
Ajoute un onglet "Discuter avec la Veille" dans Streamlit.

Utilise LangChain pour vectoriser les résumés des articles (enriched_articles.json) dans ChromaDB (en mémoire).

Permet à l'utilisateur de poser une question (ex: "Quelles sont les dernières techniques de quantification ?").

Le système récupère les contextes pertinents et utilise Ollama pour répondre.

---

## 4. Instructions de Formatage des Données (Standardisation)
Pour assurer une citation correcte dans le livrable, assure-toi que le JSON final contient un champ pré-formaté citation_text au format APA pour chaque article, généré par le script Python :
Auteur, A. (Année). Titre de l'article. Source.

---

## 5. Commandes de lancement
Pour tester le projet, je dois pouvoir lancer :

* `python src/scraper.py` (Récupère les news)
* `python src/analyzer.py` (Traite avec l'IA locale)
* `streamlit run src/app.py` (Lance le site web)




https://www.linkedin.com/posts/dr-setu-kumar-chaturvedi-9472b992_why-small-language-models-slms-entered-ugcPost-7417837795047768064-OUtU


https://www.linkedin.com/posts/haris-berkovac_the-era-of-monolithic-energy-guzzling-ai-ugcPost-7419025146151206912-sU0X?utm_source=share&utm_medium=member_desktop&rcm=ACoAAGSzpFoB0jSXEZlII7-pqnFPx2INWcNIPCA