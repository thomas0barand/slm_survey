/* ─────────────────────────────────────────────────────────
   SLM & Edge AI Watch — app.js
   Data is embedded in data.js — no fetch(), works everywhere.
   To update: run src/export.py → regenerates data.js
───────────────────────────────────────────────────────── */

function catStyle(name) {
  const n = name.toLowerCase();
  if (n.includes('model') || n.includes('intelligence'))
    return { cls: 'cat-model', color: 'var(--c-model)' };
  if (n.includes('edge') || n.includes('system') || n.includes('deploy'))
    return { cls: 'cat-edge', color: 'var(--c-edge)' };
  return { cls: 'cat-data', color: 'var(--c-data)' };
}

// Data comes from data.js (ARTICLES_DATA + TAXONOMY_DATA globals)
let ARTICLES = [];
let TAXONOMY = {};

const state = {
  view: 'overview',
  cat: null,
  subcat: null,
  openCats: new Set(),
  openArticle: null,
  sort: 'relevance',
};

/* ── Boot ─────────────────────────────────────────────── */
function boot() {
  try {
    // ARTICLES_DATA and TAXONOMY_DATA are defined in data.js
    if (typeof ARTICLES_DATA === 'undefined' || typeof TAXONOMY_DATA === 'undefined') {
      throw new Error('data.js not loaded');
    }
    ARTICLES = ARTICLES_DATA;
    TAXONOMY = TAXONOMY_DATA;
    buildHeader();
    buildTree();
    renderOverview();
    attachListeners();
  } catch (e) {
    document.getElementById('content-area').innerHTML = `
      <div class="loading" style="color:var(--c-data)">
        ⚠ data.js introuvable.<br><br>
        <span style="font-size:.75rem;opacity:.6">
          Vérifiez que data.js est dans le même dossier que index.html.<br>
          Relancez <code>src/export.py</code> pour le régénérer.
        </span>
      </div>`;
  }
}

/* ── Event delegation ─────────────────────────────────── */
function attachListeners() {
  document.getElementById('tree-root').addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (el) handleAction(el);
  });
  document.getElementById('main-panel').addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (el) handleAction(el);
  });
  document.getElementById('main-panel').addEventListener('change', e => {
    if (e.target.dataset.action === 'sort') {
      state.sort = e.target.value;
      rerender();
    }
  });
}

function handleAction(el) {
  const a = el.dataset.action;
  if (a === 'overview')   navOverview();
  if (a === 'cat')        onCatClick(el.dataset.cat);
  if (a === 'subcat')    navSubcat(el.dataset.cat, el.dataset.sub);
  if (a === 'article')   toggleArt(el.dataset.id);
  if (a === 'about-slm') navAboutSlm();
  if (a === 'about-work') navAboutWork();
}

/* ── Header ───────────────────────────────────────────── */
function buildHeader() {
  const cats    = Object.keys(TAXONOMY).length;
  const subcats = Object.values(TAXONOMY).reduce((a, s) => a + Object.keys(s).length, 0);
  document.getElementById('header-stats').innerHTML = `
    <div class="hstat">
      <div class="hstat-val" style="color:var(--c-edge)">${ARTICLES.length}</div>
      <div class="hstat-lbl">Articles</div>
    </div>
    <div class="hstat-sep"></div>
    <div class="hstat">
      <div class="hstat-val" style="color:var(--c-model)">${cats}</div>
      <div class="hstat-lbl">Catégories</div>
    </div>
    <div class="hstat-sep"></div>
    <div class="hstat">
      <div class="hstat-val" style="color:var(--c-data)">${subcats}</div>
      <div class="hstat-lbl">Sous-catégories</div>
    </div>
  `;
}

/* ── Tree nav ─────────────────────────────────────────── */
function buildTree() {
  let html = `
    <div class="tree-root-node ${state.view === 'overview' ? 'active' : ''}" data-action="overview">
      <div class="tree-root-icon">◈</div>
      <span>Vue d'ensemble</span>
    </div>
  `;
  for (const [cat, subs] of Object.entries(TAXONOMY)) {
    const m      = catStyle(cat);
    const total  = Object.values(subs).reduce((a, b) => a + b, 0);
    const isOpen = state.openCats.has(cat);
    const isActive = state.cat === cat;
    html += `
      <div class="tree-cat">
        <div class="tree-cat-row ${m.cls} ${isActive ? 'active' : ''} ${isOpen ? 'open' : ''}"
             data-action="cat" data-cat="${h(cat)}">
          <div class="cat-pip" style="background:${m.color}"></div>
          <span class="cat-label">${h(cat)}</span>
          <span class="cat-total">${total}</span>
          <span class="tree-chevron">▶</span>
        </div>
        <div class="tree-subcats ${isOpen ? 'open' : ''}">
    `;
    for (const [sub, cnt] of Object.entries(subs)) {
      const isSubActive = state.cat === cat && state.subcat === sub;
      html += `
        <div class="tree-sub-row ${isSubActive ? 'active' : ''}"
             data-action="subcat" data-cat="${h(cat)}" data-sub="${h(sub)}">
          <span>${h(sub)}</span>
          <span class="sub-cnt">${cnt}</span>
        </div>
      `;
    }
    html += `</div></div>`;
  }
  html += `
    <div class="tree-about-sep"></div>
    <div class="tree-about-row cat-about1 ${state.view === 'about-slm' ? 'active' : ''}" data-action="about-slm">
      <div class="cat-pip" style="background:var(--c-about1)"></div>
      <span>A propos des SLMs et du Edge AI</span>
    </div>
    <div class="tree-about-row cat-about2 ${state.view === 'about-work' ? 'active' : ''}" data-action="about-work">
      <div class="cat-pip" style="background:var(--c-about2)"></div>
      <span>A propos de ce travail</span>
    </div>`;
  document.getElementById('tree-root').innerHTML = html;
}

/* ── Navigation ───────────────────────────────────────── */
function navOverview() {
  state.view = 'overview'; state.cat = null; state.subcat = null; state.openArticle = null;
  buildTree(); renderOverview(); scrollTop();
}
function onCatClick(cat) {
  state.openCats.has(cat) ? state.openCats.delete(cat) : state.openCats.add(cat);
  state.view = 'category'; state.cat = cat; state.subcat = null; state.openArticle = null;
  buildTree(); renderCategory(cat); scrollTop();
}
function navSubcat(cat, sub) {
  state.openCats.add(cat);
  state.view = 'subcategory'; state.cat = cat; state.subcat = sub; state.openArticle = null;
  buildTree(); renderSubcat(cat, sub); scrollTop();
}
function navAboutSlm() {
  state.view = 'about-slm'; state.cat = null; state.subcat = null; state.openArticle = null;
  buildTree(); renderAboutSlm(); scrollTop();
}
function navAboutWork() {
  state.view = 'about-work'; state.cat = null; state.subcat = null; state.openArticle = null;
  buildTree(); renderAboutWork(); scrollTop();
}
function rerender() {
  if (state.view === 'overview')         renderOverview();
  else if (state.view === 'category')    renderCategory(state.cat);
  else if (state.view === 'subcategory') renderSubcat(state.cat, state.subcat);
  else if (state.view === 'about-slm')   renderAboutSlm();
  else if (state.view === 'about-work')  renderAboutWork();
}
function scrollTop() { document.getElementById('main-panel').scrollTop = 0; }

/* ── Overview ─────────────────────────────────────────── */
const CONTENT_CARDS = [
  { title: "Lois de puissance et scaling des LLM vers les SLM", text:'Les performances des modèles de langage suivent des lois de puissance : la loss diminue de manière prévisible quand on augmente les paramètres, les données et le compute (Kaplan et al., 2020). Chinchilla (Hoffmann et al., 2022) montre qu’à compute constant, il est optimal d’entraîner des modèles plus petits sur davantage de données (≈20 tokens par paramètre). Ainsi, un scaling bien équilibré paramètres/données permet à des SLM bien entraînés d’atteindre des performances proches des grands modèles sur des tâches ciblées.', imgCaption: 'Scaling laws : paramètres, données et compute', images: [
    { src: 'images/loidepuissance.png', caption: 'Test loss vs Compute, Dataset, Parameters (Kaplan et al., 2020)' },
    { src: 'images/loidepuissnacechichilla.png', caption: 'Paramètres vs FLOPS — Chinchilla, Gopher, GPT-3 (Hoffmann et al.)' },
  ], sources: [
    { label: 'Chinchilla (Hoffmann et al., 2022)', url: 'https://arxiv.org/abs/2203.15556' },
    { label: 'Kaplan et al., 2020', url: 'https://arxiv.org/pdf/2001.08361' },
  ]},
  {
    title: 'Architecture',
    text: "L'architecture des SLMs ets basée sur les Transformers decoder-only optimisés autour de trois composants clés :<br>(1) Attention avec MQA ou GQA pour réduire le coût mémoire et accélérer l’inférence ;<br>(2) Tokenization via des vocabulaires denses (ex. Tiktoken) afin de raccourcir les séquences ;<br>(3) KV Cache pour stocker les clés/valeurs passées et accélérer l’auto-régression.",
    imgCaption: 'Transformer decoder-only',
    images: [
      {
        src: "images/transformer1.png",
        caption: "Decoder-only Transformer et KV Cache (Li et al., 2024)"
      }
    ],
    sources: [
      { label: 'A Survey on Efficient Inference for Large Language Models (2024)', url: 'https://arxiv.org/abs/2404.14294' },
    ]
  },
  {
    title: 'Hardware',
    text: "CPU : contrôle général et logique séquentielle, faible parallélisme mais faible latence et grande polyvalence ;<br>GPU : calcul massivement parallèle optimisé pour matrices et tenseurs, haut throughput et large bande passante mémoire pour l’entraînement et l’inférence IA ;<br>NPU : accélérateur IA dédié aux opérations tensorielle, faible consommation énergétique, latence optimisée pour l’Edge AI.",
    imgCaption: 'CPU vs GPU vs NPU',
    images: [
      {
        src: "images/hardware.jpeg",
        caption: "Architecture comparative CPU, GPU et NPU"
      }
    ]
  },
  {
    title: 'Le Memory Wall et Puissance de calcul',
    text: "La puissance de calcul a historiquement doublé environ tous les deux ans (loi de Moore), mais ce rythme ralentit. Les puces mobiles atteignent désormais des dizaines de TOPS (Apple A19 Pro ~35 TOPS, Snapdragon 8 Elite ~60 TOPS, Dimensity 9400+ ~50 TOPS), tandis qu’un GPU V100 (2017) atteignait ~125 TOPS. Cependant, en inférence LLM, la performance est souvent limitée par la bande passante mémoire (DRAM) plutôt que par le compute brut : la latence ≈ taille du modèle / bande passante mémoire. Un modèle 7B en FP16 nécessite ~14 Go de VRAM, au-delà de la capacité de la plupart des smartphones. Enfin, les contraintes thermiques et énergétiques limitent l’usage intensif prolongé, surtout en on-device.",
    imgCaption: 'Compute vs mémoire',
    images: [
      {
        src: "images/moorelaw.png",
        caption: "Nombre de transistor pour les microprocesseurs par rapport au temps en échelle semi-log, doublant presque chaque année (Wikipedia - Moore’s Law)"
      },
      {
        src: "images/memorywall.png",
        caption: "Memory Wall : la bande passante mémoire devient le facteur limitant (AI and Memory Wall - Amir Gholami and al. - 2024)"
      }
    ],
    sources: [
      { label: "AI and Memory Wall (Gholami et al., 2024)", url: 'https://arxiv.org/abs/2403.14123' },
      { label: "Moore's Law (Wikipedia)", url: 'https://en.wikipedia.org/wiki/Moore%27s_law' },
    ]
  },
  {
    title: "Jusqu'où peut-on aller ?",
    text: "Les SLM couvrent désormais une large gamme de tailles, du milliard de paramètres à moins d’un milliard (<1B). L’architecture privilégie souvent un design **deep & thin** : plus de couches mais des dimensions cachées réduites pour maximiser l’efficacité. Ces modèles sont performants pour des usages ciblés : résumé de texte, Q&A, génération de texte et code simple, tout en restant légers et rapides à déployer.",
    images: [
      {
        src: "images/evolutionslm.png",
        caption: "Évolution des principaux SLM et de leur taille dans le temps (Source : Pieces for Developer - “Why companies are turning to small language models? (SLMs)”)"
      }
    ],
    sources: [
      { label: "Why companies are turning to small language models (Pieces)", url: 'https://pieces.app/blog/why-companies-are-turning-to-small-language-models' },
    ]
  },
  {
    title: "Optimisation MODEL-level : Pruning",
    text: "Le <b>pruning</b> permet de réduire la taille et d'accélérer les modèles tout en conservant la précision :<br><br>• <b>Structured Pruning</b> : suppression de groupes entiers de paramètres (canaux, têtes d'attention) pour améliorer le calcul matériel.<br>• <b>Unstructured Pruning</b> : mise à zéro de poids individuels, nécessitant des kernels spécifiques pour exploiter la sparsity.<br>• <b>Co-design</b> : équilibre entre latence et précision pour déterminer les hyperparamètres optimaux.",
    imgCaption: "Techniques de pruning pour LLM et SLM",
    images: [
      {
        src: "images/pruning.png",
        caption: "Empowering Edge Intelligence: A Comprehensive Survey on On-Device AI Models - Wang and al. (2025)"
      }
    ],
    sources: [
      { label: 'Empowering Edge Intelligence (Wang et al., 2025)', url: 'https://arxiv.org/abs/2503.06027' },
    ]
  },
  {
    title: "Optimisation MODEL-level : Quantisation",
    text: "La <b>quantisation</b> réduit la taille des modèles et accélère l’inférence en convertissant les poids FP32/FP16 vers INT8, INT4 ou NF4.<br>Une visualisation typique montre le passage de FP32 à INT4 pour les réseaux neuronaux.",
    imgCaption: "Visualisation de la quantisation FP32 → INT4",
    images: [
      {
        src: "images/quantization.png",
        caption: "UN GUIDE VISUEL SUR LA QUANTIFICATION - Loïck BOURDOIS"
      }
    ],
    sources: [
      { label: 'Un guide visuel sur la quantification (Loïck Bourdois)', url: 'https://blog.loickbourdois.fr/quantification/' },
    ]
  },
  {
    title: "Optimisation MODEL-level : Knowledge Distillation",
    text: "La <b>distillation de connaissances</b> permet à un modèle professeur de transférer son savoir à un modèle étudiant plus compact via ses probabilités de sortie (soft targets). Récemment remise en lumière par les succès de <b>DeepSeek-R1</b>, cette technique offre de meilleures performances qu'un entraînement de zéro. Son efficacité dépend fortement de la taille relative des modèles (cf. <i>Distillation Scaling Laws</i>) et s'avère indispensable pour le déploiement sur appareils mobiles (cf. <i>Empowering Edge Intelligence: A Comprehensive Survey on On-Device AI Models - Wang et al.</i>).",
    imgCaption: "Mécanisme de Knowledge Distillation et d'optimisation",
    images: [
      {
        "src": "images/distillation1.png",
        "caption": "Exemple de transfert via les soft targets (Wang et al. 2025)"
      },
      {
        "src": "images/distillation2.png",
        "caption": "Impact des tailles de modèles selon Distillation Scaling Laws (Busbridge and al . 2025)"
      }
    ],
    sources: [
      { label: 'Distillation Scaling Laws (Busbridge et al., 2025)', url: 'https://arxiv.org/abs/2502.08606' },
      { label: 'Empowering Edge Intelligence (Wang et al., 2025)', url: 'https://arxiv.org/abs/2503.06027' },
    ]
  },
  {
    title: "Optimisation MODEL-level : QKV Techniques",
    text: "Les techniques QKV optimisent l’attention multi-têtes pour équilibrer vitesse et qualité :<br>• MHA : baseline, inférence lente, KV Cache lourd<br>• GQA : groupes de têtes, compromis performance/vitesse<br>• MQA : KV unique, vitesse maximale mais dégradations possibles",
    imgCaption: "QKV Techniques et KV Cache optimizations",
    images: [
      {
        src: "images/qkv.png",
        caption: "A simplified illustration of different QKV grouping techniques (Zara Zan, 2024)"
      }
    ],
    sources: [
      { label: 'GQKVA: Grouping Queries, Keys, and Values (2023)', url: 'https://arxiv.org/abs/2311.03426' },
      { label: 'AsymGQA / Grouped-query attention (2024)', url: 'https://arxiv.org/abs/2406.14963' },
    ]
  },
  {
    title: "Optimisation SYSTEM-level",
    text: "L'optimisation au niveau système se divise en deux grands piliers : le <b>moteur d'inférence</b> (Inference Engine) qui accélère la génération via l'optimisation des graphes/opérateurs, l'offloading et le décodage spéculatif ; et le <b>système de service</b> (Serving System) qui gère l'infrastructure et le flux de requêtes via la gestion de la mémoire, le batching, l'ordonnancement (Scheduling) et l'utilisation de systèmes distribués.",
    imgCaption: "",
    images: [
      {
        "src": "images/system.png",
        "caption": "Vue globale des stratégies d'optimisation au niveau système (Wang and al. 2025)"
      }
    ],
    sources: [
      { label: 'Empowering Edge Intelligence (Wang et al., 2025)', url: 'https://arxiv.org/abs/2503.06027' },
    ]
  },
  {
    title: "Les SLMs de référence en 2026",
    text: "Les Small Language Models (SLM) allient efficacité et spécialisation selon <i>Datacamp</i> et <i>Sunil Rao</i> :<br><br>• Llama 4 Scout (Meta, 8B) : Architecture MoE et multimodalité native.<br>• Gemma 3 (Google, 1B-12B) : Performant en multimodalité (audio, vidéo).<br>• Qwen3 (Alibaba, 0.5B-7B) : Chaîne de pensée (Reasoning) pour les maths et le code.<br>• Phi-4-mini (Microsoft, 3.8B) : Raisonnement logique supérieur, optimisé Windows.<br>• Nemo & Ministral (Mistral, 7B-12B) : Modèles performants, alliant efficacité et scalabilité.",
    imgCaption: "Évolution et spécialisation des SLM en 2026",
    images: [
      {
        "src": "images/slmmodels.png",
        "caption": "Les modèles de références selon Datacamp & Sunil Rao (2026)"
      }
    ],
    sources: [
      { label: 'Small Language Models (Datacamp)', url: 'https://www.datacamp.com/blog/small-language-models' },
    ]
  },
  {
    title: "Perspectives : L'ère des NPUs",
    text: "L'évolution du matériel permet d'exécuter des modèles avancés directement sur les appareils :<br><br>• Accélération NPU : Intégration native (Snapdragon 8 Gen 3, Apple M4) pour une inférence 4-bit matérielle.<br>• Multi-Modalité Edge : Modèles Vision-Langage (VLM) compacts pour l'analyse d'image en temps réel sans cloud.<br>• On-device LoRA : Fine-tuning local pour personnaliser le modèle à l'utilisateur sans fuite de données.",
    sources: [
      { label: 'Empowering Edge Intelligence (Wang et al., 2025)', url: 'https://arxiv.org/abs/2503.06027' },
    ]
  },
];

function renderOverview() {
  let html = `
    <div class="overview-eyebrow">MOS 4.4 — Veille Technologique</div>
    <div class="overview-title"><em>Small Language Models</em><br>&amp; Edge AI</div>
    <div class="overview-lead">
      Avancées algorithmiques dans les modèles de langage compacts et leur déploiement sur dispositifs locaux — de la quantisation aux architectures NPU-native.
    </div>

    <div class="section-label">Explorer les dernières nouvelles :</div>
    <div class="cat-cards">
  `;
  for (const [cat, subs] of Object.entries(TAXONOMY)) {
    const m     = catStyle(cat);
    const total = Object.values(subs).reduce((a, b) => a + b, 0);
    html += `
      <div class="cat-card ${m.cls}" data-action="cat" data-cat="${h(cat)}">
        <div class="card-number">${total}</div>
        <div class="card-title">${h(cat)}</div>
        <div class="card-subs">
    `;
    for (const [sub, cnt] of Object.entries(subs)) {
      html += `<div class="card-sub-row"><span>${h(sub)}</span><span>${cnt}</span></div>`;
    }
    html += `</div><div class="card-cta">→ Explorer</div></div>`;
  }
  html += `</div>

    <div class="section-label section-label--spaced">À Propos</div>
    <div class="cat-cards cat-cards--about">
      <div class="cat-card cat-about1" data-action="about-slm">
        <div class="card-title">A propos des SLMs et du Edge AI</div>
        <p class="card-desc">Définitions (SLM, Edge AI, enjeux),lois de scaling, architecture, hardware, stratégies d'optimisations (pruning, quantisation, distillation, QKV).</p>
        <div class="card-cta">→ Voir les définitions, le contenu & les stratégies</div>
      </div>
      <div class="cat-card cat-about2" data-action="about-work">
        <div class="card-title">A propos de ce travail</div>
        <p class="card-desc">Présentation du projet de veille (MOS 4.4), organigramme de la démarche, méthodologie de collecte et d’analyse des articles, ainsi que les coordonnées et le dépôt du projet.</p>
        <div class="card-cta">→ Voir le projet, l’organigramme & les contacts</div>
      </div>
    </div>

    <div class="section-label section-label--spaced">Organigramme du projet</div>
    <div class="about-organigram-wrap">
      <img src="images/organigramme.png" alt="Organigramme du travail" class="about-organigram-img" loading="lazy">
    </div>
  `;
  document.getElementById('content-area').innerHTML = html;
}

/* ── About SLM page: definitions + content cards + strategies ── */
function buildAboutSlmContent() {
  let html = `
    <div class="subsection-label">Définitions</div>
    <div class="def-row">
      <div class="def-card">
        <div class="def-card-label">
          <div class="def-pip" style="background:var(--c-model)"></div>
          <span style="color:var(--c-model)">SLM</span>
        </div>
        <div class="def-card-term">Small Language Models</div>
        <div class="def-card-text">Modèles optimisés de 0,5 B à 7 B paramètres, conservant des capacités de raisonnement avancées grâce à la distillation et la compression.</div>
      </div>
      <div class="def-card">
        <div class="def-card-label">
          <div class="def-pip" style="background:var(--c-edge)"></div>
          <span style="color:var(--c-edge)">Edge AI</span>
        </div>
        <div class="def-card-term">Inférence locale</div>
        <div class="def-card-text">Déploiement d'algorithmes de Deep Learning directement sur des dispositifs locaux (NPU, GPU mobile, DSP) sans dépendance aux API cloud.</div>
      </div>
      <div class="def-card">
        <div class="def-card-label">
          <div class="def-pip" style="background:var(--c-data)"></div>
          <span style="color:var(--c-data)">Pourquoi ?</span>
        </div>
        <div class="def-card-term">Enjeux clés</div>
        <div class="def-card-text">Protection des données, latence ultra-faible, réduction des coûts cloud et disponibilité immédiate sans connectivité.</div>
      </div>
    </div>
<div class="subsection-label">Comprendre les SLM et le Edge AI</div>
    <div class="content-cards">
  `;
  const STRATEGIES_BLOCK = `
  <div class="strategies-block">
    <div class="subsection-label">Stratégies d'optimisation</div>
    <ul class="overview-bullets" style="margin-bottom:0.8em">
      <li>
        <b>Data-level</b> : filtrer et agréger les données, quantiser et utiliser des frameworks adaptés.
      </li>
      <li>
        <b>Model-level</b> : pruning, quantisation et distillation pour réduire la taille et accélérer l’inférence.
      </li>
      <li>
        <b>System-level</b> : optimiser runtime, parallélisation et déploiement pour exploiter le hardware.
      </li>
    </ul>
  </div>
  `;
  CONTENT_CARDS.forEach(card => {
    let imgBlock = '';
    if (card.images && card.images.length) {
      imgBlock = card.images.map(img => `
        <div class="content-card-img-slot">
          <div class="content-card-img-inner">
            <img src="${h(img.src)}" alt="${h(img.caption)}" loading="lazy"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="img-placeholder" style="display:none">
              <div class="ph-icon">🖼</div>
              <div class="ph-caption">${h(img.caption)}</div>
            </div>
          </div>
          <div class="content-card-img-caption">${h(img.caption)}</div>
        </div>
      `).join('');
      imgBlock = `<div class="content-card-imgs content-card-imgs--multi">${imgBlock}</div>`;
    }
    let cardClass = '';
    if (card.images && card.images.length > 1) cardClass = ' content-card--multi-img';
    else if (!card.images || !card.images.length) cardClass = ' content-card--no-img';
    const sourcesBlock = (card.sources && card.sources.length)
      ? `<div class="content-card-sources"><span class="content-card-sources-label">Sources :</span> ${card.sources.map(s => `<a href="${h(s.url)}" target="_blank" rel="noopener" class="content-card-source-link">${h(s.label)}</a>`).join(' · ')}</div>`
      : '';
    html += `
      <div class="content-card${cardClass}">
        <div class="content-card-text">
          <h3 class="content-card-title">${h(card.title)}</h3>
          <p>${card.text}</p>
          ${sourcesBlock}
        </div>
        ${imgBlock}
      </div>`;
    if (card.title === "Le Memory Wall et Puissance de calcul") {
      html += STRATEGIES_BLOCK;
    }
  });
  html += `</div>`;
  return html;
}

function renderAboutSlm() {
  const content = buildAboutSlmContent();
  const html = `
    <div class="view-header">
      <div class="view-breadcrumb">
        <span class="bc-link" data-action="overview">Vue d'ensemble</span>
        <span class="bc-sep">/</span>
        <span>A propos des SLMs et du Edge AI</span>
      </div>
      <div class="view-title" style="color:var(--c-about1)">A propos des SLMs et du Edge AI</div>
      <div class="view-meta">Définitions, contenu pédagogique et stratégies d'optimisation</div>
    </div>
    ${content}
  `;
  document.getElementById('content-area').innerHTML = html;
}

/* ── About Work page ── */
const ABOUT_WORK = {
  repoUrl: 'https://github.com/thomas0barand/slm_survey',
  email: 'th.barand@gmail.com',
  author: 'Thomas Barand',
  workTime: '~20 h',
};

function renderAboutWork() {
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const html = `
    <div class="view-header">
      <div class="view-breadcrumb">
        <span class="bc-link" data-action="overview">Vue d'ensemble</span>
        <span class="bc-sep">/</span>
        <span>A propos de ce travail</span>
      </div>
      <div class="view-title" style="color:var(--c-about2)">A propos de ce travail</div>
      <div class="view-meta">Présentation du projet et méthodologie</div>
    </div>
    <div class="about-work-page">
      <p class="about-work-lead">
        Ce projet de veille technologique (MOS 4.4) vise à suivre les avancées sur les <b>Small Language Models (SLM)</b> et le <b>Edge AI</b> :
        articles et publications sont collectés depuis plusieurs sources, enrichis par une classification automatique selon une taxonomie (sujets et sous-sujets) et par la génération de résumés,
        puis explorables via ce site. Les détails techniques (scripts, commandes, structure du dépôt) sont dans le README du projet.
      </p>

      <div class="subsection-label">Objectifs</div>
      <p class="about-work-p">
        Monitorer l’état de l’art (papers et signaux variés), structurer l’information selon une taxonomie précise (Topic / Subtopic),
        et fournir une interface de consultation : ce site charge des données pré-calculées et permet de naviguer par thème sans backend.
      </p>

      <div class="subsection-label">Principe de fonctionnement</div>
      <p class="about-work-p">
        Le flux de traitement (illustré par l'organigramme ci-dessous) commence par la <b>collecte</b> : un module <b>Scraper</b> extrait les informations depuis différentes sources (<b>arXiv, Google Scholar, Medium et LinkedIn</b>) pour constituer une base de données d'articles bruts (<i>Raw articles</i>). Ces articles subissent ensuite un double processus d'enrichissement pour aboutir aux articles finaux (<i>Enriched articles</i>).
      </p>

      <p class="about-work-p">
        <b>1. Classification et Embeddings :</b> La taxonomie est définie par une liste de thématiques (<i>Topic 1, Topic 2...</i>). Le contenu de chaque article brut ainsi que les descriptions des thématiques sont transformés en <b>vecteurs</b> grâce au modèle d'embedding <b><code>BAAI/bge-large-en-v1.5</code></b>. Pour classer un article, on compare son vecteur à ceux des thématiques via la <b>similarité cosinus</b>. Ce calcul génère un <b>score de pertinence</b> (<i>Pertinence score</i>) qui permet d'affecter l'article à la catégorie la plus proche sémantiquement.
      </p>

      <p class="about-work-p">
        <b>2. Résumé automatique :</b> En parallèle, chaque article brut est traité par le modèle de langage <b>Phi3:mini</b> (de Microsoft). L'objectif de ce modèle est de générer une synthèse de l'article en une seule phrase (<b><i>One sentence summary</i></b>) afin de faciliter la lecture rapide sur l'interface.
      </p>

      <p class="about-work-p">
        Tout ce travail d'enrichissement (calculs de similarité et génération de texte) est fait en amont ; le site ne fait que charger, filtrer et trier la base de données finale d'articles enrichis.
      </p>

      <div class="subsection-label">Organigramme du travail</div>
      <div class="about-organigram-wrap">
        <img src="images/organigramme.png" alt="Organigramme du travail" class="about-organigram-img" loading="lazy">
      </div>
      <div class="about-work-footer">
        <div class="about-work-meta">
          <div><strong>${h(ABOUT_WORK.author)}</strong></div>
          <div>Temps de travail : ${ABOUT_WORK.workTime}</div>
          <div>Date : ${dateStr}</div>
          <div><a href="mailto:${h(ABOUT_WORK.email)}" class="about-work-link">${h(ABOUT_WORK.email)}</a></div>
          <div><a href="${h(ABOUT_WORK.repoUrl)}" target="_blank" rel="noopener" class="about-work-link">Dépôt GitHub</a></div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('content-area').innerHTML = html;
}

/* ── Category view ────────────────────────────────────── */
function renderCategory(cat) {
  const m    = catStyle(cat);
  const subs = TAXONOMY[cat] || {};
  const arts = byCat(cat);
  let html = `
    <div class="view-header">
      <div class="view-breadcrumb">
        <span class="bc-link" data-action="overview">Vue d'ensemble</span>
        <span class="bc-sep">/</span>
        <span>${h(cat)}</span>
      </div>
      <div class="view-title" style="color:${m.color}">${h(cat)}</div>
      <div class="view-meta">${arts.length} articles · ${Object.keys(subs).length} sous-catégories</div>
    </div>
    <div class="subcat-grid ${m.cls}">
  `;
  for (const [sub, cnt] of Object.entries(subs)) {
    html += `
      <div class="subcat-card" data-action="subcat" data-cat="${h(cat)}" data-sub="${h(sub)}">
        <div class="sc-name">${h(sub)}</div>
        <div class="sc-count">${cnt} article${cnt !== 1 ? 's' : ''}</div>
      </div>`;
  }
  html += `</div>`;
  html += articleList(sorted(arts));
  document.getElementById('content-area').innerHTML = html;
}

/* ── Subcat view ──────────────────────────────────────── */
function renderSubcat(cat, sub) {
  const m    = catStyle(cat);
  const arts = byCat(cat).filter(a => a.subcategory === sub);
  let html = `
    <div class="view-header">
      <div class="view-breadcrumb">
        <span class="bc-link" data-action="overview">Vue d'ensemble</span>
        <span class="bc-sep">/</span>
        <span class="bc-link" data-action="cat" data-cat="${h(cat)}">${h(cat)}</span>
        <span class="bc-sep">/</span>
        <span>${h(sub)}</span>
      </div>
      <div class="view-title" style="color:${m.color}">${h(sub)}</div>
      <div class="view-meta">${arts.length} articles</div>
    </div>
  `;
  html += articleList(sorted(arts));
  document.getElementById('content-area').innerHTML = html;
}

/* ── Article list ─────────────────────────────────────── */
function articleList(arts) {
  const showSub = state.view !== 'subcategory';
  let html = `
    <div class="list-header">
      <div class="list-title">Articles</div>
      <div class="list-controls">
        <span class="count-badge">${arts.length}</span>
        <select class="sort-sel" data-action="sort">
          <option value="relevance" ${state.sort === 'relevance' ? 'selected' : ''}>↓ Pertinence</option>
          <option value="date"      ${state.sort === 'date'      ? 'selected' : ''}>↓ Date</option>
          <option value="title"     ${state.sort === 'title'     ? 'selected' : ''}>A–Z Titre</option>
        </select>
      </div>
    </div>
    <div class="articles-list">
  `;
  if (!arts.length) {
    html += `<div class="empty"><div class="empty-icon">◌</div>Aucun article</div>`;
  } else {
    arts.forEach((a, i) => { html += artRow(a, i, showSub); });
  }
  html += `</div>`;
  return html;
}

function artRow(a, i, showSub) {
  const rel    = a.relevance;
  const relCls = rel >= 0.72 ? 'rel-hi' : rel >= 0.65 ? 'rel-md' : 'rel-lo';
  const pct    = Math.max(5, Math.min(100, Math.round((rel - 0.55) / 0.25 * 100)));
  const id     = 'art-' + i;
  const isOpen = state.openArticle === id;
  const date   = (a.date && a.date !== 'NA-01-01') ? a.date.slice(0, 10) : '—';
  const revTag = a.needs_review ? `<span class="review-tag">à vérifier</span>` : '';
  const subTag = showSub ? `<span class="sub-tag">${h(a.subcategory)}</span>` : '';
  const link   = a.url
    ? `<a href="${h(a.url)}" target="_blank" rel="noopener" class="art-link">↗ Voir la source</a>`
    : `<span class="art-link no-url">Pas d'URL</span>`;
  return `
    <div class="art-row ${isOpen ? 'open' : ''}" id="${id}" data-action="article" data-id="${id}">
      <div>
        <div class="art-title">${h(a.title)}${revTag}</div>
        <div class="art-meta">
          <span class="src-tag src-${a.source}">${a.source}</span>
          <span>${h(a.authors)}</span>
          <span>${date}</span>
          ${subTag}
        </div>
        <div class="art-detail">
          <div class="art-summary">${h(a.summary || '—')}</div>
          ${link}
        </div>
      </div>
      <div class="art-rel">
        <div class="rel-bar"><div class="rel-fill ${relCls}" style="width:${pct}%"></div></div>
        <div class="rel-num">${rel.toFixed(3)}</div>
      </div>
    </div>
  `;
}

function toggleArt(id) {
  const prev = state.openArticle;
  state.openArticle = prev === id ? null : id;
  if (prev) document.getElementById(prev)?.classList.remove('open');
  if (state.openArticle) document.getElementById(state.openArticle)?.classList.add('open');
}

function byCat(cat) { return ARTICLES.filter(a => a.category === cat); }

function sorted(arr) {
  return [...arr].sort((a, b) => {
    if (state.sort === 'relevance') return b.relevance - a.relevance;
    if (state.sort === 'date')      return (b.date || '').localeCompare(a.date || '');
    if (state.sort === 'title')     return (a.title || '').localeCompare(b.title || '');
    return 0;
  });
}

function h(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Start — synchronous, no fetch needed
boot();
