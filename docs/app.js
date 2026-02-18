/* ─────────────────────────────────────────────────────────
   SLM & Edge AI Watch — app.js
   Data: ./data/articles.json + ./data/taxonomy.json
───────────────────────────────────────────────────────── */

const DATA_ARTICLES = './data/articles.json';
const DATA_TAXONOMY = './data/taxonomy.json';

function catStyle(name) {
  const n = name.toLowerCase();
  if (n.includes('model') || n.includes('intelligence'))
    return { cls: 'cat-model', color: 'var(--c-model)' };
  if (n.includes('edge') || n.includes('system') || n.includes('deploy'))
    return { cls: 'cat-edge', color: 'var(--c-edge)' };
  return { cls: 'cat-data', color: 'var(--c-data)' };
}

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
async function boot() {
  try {
    const [ar, tx] = await Promise.all([
      fetch(DATA_ARTICLES),
      fetch(DATA_TAXONOMY),
    ]);
    if (!ar.ok || !tx.ok) throw new Error('Fetch failed');
    ARTICLES = await ar.json();
    TAXONOMY = await tx.json();
    buildHeader();
    buildTree();
    renderOverview();
    attachListeners();
  } catch (e) {
    document.getElementById('content-area').innerHTML = `
      <div class="loading" style="color:var(--c-data)">
        Impossible de charger les données.<br><br>
        <span style="font-size:.75rem;opacity:.6">
          Lancez : <code>python -m http.server 8000</code> dans le dossier dashboard/
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
  if (a === 'overview') navOverview();
  if (a === 'cat')      onCatClick(el.dataset.cat);
  if (a === 'subcat')   navSubcat(el.dataset.cat, el.dataset.sub);
  if (a === 'article')  toggleArt(el.dataset.id);
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

function rerender() {
  if (state.view === 'overview')         renderOverview();
  else if (state.view === 'category')    renderCategory(state.cat);
  else if (state.view === 'subcategory') renderSubcat(state.cat, state.subcat);
}

function scrollTop() { document.getElementById('main-panel').scrollTop = 0; }

/* ── Overview ─────────────────────────────────────────── */
function renderOverview() {
  // Image slots — replace src with your actual image paths when ready
  const IMAGES = [
    { src: './images/slm-timeline.png', caption: 'Évolution des SLM et de leur taille à travers le temps', placeholder: 'SLM Timeline' },
    { src: './images/transformer.png', caption: 'Architecture Transformer decoder-only optimisée pour l\'edge', placeholder: 'Architecture' },
    { src: './images/hardware.jpeg', caption: 'CPU vs GPU vs NPU — comparaison des accélérateurs IA', placeholder: 'Hardware' },
  ];

  const imgSlots = IMAGES.map(img => `
    <div class="img-slot">
      ${img.src
        ? `<img src="${img.src}" alt="${h(img.caption)}">`
        : `<div class="img-placeholder">
             <div class="ph-icon">🖼</div>
             <div>${img.placeholder}<br><span style="opacity:.5">Glissez une image ici</span></div>
           </div>`
      }
      <div class="img-caption">${h(img.caption)}</div>
    </div>
  `).join('');

  let html = `
    <div class="overview-eyebrow">MOS 4.4 — Veille Technologique</div>
    <div class="overview-title">
      <em>Small Language Models</em><br>& Edge AI
    </div>
    <div class="overview-lead">
      Avancées algorithmiques dans les modèles de langage compacts et leur déploiement
      sur dispositifs locaux — de la quantisation aux architectures NPU-native.
    </div>

    <!-- Definitions -->
    <div class="def-row">
      <div class="def-card">
        <div class="def-card-label">
          <div class="def-pip" style="background:var(--c-model)"></div>
          <span style="color:var(--c-model)">SLM</span>
        </div>
        <div class="def-card-term">Small Language Models</div>
        <div class="def-card-text">
          Modèles optimisés de 0,5 B à 7 B paramètres, conservant des capacités
          de raisonnement avancées grâce à la distillation et la compression.
        </div>
      </div>

      <div class="def-card">
        <div class="def-card-label">
          <div class="def-pip" style="background:var(--c-edge)"></div>
          <span style="color:var(--c-edge)">Edge AI</span>
        </div>
        <div class="def-card-term">Inférence locale</div>
        <div class="def-card-text">
          Déploiement d'algorithmes de Deep Learning directement sur des dispositifs
          locaux (NPU, GPU mobile, DSP) sans dépendance aux API cloud.
        </div>
      </div>

      <div class="def-card">
        <div class="def-card-label">
          <div class="def-pip" style="background:var(--c-data)"></div>
          <span style="color:var(--c-data)">Pourquoi ?</span>
        </div>
        <div class="def-card-term">Enjeux clés</div>
        <div class="def-card-text">
          Protection des données, latence ultra-faible, réduction des coûts cloud
          et disponibilité immédiate sans connectivité.
        </div>
      </div>
    </div>

    <!-- Image grid (replace placeholders with your images) -->
    <div class="img-grid">
      ${imgSlots}
    </div>

    <!-- Context -->
    <div class="ctx-section">
      <p>
        Les performances des LLM suivent une <strong>loi de puissance</strong> par rapport au nombre de paramètres
        (Kaplan et al., 2020 ; Hoffmann et al., 2023). La tendance actuelle inverse cette logique :
        des modèles comme Phi-4-mini (3,8 B), Qwen3 (0,5–7 B) ou Gemma 3 (1–12 B) atteignent
        des performances comparables aux grands modèles sur des tâches ciblées.
      </p>
      <p>
        Le défi central est le <strong>Memory Wall</strong> : un modèle 7 B en FP16 requiert ~14 GB de VRAM,
        dépassant la capacité de la plupart des smartphones. Les stratégies d'optimisation
        — quantisation INT4/INT8, élagage, distillation — permettent de franchir cette barrière.
      </p>
    </div>

    <!-- Taxonomy entry -->
    <div class="section-label">Explorer la taxonomie</div>
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
    html += `
        </div>
        <div class="card-cta">→ Explorer</div>
      </div>
    `;
  }

  html += `</div>`;
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
      </div>
    `;
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

/* ── Article toggle ───────────────────────────────────── */
function toggleArt(id) {
  const prev = state.openArticle;
  state.openArticle = prev === id ? null : id;
  if (prev) document.getElementById(prev)?.classList.remove('open');
  if (state.openArticle) document.getElementById(state.openArticle)?.classList.add('open');
}

/* ── Helpers ──────────────────────────────────────────── */
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
  return (s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

boot();
